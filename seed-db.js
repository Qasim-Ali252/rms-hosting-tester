require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    waitForConnections: true,
    connectionLimit: 5
  });

  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sku VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        qty INT DEFAULT 0,
        price DECIMAL(10,2) DEFAULT 0.00
      ) ENGINE=InnoDB;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total DECIMAL(10,2) DEFAULT 0.00
      ) ENGINE=InnoDB;
    `);

    const [rows] = await conn.query('SELECT COUNT(*) AS c FROM items');
    if (rows[0].c === 0) {
      const inserts = [];
      for (let i = 1; i <= 100; i++) {
        inserts.push([`SKU${i}`, `Item ${i}`, Math.floor(Math.random()*100), (Math.random()*100).toFixed(2)]);
      }
      await conn.query('INSERT INTO items (sku, name, qty, price) VALUES ?', [inserts]);
      console.log('Seeded items table with 100 rows');
    } else {
      console.log('Items table already has data, skipping seeding');
    }
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
