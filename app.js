/**
 * app.js - RMS Hosting Tester
 *
 * Tests whether a shared cPanel server can support:
 *   - Node.js 20+ / Express.js
 *   - MySQL with connection pooling and transactions
 *   - Concurrent requests and row-level locking
 *   - Socket.IO / WebSockets (WSS compatible)
 *   - Environment variables via dotenv
 *   - Passenger / cPanel application restarts
 *
 * Start file: app.js
 * Port:       process.env.PORT (Passenger sets this automatically)
 */

require('dotenv').config();

const express    = require('express');
const mysql      = require('mysql2/promise');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

// ---------------------------------------------------------------
// App & server setup
// ---------------------------------------------------------------
const app    = express();
const server = http.createServer(app);

// Socket.IO - allow all origins for cross-origin browser tests
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(express.json());

// Serve all static files in the project root (dashboard, socket-test page, etc.)
app.use(express.static(path.join(__dirname)));

// ---------------------------------------------------------------
// MySQL connection pool
// ---------------------------------------------------------------
const pool = mysql.createPool({
  host:             process.env.DB_HOST            || 'localhost',
  port:             parseInt(process.env.DB_PORT)  || 3306,
  user:             process.env.DB_USER            || 'root',
  password:         process.env.DB_PASSWORD        || '',
  database:         process.env.DB_NAME            || 'rms_test',
  waitForConnections: true,
  connectionLimit:  parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit:       0,
});

// ---------------------------------------------------------------
// Request timing middleware
// Logs: METHOD /path - STATUS - Xms
// ---------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Suppress high-frequency log spam during stress tests on health endpoints
    const suppress = process.env.NODE_ENV === 'production' && req.path === '/health';
    if (!suppress) {
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${Date.now() - start}ms`);
    }
  });
  next();
});

// ---------------------------------------------------------------
// Helper: safe error response (never expose stack traces in prod)
// ---------------------------------------------------------------
function errorResponse(res, status, message, err) {
  const body = { success: false, message };
  if (process.env.NODE_ENV !== 'production' && err) {
    body.debug = err.message;
  }
  return res.status(status).json(body);
}

// ===============================================================
// HEALTH ENDPOINTS
// ===============================================================

/**
 * GET /health
 * Basic liveness check - confirms the process is running.
 */
app.get('/health', (req, res) => {
  res.json({
    success:     true,
    status:      'healthy',
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
    memory:      process.memoryUsage(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /health/db
 * Tests MySQL connectivity and measures round-trip latency.
 */
app.get('/health/db', async (req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({
      success:    true,
      database:   'connected',
      durationMs: Date.now() - start,
    });
  } catch (err) {
    console.error('DB health check failed:', err.message);
    errorResponse(res, 503, 'Database unavailable', err);
  }
});

// ===============================================================
// INFORMATION / ROOT
// ===============================================================

/**
 * GET /
 * API root - confirms the server is running.
 */
app.get('/', (req, res) => {
  res.json({
    message:     'RMS Hosting Test API is running',
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /dashboard
 * Serves the visual testing dashboard (dashboard.html).
 */
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ===============================================================
// ENVIRONMENT TEST
// ---------------------------------------------------------------
// IMPORTANT: never return the actual secret value.
// ===============================================================

/**
 * GET /env-test
 * Confirms that environment variables are loaded.
 * Returns "Configured" or "Missing" - never the real value.
 */
app.get('/env-test', (req, res) => {
  res.json({
    success: true,
    environmentVariables: {
      TEST_SECRET:   process.env.TEST_SECRET   ? 'Configured' : 'Missing',
      DB_HOST:       process.env.DB_HOST        ? 'Configured' : 'Missing',
      DB_NAME:       process.env.DB_NAME        ? 'Configured' : 'Missing',
      NODE_ENV:      process.env.NODE_ENV       || 'development',
    },
  });
});

// ===============================================================
// DATABASE ENDPOINTS
// ===============================================================

/**
 * GET /db-test
 * Basic database connectivity - returns server time and connection ID.
 */
app.get('/db-test', async (req, res) => {
  const start = Date.now();
  try {
    const [rows] = await pool.query(
      'SELECT NOW() AS server_time, CONNECTION_ID() AS connection_id'
    );
    res.json({
      success:    true,
      database:   'Connected',
      serverTime: rows[0].server_time,
      connectionId: rows[0].connection_id,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    console.error('DB test error:', err.message);
    errorResponse(res, 500, 'Database error', err);
  }
});

/**
 * GET /db-performance
 * Runs realistic JOIN queries and measures individual durations.
 * Tests: recent orders with items, sales totals, inventory movements.
 */
app.get('/db-performance', async (req, res) => {
  const totalStart = Date.now();
  const operations = [];

  try {
    // 1. Recent orders with item details (JOIN test)
    let t = Date.now();
    const [recentOrders] = await pool.query(`
      SELECT
        o.id        AS order_id,
        o.total,
        o.status,
        o.created_at,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 20
    `);
    operations.push({ operation: 'Recent orders JOIN order_items', durationMs: Date.now() - t, rows: recentOrders.length });

    // 2. Sales report - total revenue and average order value
    t = Date.now();
    const [[salesReport]] = await pool.query(`
      SELECT
        COUNT(*)                          AS total_orders,
        IFNULL(SUM(total), 0)             AS total_revenue,
        IFNULL(AVG(total), 0)             AS avg_order_value,
        IFNULL(MAX(total), 0)             AS max_order_value
      FROM orders
      WHERE status = 'completed'
    `);
    operations.push({ operation: 'Sales report aggregate', durationMs: Date.now() - t });

    // 3. Top selling items
    t = Date.now();
    const [topItems] = await pool.query(`
      SELECT
        i.id,
        i.name,
        i.category,
        i.stock                               AS current_stock,
        IFNULL(SUM(oi.quantity), 0)           AS total_sold,
        IFNULL(SUM(oi.subtotal), 0)           AS total_revenue
      FROM items i
      LEFT JOIN order_items oi ON oi.item_id = i.id
      LEFT JOIN orders o       ON o.id = oi.order_id AND o.status = 'completed'
      GROUP BY i.id
      ORDER BY total_sold DESC
      LIMIT 10
    `);
    operations.push({ operation: 'Top selling items JOIN', durationMs: Date.now() - t, rows: topItems.length });

    // 4. Stock movement history
    t = Date.now();
    const [movements] = await pool.query(`
      SELECT
        sm.id,
        i.name        AS item_name,
        sm.quantity,
        sm.movement_type,
        sm.reference_order_id,
        sm.created_at
      FROM stock_movements sm
      JOIN items i ON i.id = sm.item_id
      ORDER BY sm.created_at DESC
      LIMIT 20
    `);
    operations.push({ operation: 'Stock movement history JOIN', durationMs: Date.now() - t, rows: movements.length });

    const totalDurationMs = Date.now() - totalStart;

    res.json({
      success:          true,
      totalDurationMs,
      databaseDurationMs: operations.reduce((s, o) => s + o.durationMs, 0),
      operations,
      summary: {
        salesReport,
        topItems: topItems.slice(0, 5),
        recentOrderCount: recentOrders.length,
      },
    });
  } catch (err) {
    console.error('DB performance error:', err.message);
    errorResponse(res, 500, 'Database performance test failed', err);
  }
});

// ===============================================================
// INVENTORY ENDPOINT
// ===============================================================

/**
 * GET /inventory
 * Returns current inventory for all menu items.
 */
app.get('/inventory', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, category, price, stock FROM items ORDER BY category, name'
    );
    res.json({ success: true, items: rows, totalItems: rows.length });
  } catch (err) {
    console.error('Inventory error:', err.message);
    errorResponse(res, 500, 'Failed to fetch inventory', err);
  }
});

// Legacy alias kept for dashboard compatibility
app.get('/inventory-test', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, category, price, stock FROM items ORDER BY category, name LIMIT 100'
    );
    res.json({ success: true, items: rows, totalItems: rows.length });
  } catch (err) {
    errorResponse(res, 500, 'Failed to fetch inventory', err);
  }
});

// ===============================================================
// ORDERS ENDPOINT
// ===============================================================

/**
 * GET /orders
 * Returns recent orders (max 20).
 */
app.get('/orders', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, total, status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json({ success: true, orders: rows, count: rows.length });
  } catch (err) {
    console.error('Orders error:', err.message);
    errorResponse(res, 500, 'Failed to fetch orders', err);
  }
});

// Legacy alias
app.get('/orders-test', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 20'
    );
    res.json({ success: true, orders: rows, count: rows.length });
  } catch (err) {
    errorResponse(res, 500, 'Failed to fetch orders', err);
  }
});

// ===============================================================
// REPORT ENDPOINT
// ===============================================================

/**
 * GET /report
 * Lightweight sales summary report.
 */
app.get('/report', async (req, res) => {
  try {
    const [[orderStats]]  = await pool.query(
      `SELECT COUNT(*) AS orders_count, IFNULL(SUM(total), 0) AS revenue
       FROM orders WHERE status = 'completed'`
    );
    const [[itemStats]]   = await pool.query(
      'SELECT COUNT(*) AS total_items, IFNULL(SUM(stock), 0) AS total_stock FROM items'
    );
    res.json({
      success: true,
      report: { ...orderStats, ...itemStats, generated_at: new Date().toISOString() },
    });
  } catch (err) {
    console.error('Report error:', err.message);
    errorResponse(res, 500, 'Failed to generate report', err);
  }
});

// Legacy alias
app.get('/report-test', async (req, res) => {
  try {
    const [[orderStats]] = await pool.query(
      `SELECT COUNT(*) AS orders_count, IFNULL(SUM(total), 0) AS revenue
       FROM orders WHERE status = 'completed'`
    );
    const [[itemStats]]  = await pool.query(
      'SELECT COUNT(*) AS total_items, IFNULL(SUM(stock), 0) AS total_stock FROM items'
    );
    res.json({
      success: true,
      report: { ...orderStats, ...itemStats, generated_at: new Date().toISOString() },
    });
  } catch (err) {
    errorResponse(res, 500, 'Failed to generate report', err);
  }
});

// ===============================================================
// POS TEST (simple latency check, kept for dashboard compatibility)
// ===============================================================

/**
 * GET /pos-test
 * Quick database round-trip latency check used by the load tester.
 * Returns a clear error when the database is unavailable.
 */
app.get('/pos-test', async (req, res) => {
  const start = Date.now();
  try {
    const [rows] = await pool.query('SELECT NOW() AS server_time');
    res.json({
      success:     true,
      durationMs:  Date.now() - start,
      serverTime:  rows[0].server_time,
      requestId:   Math.random().toString(36).substr(2, 9),
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error('POS test - DB unavailable:', err.message);
    res.status(503).json({
      success:    false,
      message:    'Database unavailable',
      durationMs,
    });
  }
});

// ===============================================================
// CHECKOUT ENDPOINT  (core transaction test)
// ===============================================================

/**
 * POST /checkout
 *
 * Simulates a real POS checkout with full transaction safety:
 *   - Locks inventory rows with SELECT ... FOR UPDATE
 *   - Validates item existence and stock availability
 *   - Calculates totals server-side (never trusts client prices)
 *   - Creates order + order_items + stock_movements atomically
 *   - Rolls back the entire transaction on any failure
 *
 * Body: { "items": [{ "itemId": 1, "quantity": 2 }, ...] }
 */
app.post('/checkout', async (req, res) => {
  const start = Date.now();
  const { items } = req.body;

  // --- Basic request validation ---
  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse(res, 400, 'Request body must include a non-empty "items" array.');
  }

  for (const entry of items) {
    if (!Number.isInteger(entry.itemId) || entry.itemId < 1) {
      return errorResponse(res, 400, `Invalid itemId: ${entry.itemId}`);
    }
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      return errorResponse(res, 400, `Invalid quantity for itemId ${entry.itemId}: ${entry.quantity}`);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Deduplicate item IDs in case the same item appears twice
    const itemMap = {};
    for (const entry of items) {
      itemMap[entry.itemId] = (itemMap[entry.itemId] || 0) + entry.quantity;
    }
    const uniqueIds = Object.keys(itemMap).map(Number);

    // --- Lock rows for this transaction (prevents concurrent overselling) ---
    const placeholders = uniqueIds.map(() => '?').join(',');
    const [lockedRows] = await conn.query(
      `SELECT id, name, price, stock FROM items WHERE id IN (${placeholders}) FOR UPDATE`,
      uniqueIds
    );

    // --- Verify all items exist ---
    if (lockedRows.length !== uniqueIds.length) {
      const foundIds    = lockedRows.map(r => r.id);
      const missingIds  = uniqueIds.filter(id => !foundIds.includes(id));
      await conn.rollback();
      return errorResponse(res, 404, `Items not found: ${missingIds.join(', ')}`);
    }

    // Build a map for quick lookup
    const itemDetails = {};
    for (const row of lockedRows) {
      itemDetails[row.id] = row;
    }

    // --- Verify sufficient stock ---
    const stockErrors = [];
    for (const id of uniqueIds) {
      const qty     = itemMap[id];
      const detail  = itemDetails[id];
      if (detail.stock < qty) {
        stockErrors.push(`"${detail.name}": requested ${qty}, available ${detail.stock}`);
      }
    }
    if (stockErrors.length > 0) {
      await conn.rollback();
      return res.status(422).json({
        success: false,
        message: 'Insufficient stock',
        details: stockErrors,
      });
    }

    // --- Calculate total server-side ---
    let total = 0;
    for (const id of uniqueIds) {
      total += parseFloat(itemDetails[id].price) * itemMap[id];
    }

    // --- Create order record ---
    const [orderResult] = await conn.query(
      'INSERT INTO orders (total, status) VALUES (?, ?)',
      [total.toFixed(2), 'completed']
    );
    const orderId = orderResult.insertId;

    // --- Create order_items and deduct stock ---
    for (const id of uniqueIds) {
      const qty     = itemMap[id];
      const detail  = itemDetails[id];
      const subtotal = parseFloat(detail.price) * qty;

      // Order line item
      await conn.query(
        'INSERT INTO order_items (order_id, item_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, id, qty, detail.price, subtotal.toFixed(2)]
      );

      // Deduct inventory
      await conn.query(
        'UPDATE items SET stock = stock - ? WHERE id = ?',
        [qty, id]
      );

      // Audit trail
      await conn.query(
        `INSERT INTO stock_movements
           (item_id, quantity, movement_type, reference_order_id)
         VALUES (?, ?, 'sale', ?)`,
        [id, -qty, orderId]
      );
    }

    await conn.commit();

    // Emit real-time events to connected browser clients
    io.emit('order:created', {
      orderId,
      total:     total.toFixed(2),
      itemCount: uniqueIds.length,
      timestamp: new Date().toISOString(),
    });
    io.emit('inventory:updated', {
      updatedItems: uniqueIds,
      timestamp:    new Date().toISOString(),
    });

    return res.status(201).json({
      success:    true,
      orderId,
      total:      parseFloat(total.toFixed(2)),
      itemCount:  uniqueIds.length,
      durationMs: Date.now() - start,
    });

  } catch (err) {
    await conn.rollback();
    console.error('Checkout error:', err.message);
    return errorResponse(res, 500, 'Checkout failed', err);
  } finally {
    conn.release();
  }
});

// Legacy alias for dashboard compatibility
app.post('/checkout-test', async (req, res) => {
  // Forward to /checkout logic by re-using the same handler approach
  req.url = '/checkout';
  // Rebuild body format if old format is used { items: [{ id, qty }] }
  if (req.body && req.body.items && req.body.items[0] && req.body.items[0].id !== undefined) {
    req.body.items = req.body.items.map(i => ({ itemId: i.id, quantity: i.qty || i.quantity || 1 }));
  }

  const start = Date.now();
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse(res, 400, 'Request body must include a non-empty "items" array.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const itemMap = {};
    for (const entry of items) {
      const id  = entry.itemId || entry.id;
      const qty = entry.quantity || entry.qty || 1;
      itemMap[id] = (itemMap[id] || 0) + qty;
    }
    const uniqueIds     = Object.keys(itemMap).map(Number);
    const placeholders  = uniqueIds.map(() => '?').join(',');
    const [lockedRows]  = await conn.query(
      `SELECT id, name, price, stock FROM items WHERE id IN (${placeholders}) FOR UPDATE`,
      uniqueIds
    );

    if (lockedRows.length !== uniqueIds.length) {
      await conn.rollback();
      return errorResponse(res, 404, 'One or more items not found.');
    }

    const itemDetails = {};
    for (const row of lockedRows) itemDetails[row.id] = row;

    let total = 0;
    for (const id of uniqueIds) {
      if (itemDetails[id].stock < itemMap[id]) {
        await conn.rollback();
        return res.status(422).json({ success: false, message: `Insufficient stock for "${itemDetails[id].name}"` });
      }
      total += parseFloat(itemDetails[id].price) * itemMap[id];
    }

    const [orderResult] = await conn.query(
      'INSERT INTO orders (total, status) VALUES (?, ?)',
      [total.toFixed(2), 'completed']
    );
    const orderId = orderResult.insertId;

    for (const id of uniqueIds) {
      const qty      = itemMap[id];
      const subtotal = parseFloat(itemDetails[id].price) * qty;
      await conn.query(
        'INSERT INTO order_items (order_id, item_id, quantity, price, subtotal) VALUES (?,?,?,?,?)',
        [orderId, id, qty, itemDetails[id].price, subtotal.toFixed(2)]
      );
      await conn.query('UPDATE items SET stock = stock - ? WHERE id = ?', [qty, id]);
      await conn.query(
        `INSERT INTO stock_movements (item_id, quantity, movement_type, reference_order_id) VALUES (?,?,'sale',?)`,
        [id, -qty, orderId]
      );
    }

    await conn.commit();

    io.emit('order:created',      { orderId, total: total.toFixed(2), timestamp: new Date().toISOString() });
    io.emit('inventory:updated',  { updatedItems: uniqueIds, timestamp: new Date().toISOString() });

    return res.status(201).json({
      success:   true,
      orderId,
      total:     total.toFixed(2),
      itemCount: uniqueIds.length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Checkout-test error:', err.message);
    return errorResponse(res, 500, 'Checkout failed', err);
  } finally {
    conn.release();
  }
});

// ===============================================================
// ERROR TEST
// ===============================================================

/**
 * GET /error-test
 * Intentionally throws an error to test the error handler.
 */
app.get('/error-test', (req, res, next) => {
  next(new Error('Intentional test error - error handling is working correctly'));
});

// ===============================================================
// CENTRALIZED ERROR HANDLER
// ===============================================================
// Must have four parameters for Express to recognise it as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  const body = { success: false, message: 'Internal server error' };
  if (process.env.NODE_ENV !== 'production') {
    body.debug = err.message;
  }
  res.status(500).json(body);
});

// ===============================================================
// SOCKET.IO
// ===============================================================

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Welcome event - lets the client confirm the connection ID
  socket.emit('server-message', {
    message:   'Socket.IO connected successfully',
    socketId:  socket.id,
    timestamp: new Date().toISOString(),
  });

  // ---- ping / pong (latency test) ----
  socket.on('test:ping', (data) => {
    socket.emit('test:pong', {
      socketId:  socket.id,
      timestamp: new Date().toISOString(),
      echo:      data,
    });
  });

  // Legacy event name kept for dashboard compatibility
  socket.on('test-message', (data) => {
    socket.emit('test-response', {
      message:      'Server received your message',
      data,
      responseTime: new Date().toISOString(),
      socketId:     socket.id,
    });
  });

  socket.on('dashboard-ping', (data) => {
    socket.emit('dashboard-pong', {
      message:      'Pong from server',
      timestamp:    new Date().toISOString(),
      originalData: data,
    });
  });

  // ---- order:new (manual trigger from test page) ----
  socket.on('order:new', (data) => {
    console.log(`[Socket.IO] order:new from ${socket.id}:`, data);
    // Broadcast to all clients so kitchen display / POS can update
    io.emit('order:created', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ===============================================================
// SERVER START
// ===============================================================

// Passenger on cPanel sets process.env.PORT automatically.
// Falls back to 3000 for local development.
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`RMS Hosting Tester started`);
  console.log(`Port:        ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Dashboard:   http://localhost:${PORT}/dashboard`);
  console.log(`Socket test: http://localhost:${PORT}/socket-test.html`);
  console.log('='.repeat(50));
});

// ---------------------------------------------------------------
// Process-level error guards (keeps the server alive on cPanel)
// ---------------------------------------------------------------
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
