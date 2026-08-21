/**
 * seed.js
 * Populates the database with realistic sample data for testing.
 * Safe to run multiple times - skips if data already exists.
 *
 * Usage:
 *   node seed.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// ---------------------------------------------------------------
// Sample menu items grouped by category
// ---------------------------------------------------------------
const MENU_ITEMS = [
  // Starters
  { name: 'Spring Rolls (4 pcs)',     category: 'Starters',   price: 350,  stock: 80 },
  { name: 'Chicken Wings (6 pcs)',    category: 'Starters',   price: 550,  stock: 60 },
  { name: 'Garlic Bread',             category: 'Starters',   price: 200,  stock: 100 },
  { name: 'Soup of the Day',          category: 'Starters',   price: 280,  stock: 70 },
  { name: 'Caesar Salad',             category: 'Starters',   price: 420,  stock: 50 },

  // Mains - Grill
  { name: 'Beef Burger',              category: 'Grill',       price: 750,  stock: 40 },
  { name: 'Chicken Burger',           category: 'Grill',       price: 650,  stock: 45 },
  { name: 'BBQ Ribs (Half Rack)',     category: 'Grill',       price: 1200, stock: 25 },
  { name: 'Grilled Chicken Platter',  category: 'Grill',       price: 900,  stock: 35 },
  { name: 'Club Sandwich',            category: 'Grill',       price: 580,  stock: 55 },

  // Mains - Pizza
  { name: 'Margherita Pizza (9")',    category: 'Pizza',       price: 700,  stock: 30 },
  { name: 'Pepperoni Pizza (9")',     category: 'Pizza',       price: 850,  stock: 28 },
  { name: 'BBQ Chicken Pizza (9")',   category: 'Pizza',       price: 900,  stock: 25 },
  { name: 'Veggie Pizza (9")',        category: 'Pizza',       price: 750,  stock: 22 },
  { name: 'Four Cheese Pizza (9")',   category: 'Pizza',       price: 950,  stock: 20 },

  // Mains - Pasta
  { name: 'Spaghetti Bolognese',      category: 'Pasta',       price: 680,  stock: 40 },
  { name: 'Penne Arrabbiata',         category: 'Pasta',       price: 620,  stock: 35 },
  { name: 'Chicken Alfredo',          category: 'Pasta',       price: 780,  stock: 30 },
  { name: 'Lasagne',                  category: 'Pasta',       price: 820,  stock: 20 },
  { name: 'Mac & Cheese',             category: 'Pasta',       price: 550,  stock: 45 },

  // Mains - Rice & Sides
  { name: 'Chicken Biryani',          category: 'Rice',        price: 850,  stock: 50 },
  { name: 'Vegetable Fried Rice',     category: 'Rice',        price: 550,  stock: 60 },
  { name: 'Prawn Fried Rice',         category: 'Rice',        price: 950,  stock: 35 },
  { name: 'Steamed Rice',             category: 'Rice',        price: 150,  stock: 200 },
  { name: 'French Fries (Large)',     category: 'Sides',       price: 280,  stock: 150 },
  { name: 'Onion Rings',              category: 'Sides',       price: 260,  stock: 90 },
  { name: 'Coleslaw',                 category: 'Sides',       price: 180,  stock: 110 },
  { name: 'Garlic Mashed Potato',     category: 'Sides',       price: 320,  stock: 80 },

  // Desserts
  { name: 'Chocolate Lava Cake',      category: 'Desserts',    price: 480,  stock: 30 },
  { name: 'Vanilla Ice Cream (2 scoops)', category: 'Desserts',price: 300,  stock: 50 },
  { name: 'Tiramisu',                 category: 'Desserts',    price: 420,  stock: 25 },
  { name: 'Cheesecake Slice',         category: 'Desserts',    price: 390,  stock: 30 },
  { name: 'Brownie with Ice Cream',   category: 'Desserts',    price: 450,  stock: 28 },

  // Beverages - Hot
  { name: 'Espresso',                 category: 'Hot Drinks',  price: 180,  stock: 200 },
  { name: 'Cappuccino',               category: 'Hot Drinks',  price: 250,  stock: 200 },
  { name: 'Latte',                    category: 'Hot Drinks',  price: 280,  stock: 200 },
  { name: 'Green Tea',                category: 'Hot Drinks',  price: 160,  stock: 150 },
  { name: 'Hot Chocolate',            category: 'Hot Drinks',  price: 300,  stock: 150 },

  // Beverages - Cold
  { name: 'Coca-Cola (330ml)',        category: 'Cold Drinks', price: 120,  stock: 300 },
  { name: 'Sprite (330ml)',           category: 'Cold Drinks', price: 120,  stock: 300 },
  { name: 'Mineral Water (500ml)',    category: 'Cold Drinks', price: 80,   stock: 400 },
  { name: 'Fresh Orange Juice',       category: 'Cold Drinks', price: 320,  stock: 120 },
  { name: 'Mango Smoothie',           category: 'Cold Drinks', price: 380,  stock: 100 },
  { name: 'Lemonade',                 category: 'Cold Drinks', price: 250,  stock: 150 },
  { name: 'Iced Coffee',              category: 'Cold Drinks', price: 350,  stock: 120 },
  { name: 'Mint Lemonade',            category: 'Cold Drinks', price: 280,  stock: 130 },

  // Specials
  { name: 'Today\'s Special Combo',   category: 'Specials',   price: 1100, stock: 15 },
  { name: 'Family Platter',           category: 'Specials',   price: 2500, stock: 10 },
  { name: 'Kids Meal',                category: 'Specials',   price: 480,  stock: 20 },
  { name: 'Happy Hour Deal',          category: 'Specials',   price: 600,  stock: 18 },
];

async function seed() {
  const pool = mysql.createPool({
    host:             process.env.DB_HOST     || 'localhost',
    port:             process.env.DB_PORT     || 3306,
    user:             process.env.DB_USER     || 'root',
    password:         process.env.DB_PASSWORD || '',
    database:         process.env.DB_NAME     || 'rms_test',
    waitForConnections: true,
    connectionLimit:  5,
  });

  const conn = await pool.getConnection();
  try {
    console.log('🌱 Starting database seed...\n');

    // ----------------------------------------------------------
    // Create tables if they don't exist
    // (mirrors schema.sql so seed.js can be run standalone)
    // ----------------------------------------------------------
    // Disable FK checks during setup to avoid ordering issues
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Drop tables that may exist with incompatible schema from older versions
    // (old seed-db.js used signed INT instead of INT UNSIGNED — causes FK errno 150)
    await conn.query('DROP TABLE IF EXISTS stock_movements');
    await conn.query('DROP TABLE IF EXISTS order_items');
    await conn.query('DROP TABLE IF EXISTS orders');
    await conn.query('DROP TABLE IF EXISTS items');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS items (
        id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        name       VARCHAR(255)    NOT NULL,
        category   VARCHAR(100)    NOT NULL DEFAULT 'General',
        price      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        stock      INT             NOT NULL DEFAULT 0,
        created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_items_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        total      DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        status     ENUM('completed','failed','pending') NOT NULL DEFAULT 'completed',
        created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_orders_created_at (created_at),
        INDEX idx_orders_status     (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        order_id INT UNSIGNED    NOT NULL,
        item_id  INT UNSIGNED    NOT NULL,
        quantity INT             NOT NULL DEFAULT 1,
        price    DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
        PRIMARY KEY (id),
        INDEX idx_oi_order_id (order_id),
        INDEX idx_oi_item_id  (item_id),
        CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_oi_item  FOREIGN KEY (item_id)  REFERENCES items(id)  ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id                 INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        item_id            INT UNSIGNED    NOT NULL,
        quantity           INT             NOT NULL,
        movement_type      ENUM('sale','restock','adjustment') NOT NULL,
        reference_order_id INT UNSIGNED    NULL DEFAULT NULL,
        created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_sm_item_id    (item_id),
        INDEX idx_sm_ref_order  (reference_order_id),
        INDEX idx_sm_created_at (created_at),
        CONSTRAINT fk_sm_item  FOREIGN KEY (item_id)            REFERENCES items(id)  ON DELETE RESTRICT,
        CONSTRAINT fk_sm_order FOREIGN KEY (reference_order_id) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Re-enable FK checks now that all tables exist
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ Tables verified / created.\n');

    // ----------------------------------------------------------
    // Seed items - skip if already populated
    // ----------------------------------------------------------
    const [[{ count: itemCount }]] = await conn.query('SELECT COUNT(*) AS count FROM items');

    if (Number(itemCount) > 0) {
      console.log(`ℹ️  Items table already has ${itemCount} rows. Skipping item seed.`);
      console.log('   To reseed items, run: node seed.js --fresh\n');
    } else {
      const rows = MENU_ITEMS.map(i => [i.name, i.category, i.price, i.stock]);
      await conn.query(
        'INSERT INTO items (name, category, price, stock) VALUES ?',
        [rows]
      );
      console.log(`✅ Seeded ${MENU_ITEMS.length} menu items.\n`);
    }

    // ----------------------------------------------------------
    // Summary
    // ----------------------------------------------------------
    const [[{ totalItems }]]       = await conn.query('SELECT COUNT(*) AS totalItems FROM items');
    const [[{ totalOrders }]]      = await conn.query('SELECT COUNT(*) AS totalOrders FROM orders');
    const [[{ totalOrderItems }]]  = await conn.query('SELECT COUNT(*) AS totalOrderItems FROM order_items');
    const [[{ totalMovements }]]   = await conn.query('SELECT COUNT(*) AS totalMovements FROM stock_movements');

    console.log('📊 Database summary:');
    console.log(`   items:           ${totalItems}`);
    console.log(`   orders:          ${totalOrders}`);
    console.log(`   order_items:     ${totalOrderItems}`);
    console.log(`   stock_movements: ${totalMovements}`);
    console.log('\n🎉 Seed complete. Database is ready for testing.\n');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

seed();
