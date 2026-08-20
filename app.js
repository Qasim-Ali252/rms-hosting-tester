require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname)));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Add request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// 1. Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'RMS Hosting Test API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 2. Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 3. System health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// 4. Environment variable test
app.get('/env-test', (req, res) => {
  res.json({ environment: process.env.TEST_SECRET ? 'Working' : 'MISSING', TEST_SECRET: process.env.TEST_SECRET });
});

// 5. Database connectivity test
app.get('/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() AS server_time, CONNECTION_ID() AS connection_id');
    res.json({
      success: true,
      database: 'Connected',
      serverTime: rows[0].server_time,
      connectionId: rows[0].connection_id
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Simulated POS request
app.get('/pos-test', async (req, res) => {
  const start = Date.now();
  try {
    const [rows] = await pool.query('SELECT NOW() AS server_time');
    const duration = Date.now() - start;
    res.json({
      success: true,
      duration: `${duration}ms`,
      databaseTime: rows[0].server_time,
      requestId: Math.random().toString(36).substr(2, 9)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Realistic endpoints for load testing
app.get('/orders-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, created_at, total FROM orders ORDER BY created_at DESC LIMIT 20');
    res.json({ success: true, orders: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/checkout-test', async (req, res) => {
  const items = req.body.items || [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    for (const it of items) {
      const [rows] = await conn.query('SELECT id, qty, price FROM items WHERE id = ? FOR UPDATE', [it.id]);
      if (!rows[0]) throw new Error('Item not found: ' + it.id);
      if (rows[0].qty < it.qty) throw new Error('Insufficient qty for item: ' + it.id);
      total += parseFloat(rows[0].price) * it.qty;
      await conn.query('UPDATE items SET qty = qty - ? WHERE id = ?', [it.qty, it.id]);
    }
    const [r] = await conn.query('INSERT INTO orders (total) VALUES (?)', [total.toFixed(2)]);
    await conn.commit();
    res.json({ success: true, orderId: r.insertId, total: total.toFixed(2), itemCount: items.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get('/inventory-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, sku, name, qty, price FROM items LIMIT 100');
    res.json({ success: true, items: rows, totalItems: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/report-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS orders_count, IFNULL(SUM(total),0) AS revenue FROM orders');
    const [itemsCount] = await pool.query('SELECT COUNT(*) AS total_items, SUM(qty) AS total_stock FROM items');
    res.json({ 
      success: true, 
      report: {
        ...rows[0],
        ...itemsCount[0],
        generated_at: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Database performance test
app.get('/db-performance', async (req, res) => {
  const operations = [];
  const startTime = Date.now();
  
  try {
    // Test multiple operations
    const selectStart = Date.now();
    await pool.query('SELECT COUNT(*) FROM items');
    operations.push({ operation: 'SELECT COUNT', duration: Date.now() - selectStart });
    
    const joinStart = Date.now();
    await pool.query('SELECT i.name, o.total FROM items i LEFT JOIN orders o ON i.id = o.id LIMIT 10');
    operations.push({ operation: 'JOIN QUERY', duration: Date.now() - joinStart });
    
    const insertStart = Date.now();
    await pool.query('INSERT INTO orders (total) VALUES (?)', [Math.random() * 100]);
    operations.push({ operation: 'INSERT', duration: Date.now() - insertStart });
    
    const totalDuration = Date.now() - startTime;
    
    res.json({
      success: true,
      totalDuration: `${totalDuration}ms`,
      operations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Intentional error test
app.get('/error-test', (req, res) => {
  throw new Error('This is a test error for dashboard testing');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Socket.IO test with enhanced logging
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send welcome message
  socket.emit('server-message', { 
    message: 'Socket.IO connected successfully',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
  
  socket.on('test-message', (data) => {
    console.log('Received test message:', data);
    socket.emit('test-response', { 
      message: 'Server received your message', 
      data,
      responseTime: new Date().toISOString(),
      socketId: socket.id
    });
  });
  
  socket.on('dashboard-ping', (data) => {
    socket.emit('dashboard-pong', {
      message: 'Pong from server',
      timestamp: new Date().toISOString(),
      originalData: data
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard available at: http://localhost:${PORT}/dashboard`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
