-- ============================================================
-- RMS Hosting Tester - Database Schema
-- Compatible with MySQL 5.7+ / MariaDB 10.3+
-- Run: mysql -u user -p dbname < schema.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- items  (menu / inventory)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255)   NOT NULL,
  category   VARCHAR(100)   NOT NULL DEFAULT 'General',
  price      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  stock      INT            NOT NULL DEFAULT 0,
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- orders  (one record per POS checkout)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  total      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  status     ENUM('completed','failed','pending') NOT NULL DEFAULT 'completed',
  created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_orders_created_at (created_at),
  INDEX idx_orders_status     (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- order_items  (line items per order)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id       INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED   NOT NULL,
  item_id  INT UNSIGNED   NOT NULL,
  quantity INT            NOT NULL DEFAULT 1,
  price    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  INDEX idx_oi_order_id (order_id),
  INDEX idx_oi_item_id  (item_id),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_item  FOREIGN KEY (item_id)  REFERENCES items(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- stock_movements  (inventory audit trail)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id                 INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  item_id            INT UNSIGNED   NOT NULL,
  quantity           INT            NOT NULL,
  movement_type      ENUM('sale','restock','adjustment') NOT NULL,
  reference_order_id INT UNSIGNED   NULL DEFAULT NULL,
  created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sm_item_id    (item_id),
  INDEX idx_sm_ref_order  (reference_order_id),
  INDEX idx_sm_created_at (created_at),
  CONSTRAINT fk_sm_item  FOREIGN KEY (item_id)            REFERENCES items(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_sm_order FOREIGN KEY (reference_order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
