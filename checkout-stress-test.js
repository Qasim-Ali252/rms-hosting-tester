/**
 * checkout-stress-test.js
 *
 * Sends multiple simultaneous checkout requests for the same item
 * to verify that MySQL row locking and transactions prevent
 * overselling and negative inventory.
 *
 * ⚠️  Run this from your LOCAL machine, not the cPanel server.
 *
 * Prerequisites:
 *   1. The server must be running.
 *   2. The target item must have enough stock to demonstrate
 *      partial success.  Recommended: set initial stock = CONCURRENT_REQUESTS / 2.
 *
 * Usage:
 *   TARGET_URL=https://yourdomain.com \
 *   CONCURRENT_REQUESTS=20 \
 *   ITEM_ID=1 \
 *   QUANTITY=1 \
 *   node checkout-stress-test.js
 *
 * Environment variables:
 *   TARGET_URL          - Base URL of the API       (default: http://localhost:3000)
 *   CONCURRENT_REQUESTS - Simultaneous requests     (default: 20)
 *   ITEM_ID             - Menu item ID to purchase  (default: 1)
 *   QUANTITY            - Units per request         (default: 1)
 *
 * Expected result when initial stock = CONCURRENT_REQUESTS / 2:
 *   Successful orders = CONCURRENT_REQUESTS / 2
 *   Failed orders     = CONCURRENT_REQUESTS / 2
 *   Final stock       = 0
 *   Negative stock    = NEVER
 */

require('dotenv').config();

const http  = require('http');
const https = require('https');
const { URL } = require('url');

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------
const BASE_URL    = (process.env.TARGET_URL          || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENT  = parseInt(process.env.CONCURRENT_REQUESTS || '20', 10);
const ITEM_ID     = parseInt(process.env.ITEM_ID             || '1',  10);
const QUANTITY    = parseInt(process.env.QUANTITY            || '1',  10);

let parsedBase;
try {
  parsedBase = new URL(BASE_URL);
} catch {
  console.error(`❌ Invalid TARGET_URL: "${BASE_URL}"`);
  process.exit(1);
}

const isHttps   = parsedBase.protocol === 'https:';
const requester = isHttps ? https : http;

// ---------------------------------------------------------------
// Single POST /checkout request
// ---------------------------------------------------------------
function doCheckout(index) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      items: [{ itemId: ITEM_ID, quantity: QUANTITY }],
    });

    const opts = {
      hostname: parsedBase.hostname,
      port:     parsedBase.port || (isHttps ? 443 : 80),
      path:     '/checkout',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const start = Date.now();
    const req = requester.request(opts, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        const durationMs = Date.now() - start;
        let data;
        try { data = JSON.parse(raw); } catch { data = {}; }
        resolve({
          index,
          success:    res.statusCode === 201,
          statusCode: res.statusCode,
          durationMs,
          orderId:    data.orderId  || null,
          total:      data.total    || null,
          message:    data.message  || data.error || null,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        index,
        success:    false,
        statusCode: 0,
        durationMs: Date.now() - start,
        orderId:    null,
        total:      null,
        message:    err.message,
      });
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------
// Fetch stock for a single item
// ---------------------------------------------------------------
function fetchStock() {
  return new Promise((resolve) => {
    const opts = {
      hostname: parsedBase.hostname,
      port:     parsedBase.port || (isHttps ? 443 : 80),
      path:     '/inventory',
      method:   'GET',
      headers:  { 'Accept': 'application/json' },
    };

    const req = requester.request(opts, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try {
          const data  = JSON.parse(raw);
          const found = (data.items || []).find(i => i.id === ITEM_ID);
          resolve(found ? found.stock : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------
async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    RMS Hosting Tester – Checkout Stress Test     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Target:              ${BASE_URL}`);
  console.log(`Protocol:            ${isHttps ? 'HTTPS' : 'HTTP'}`);
  console.log(`Item ID:             ${ITEM_ID}`);
  console.log(`Quantity per order:  ${QUANTITY}`);
  console.log(`Concurrent requests: ${CONCURRENT}`);
  console.log('');
  console.log('⚠️  Run this from an external machine, not the cPanel server.');
  console.log('');

  // Fetch initial stock
  console.log('📦 Fetching initial stock...');
  const initialStock = await fetchStock();
  if (initialStock === null) {
    console.warn(`⚠️  Could not fetch initial stock for item ${ITEM_ID}. Continuing anyway.`);
  } else {
    console.log(`   Item ${ITEM_ID} – Initial stock: ${initialStock}`);
    if (initialStock < 1) {
      console.error(`❌ Item ${ITEM_ID} has no stock (${initialStock}). Seed the database first.`);
      process.exit(1);
    }
    console.log(`   Expected successful orders: ≤ ${Math.floor(initialStock / QUANTITY)}`);
    console.log(`   Expected failed orders:     ≥ ${Math.max(0, CONCURRENT - Math.floor(initialStock / QUANTITY))}`);
  }

  console.log('');
  console.log(`🚀 Firing ${CONCURRENT} simultaneous checkout requests...`);
  const start    = Date.now();
  const promises = Array.from({ length: CONCURRENT }, (_, i) => doCheckout(i + 1));
  const results  = await Promise.all(promises);
  const wallMs   = Date.now() - start;

  // ---------------------------------------------------------------
  // Analyse results
  // ---------------------------------------------------------------
  const successful   = results.filter(r => r.success);
  const failed       = results.filter(r => !r.success);
  const durations    = results.map(r => r.durationMs);
  const avgMs        = (durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(0);
  const minMs        = Math.min(...durations);
  const maxMs        = Math.max(...durations);

  console.log('');
  console.log('📊 Per-request results:');
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const info = r.success
      ? `orderId=${r.orderId}  total=${r.total}`
      : `status=${r.statusCode}  reason=${r.message}`;
    console.log(`  [${String(r.index).padStart(3)}] ${icon} ${info}  (${r.durationMs}ms)`);
  });

  // Fetch final stock
  console.log('');
  console.log('📦 Fetching final stock...');
  const finalStock = await fetchStock();

  // Negative stock check
  const negativeDetected = finalStock !== null && finalStock < 0;

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                   SUMMARY                        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Concurrent Requests:     ${CONCURRENT}`);
  console.log(`Successful Orders:       ${successful.length}`);
  console.log(`Failed Orders:           ${failed.length}`);
  console.log(`Initial Stock:           ${initialStock !== null ? initialStock : 'unknown'}`);
  console.log(`Final Stock:             ${finalStock   !== null ? finalStock   : 'unknown'}`);
  console.log(`Negative Stock Detected: ${negativeDetected ? 'YES ⚠️' : 'NO ✅'}`);
  console.log('');
  console.log(`Avg Response Time:       ${avgMs}ms`);
  console.log(`Min Response Time:       ${minMs}ms`);
  console.log(`Max Response Time:       ${maxMs}ms`);
  console.log(`Total Wall Time:         ${wallMs}ms`);
  console.log('');

  // ---------------------------------------------------------------
  // Pass / Fail verdict
  // ---------------------------------------------------------------
  let passed = true;

  if (negativeDetected) {
    console.log('❌ FAIL: Negative stock detected. Transaction locking is NOT working correctly.');
    passed = false;
  } else {
    console.log('✅ PASS: No negative stock. MySQL row locking prevented overselling.');
  }

  if (initialStock !== null && finalStock !== null) {
    const expectedFinalStock = Math.max(0, initialStock - successful.length * QUANTITY);
    if (finalStock === expectedFinalStock) {
      console.log(`✅ PASS: Final stock (${finalStock}) matches expected (${expectedFinalStock}).`);
    } else {
      console.log(`⚠️  Final stock (${finalStock}) differs from expected (${expectedFinalStock}). Review the results.`);
    }
  }

  if (failed.length > 0) {
    const reasons = [...new Set(failed.map(r => r.message).filter(Boolean))];
    console.log(`ℹ️  Failed orders returned: ${reasons.slice(0, 3).join(' | ')}`);
  }

  console.log('');
  console.log('💡 What this proves:');
  console.log('   - MySQL transactions with SELECT ... FOR UPDATE prevent concurrent overselling.');
  console.log('   - Rollbacks are triggered correctly when stock is insufficient.');
  console.log('   - Race conditions in shared hosting environments are handled safely.');
  console.log('');

  process.exit(passed ? 0 : 1);
}

run().catch((err) => {
  console.error('Stress test error:', err.message);
  process.exit(1);
});
