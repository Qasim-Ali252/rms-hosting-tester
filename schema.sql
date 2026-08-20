-- ============================================================
-- RMS Hosting Tester - Database Schema
-- Designed to simulate realistic restaurant operations
-- Compatible with MySQL 5.7+ / MariaDB 10.3+
-- ============================================================

-- Create the database if it does not already exist
CREATE DATABASE IF NOT EXISTS rms_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rms_test;

-- ------------------------------------------------------------
-- items
-- Represents the restaurant menu / inventory
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)   NOT NULL,
  category      VARCHAR(100)   NOT NULL DEFAULT 'General',
  price         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  stock         INT            NOT NULL DEFAULT 0,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- orders
-- One record per completed or rolled-back POS checkout
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  total       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status      ENUM('completed','failed','pending') NOT NULL DEFAULT 'completed',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_orders_created_at (created_at),
  INDEX idx_orders_status     (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- order_items
-- Line items belonging to each order
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  item_id    INT UNSIGNED NOT NULL,
  quantity   INT          NOT NULL DEFAULT 1,
  price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,   -- price at time of order
  subtotal   DECIMAL(10,2) NOT NULL DEFAULT 0.00,   -- quantity * price

  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id)   ON DELETE CASCADE,
  CONSTRAINT fk_oi_item  FOREIGN KEY (item_id)  REFERENCES items(id)    ON DELETE RESTRICT,

  INDEX idx_oi_order_id (order_id),
  INDEX idx_oi_item_id  (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- stock_movements
-- Audit trail for every inventory change
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id           INT UNSIGNED NOT NULL,
  quantity          INT          NOT NULL,                          -- negative = deduction
  movement_type     ENUM('sale','restock','adjustment') NOT NULL,
  reference_order_id INT UNSIGNED NULL DEFAULT NULL,               -- NULL for non-sale movements
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sm_item  FOREIGN KEY (item_id)             REFERENCES items(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_sm_order FOREIGN KEY (reference_order_id)  REFERENCES orders(id) ON DELETE SET NULL,

  INDEX idx_sm_item_id    (item_id),
  INDEX idx_sm_ref_order  (reference_order_id),
  INDEX idx_sm_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
