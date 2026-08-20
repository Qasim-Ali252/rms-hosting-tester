const http = require('http');
const { URL } = require('url');

// Simple concurrent requester for endpoints
const TARGET = process.env.TARGET || 'http://localhost:3000/pos-test';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);
const REQUESTS = parseInt(process.env.REQUESTS || '200', 10);

let completed = 0;
let errors = 0;
let totalTime = 0;

function doRequest() {
  const start = Date.now();
  const url = new URL(TARGET);
  const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: 'GET' };
  const req = http.request(opts, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      const duration = Date.now() - start;
      totalTime += duration;
      completed++;
      if (completed % 10 === 0) process.stdout.write(`Completed ${completed}/${REQUESTS}\r`);
      scheduleNext();
    });
  });
  req.on('error', (err) => { errors++; completed++; console.error('Request error', err.message); scheduleNext(); });
  req.end();
}

let started = 0;
function scheduleNext() {
  if (started < REQUESTS) {
    started++;
    doRequest();
  } else if (completed >= REQUESTS) {
    console.log('\nLoad test complete');
    console.log('Total requests:', REQUESTS);
    console.log('Errors:', errors);
    console.log('Average latency (ms):', (totalTime / (REQUESTS - errors)).toFixed(2));
    process.exit(0);
  }
}

// Kick off concurrency
for (let i = 0; i < Math.min(CONCURRENCY, REQUESTS); i++) scheduleNext();
