/**
 * load-test.js
 *
 * External load tester for the RMS Hosting Tester API.
 * Supports both HTTP and HTTPS targets.
 *
 * ⚠️  Run this from your LOCAL machine or another external machine.
 *     Do NOT run this on the shared cPanel server itself - it will
 *     consume your own hosting resources and skew the results.
 *
 * Usage:
 *   TARGET_URL=https://yourdomain.com CONCURRENT_USERS=20 TOTAL_REQUESTS=200 node load-test.js
 *
 * Environment variables:
 *   TARGET_URL        - Base URL of the API (default: http://localhost:3000)
 *   CONCURRENT_USERS  - Number of parallel requests (default: 20)
 *   TOTAL_REQUESTS    - Total requests to send   (default: 200)
 *
 * Endpoints tested:
 *   GET  /pos-test    - quick DB latency check  (70% of traffic)
 *   GET  /inventory   - inventory list query    (20% of traffic)
 *   GET  /report      - sales report aggregate  (10% of traffic)
 */

require('dotenv').config();

const http  = require('http');
const https = require('https');
const { URL } = require('url');

// ---------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------
const BASE_URL        = (process.env.TARGET_URL || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENT      = parseInt(process.env.CONCURRENT_USERS  || '20',  10);
const TOTAL           = parseInt(process.env.TOTAL_REQUESTS    || '200', 10);
const TIMEOUT_MS      = parseInt(process.env.REQUEST_TIMEOUT   || '10000', 10);

// Endpoints to test with relative weights (must sum to 1.0 or be used as thresholds)
const ENDPOINTS = [
  { path: '/pos-test',   method: 'GET',  weight: 0.70 },
  { path: '/inventory',  method: 'GET',  weight: 0.20 },
  { path: '/report',     method: 'GET',  weight: 0.10 },
];

// Validate base URL
let parsedBase;
try {
  parsedBase = new URL(BASE_URL);
} catch {
  console.error(`❌ Invalid TARGET_URL: "${BASE_URL}"`);
  process.exit(1);
}

// Select HTTP or HTTPS module automatically
const isHttps  = parsedBase.protocol === 'https:';
const requester = isHttps ? https : http;

// ---------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------
const stats = {
  completed:    0,
  successful:   0,
  failed:       0,
  timedOut:     0,
  totalTimeMs:  0,
  minTimeMs:    Infinity,
  maxTimeMs:    0,
  startTime:    null,
  byStatus:     {},
  byEndpoint:   {},
};

// ---------------------------------------------------------------
// Pick a weighted random endpoint
// ---------------------------------------------------------------
function pickEndpoint() {
  const r = Math.random();
  let cumulative = 0;
  for (const ep of ENDPOINTS) {
    cumulative += ep.weight;
    if (r < cumulative) return ep;
  }
  return ENDPOINTS[ENDPOINTS.length - 1];
}

// ---------------------------------------------------------------
// Single request
// ---------------------------------------------------------------
function doRequest() {
  return new Promise((resolve) => {
    const ep      = pickEndpoint();
    const urlStr  = BASE_URL + ep.path;
    let   parsed;

    try {
      parsed = new URL(urlStr);
    } catch {
      stats.failed++;
      return resolve({ success: false, durationMs: 0, endpoint: ep.path, error: 'bad url' });
    }

    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   ep.method,
      headers:  { 'Accept': 'application/json' },
    };

    const start = Date.now();
    let timedOut = false;

    const req = requester.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        const durationMs = Date.now() - start;
        resolve({ success: res.statusCode < 400, durationMs, status: res.statusCode, endpoint: ep.path });
      });
    });

    // Timeout
    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      stats.timedOut++;
      resolve({ success: false, durationMs: TIMEOUT_MS, status: 0, endpoint: ep.path, error: 'timeout' });
    }, TIMEOUT_MS);

    req.on('error', (err) => {
      if (timedOut) return;
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      resolve({ success: false, durationMs, status: 0, endpoint: ep.path, error: err.message });
    });

    req.on('response', () => clearTimeout(timer));
    req.end();
  });
}

// ---------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------
function progress() {
  const pct   = Math.floor((stats.completed / TOTAL) * 100);
  const bar   = '█'.repeat(Math.floor(pct / 2)) + '░'.repeat(50 - Math.floor(pct / 2));
  process.stdout.write(`\r[${bar}] ${pct}%  ${stats.completed}/${TOTAL}  errors:${stats.failed}`);
}

// ---------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------
async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         RMS Hosting Tester – Load Test           ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Target:      ${BASE_URL}`);
  console.log(`Protocol:    ${isHttps ? 'HTTPS' : 'HTTP'}`);
  console.log(`Concurrency: ${CONCURRENT} parallel requests`);
  console.log(`Total:       ${TOTAL} requests`);
  console.log(`Timeout:     ${TIMEOUT_MS}ms per request`);
  console.log(`Endpoints:   ${ENDPOINTS.map(e => e.path).join(', ')}`);
  console.log('');
  console.log('⚠️  Run this from an external machine, not the hosting server.');
  console.log('');

  stats.startTime = Date.now();

  // Queue-based concurrency control
  let queued  = 0;
  let running = 0;

  await new Promise((resolve) => {
    function dispatch() {
      // Fill up to concurrency limit
      while (running < CONCURRENT && queued < TOTAL) {
        queued++;
        running++;
        doRequest().then((result) => {
          running--;
          stats.completed++;

          if (result.success) {
            stats.successful++;
          } else {
            stats.failed++;
          }

          stats.totalTimeMs += result.durationMs;
          if (result.durationMs < stats.minTimeMs) stats.minTimeMs = result.durationMs;
          if (result.durationMs > stats.maxTimeMs) stats.maxTimeMs = result.durationMs;

          // Track by status code
          const sc = String(result.status || 'error');
          stats.byStatus[sc] = (stats.byStatus[sc] || 0) + 1;

          // Track by endpoint
          stats.byEndpoint[result.endpoint] = (stats.byEndpoint[result.endpoint] || 0) + 1;

          progress();

          if (stats.completed >= TOTAL) {
            resolve();
          } else {
            dispatch();
          }
        });
      }
    }
    dispatch();
  });

  // ---------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------
  const wallTimeMs    = Date.now() - stats.startTime;
  const avgMs         = stats.successful > 0 ? (stats.totalTimeMs / stats.successful).toFixed(1) : 'N/A';
  const successRate   = ((stats.successful / TOTAL) * 100).toFixed(1);
  const rps           = (TOTAL / (wallTimeMs / 1000)).toFixed(1);

  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                  RESULTS                         ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Total Requests:      ${TOTAL}`);
  console.log(`Successful:          ${stats.successful}`);
  console.log(`Failed:              ${stats.failed}`);
  console.log(`Timed Out:           ${stats.timedOut}`);
  console.log(`Success Rate:        ${successRate}%`);
  console.log('');
  console.log(`Average Response:    ${avgMs}ms`);
  console.log(`Minimum Response:    ${stats.minTimeMs === Infinity ? 'N/A' : stats.minTimeMs + 'ms'}`);
  console.log(`Maximum Response:    ${stats.maxTimeMs}ms`);
  console.log(`Requests / Second:   ${rps}`);
  console.log(`Total Wall Time:     ${(wallTimeMs / 1000).toFixed(2)}s`);
  console.log('');
  console.log('By Status Code:');
  for (const [code, count] of Object.entries(stats.byStatus)) {
    console.log(`  ${code.padEnd(8)} ${count} requests`);
  }
  console.log('');
  console.log('By Endpoint:');
  for (const [ep, count] of Object.entries(stats.byEndpoint)) {
    console.log(`  ${ep.padEnd(20)} ${count} requests`);
  }
  console.log('');

  // Simple pass/fail guidance
  if (parseFloat(successRate) >= 95) {
    console.log('✅ Success rate ≥ 95% – hosting handled this load level.');
  } else if (parseFloat(successRate) >= 80) {
    console.log('⚠️  Success rate 80-95% – acceptable for shared hosting under moderate load.');
  } else {
    console.log('❌ Success rate < 80% – hosting may be struggling at this concurrency level.');
  }
  console.log('');
  console.log('💡 Test at multiple levels:  10, 25, and 50 concurrent users.');
  console.log('   Record results for each level to build a performance profile.');
}

run().catch((err) => {
  console.error('Load test error:', err.message);
  process.exit(1);
});
