# RMS Hosting Tester

Tests whether a **shared cPanel server** can reliably support the backend requirements of a production-style **Restaurant Management System** built with Node.js, Express, MySQL, and Socket.IO — before committing to a full migration from MongoDB.

---

## Project Purpose

This is **not** a complete RMS. It is a focused capability tester that verifies:

- Node.js 20+ running under Phusion Passenger on cPanel
- Express.js HTTP API
- MySQL with a connection pool
- MySQL transactions with `SELECT ... FOR UPDATE` row locking
- Concurrent request handling without race conditions
- Socket.IO / WebSockets over WSS (HTTPS)
- Environment variable loading
- Application restart and recovery behaviour

After successfully running all tests on the hosted server, you will have concrete evidence about whether the environment can support the RMS backend before beginning the full migration.

---

## Technologies

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express.js 4 |
| Database | MySQL 5.7+ / MariaDB 10.3+ |
| DB Driver | mysql2 (promise API) |
| Real-time | Socket.IO 4 |
| Config | dotenv |
| Hosting | cPanel + Phusion Passenger |

---

## Project Structure

```
rms-hosting-tester/
│
├── app.js                    # Main application server (Passenger entry point)
├── schema.sql                # Database schema (tables, indexes, foreign keys)
├── seed.js                   # Populates the database with 52 sample menu items
│
├── load-test.js              # External HTTP/HTTPS load tester
├── checkout-stress-test.js   # Concurrent checkout / inventory locking test
│
├── dashboard.html            # Browser-based API testing dashboard
├── dashboard.js              # Dashboard JavaScript
├── socket-test.html          # Browser Socket.IO test page (WSS compatible)
│
├── package.json
├── .env.example              # Template – copy to .env and fill in credentials
├── .gitignore
│
├── pre-commit-check.js       # Security pre-commit audit
└── prepare-deploy.js         # Deployment checklist helper
```

---

## Local Setup

### Prerequisites

- Node.js 20+
- MySQL 5.7+ or MariaDB 10.3+
- Git

### 1 – Clone and install

```bash
git clone https://github.com/Qasim-Ali252/rms-hosting-tester.git
cd rms-hosting-tester
npm install
```

### 2 – Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your local database credentials:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=rms_test
DB_CONNECTION_LIMIT=10

TEST_SECRET=any-non-empty-string
```

### 3 – Create the database

```sql
CREATE DATABASE rms_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or run the full schema script:

```bash
mysql -u root -p < schema.sql
```

### 4 – Seed sample data

```bash
npm run seed
```

This creates 52 menu items across categories (Starters, Grill, Pizza, Pasta, Rice, Desserts, Drinks, Specials) with realistic prices and stock quantities. Safe to re-run — skips if items already exist.

### 5 – Start the application

```bash
npm start
```

Access the dashboard at `http://localhost:3000/dashboard`  
Access the Socket.IO test page at `http://localhost:3000/socket-test.html`

---

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Liveness check — uptime, memory, Node version |
| GET | `/health/db` | MySQL connectivity check with round-trip latency |
| GET | `/` | API root confirmation |

### Environment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/env-test` | Confirms env vars are loaded — **never returns actual values** |

### Database & Reporting

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/db-test` | Basic DB connectivity + connection ID |
| GET | `/db-performance` | Runs JOIN queries, aggregates, movement history — measures each |
| GET | `/inventory` | Lists all menu items with current stock |
| GET | `/orders` | Lists 20 most recent orders |
| GET | `/report` | Sales summary (order count, revenue, avg order value) |
| GET | `/pos-test` | Quick DB latency check (used by load tester) |

### Checkout (core transaction test)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checkout` | Full POS checkout with transaction, row locking, rollback |

Request body:

```json
{
  "items": [
    { "itemId": 1, "quantity": 2 },
    { "itemId": 3, "quantity": 1 }
  ]
}
```

The checkout:
1. Starts a MySQL transaction
2. Locks the requested inventory rows with `SELECT ... FOR UPDATE`
3. Verifies every item exists
4. Verifies sufficient stock
5. Calculates the total **server-side** (never trusts client prices)
6. Creates the order record
7. Creates order_items records
8. Deducts inventory
9. Creates stock_movements records
10. COMMITs (or ROLLBACKs on any failure)
11. Emits `order:created` and `inventory:updated` via Socket.IO

Successful response:

```json
{
  "success": true,
  "orderId": 42,
  "total": 1250,
  "itemCount": 2,
  "durationMs": 14
}
```

Insufficient stock response (HTTP 422):

```json
{
  "success": false,
  "message": "Insufficient stock",
  "details": ["\"Beef Burger\": requested 5, available 2"]
}
```

### Error Test

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/error-test` | Intentionally triggers the error handler |

---

## Database Schema

```
items
  id          INT UNSIGNED AUTO_INCREMENT PK
  name        VARCHAR(255)
  category    VARCHAR(100)
  price       DECIMAL(10,2)
  stock       INT
  created_at  DATETIME

orders
  id          INT UNSIGNED AUTO_INCREMENT PK
  total       DECIMAL(10,2)
  status      ENUM('completed','failed','pending')
  created_at  DATETIME

order_items
  id          INT UNSIGNED AUTO_INCREMENT PK
  order_id    INT UNSIGNED  FK → orders.id
  item_id     INT UNSIGNED  FK → items.id
  quantity    INT
  price       DECIMAL(10,2)   (price at time of order)
  subtotal    DECIMAL(10,2)

stock_movements
  id                  INT UNSIGNED AUTO_INCREMENT PK
  item_id             INT UNSIGNED  FK → items.id
  quantity            INT           (negative = deduction)
  movement_type       ENUM('sale','restock','adjustment')
  reference_order_id  INT UNSIGNED  FK → orders.id (nullable)
  created_at          DATETIME
```

Indexes are defined on all foreign key columns and `orders.created_at` for realistic query performance.

---

## Socket.IO Events

### Server → Client

| Event | When emitted |
|-------|-------------|
| `server-message` | On every new connection |
| `test:pong` | In response to `test:ping` |
| `test-response` | In response to `test-message` (legacy) |
| `order:created` | After a successful `/checkout` |
| `inventory:updated` | After inventory is deducted by checkout |
| `dashboard-pong` | In response to `dashboard-ping` |

### Client → Server

| Event | Purpose |
|-------|---------|
| `test:ping` | Latency test |
| `test-message` | Legacy message test (dashboard) |
| `order:new` | Manual order trigger from test page |
| `dashboard-ping` | Dashboard ping test |

### Browser Test Page

Open `http://localhost:3000/socket-test.html` (or `https://yourdomain.com/socket-test.html` after deployment).

The page lets you:
- Enter any server URL and connect
- See connection status, socket ID, and transport type (websocket/polling)
- Send `test:ping` and see round-trip latency
- Simulate `order:new` events
- Watch `order:created` and `inventory:updated` events arrive in real time
- Monitor automatic reconnection after an application restart

---

## Load Testing

> ⚠️ Run from your **local machine** or another **external server**.  
> Never run load tests from the cPanel server itself.

```bash
# Basic run (defaults: 20 concurrent, 200 requests)
TARGET_URL=https://yourdomain.com node load-test.js

# Custom configuration
TARGET_URL=https://yourdomain.com \
CONCURRENT_USERS=50 \
TOTAL_REQUESTS=500 \
node load-test.js
```

Endpoints tested (weighted):
- `/pos-test` — 70% of requests
- `/inventory` — 20% of requests
- `/report` — 10% of requests

Automatically selects `http` or `https` based on the URL.

### Recommended test levels

Run at each level and record the results:

| Level | `CONCURRENT_USERS` | `TOTAL_REQUESTS` |
|-------|-------------------|-----------------|
| 1 | 10 | 100 |
| 2 | 25 | 250 |
| 3 | 50 | 500 |

For each level, record: Success Rate, Average Response Time, Max Response Time, Requests/Second.

### Understanding results

Response times depend on:
- Your location relative to the server
- Current shared hosting load
- MySQL server load
- Network latency
- Number of Passenger workers

Do not compare against arbitrary benchmarks. Focus on the **success rate** and **error rate** at each concurrency level.

---

## Concurrent Checkout Stress Test

This is the most important test for validating transaction safety.

### Setup

Before running, set a known stock level for item 1:

```sql
UPDATE items SET stock = 10 WHERE id = 1;
```

### Run

```bash
TARGET_URL=https://yourdomain.com \
CONCURRENT_REQUESTS=20 \
ITEM_ID=1 \
QUANTITY=1 \
node checkout-stress-test.js
```

### What happens

20 requests fire simultaneously, each attempting to buy 1 unit of item 1 (which has 10 in stock).

### Expected result

```
Concurrent Requests:     20
Successful Orders:       10
Failed Orders:           10
Initial Stock:           10
Final Stock:             0
Negative Stock Detected: NO
```

### What it proves

- MySQL `SELECT ... FOR UPDATE` correctly prevents concurrent threads from reading stale stock counts
- Only 10 orders succeed — the remaining 10 get a clean HTTP 422 (Insufficient stock)
- Inventory never goes below 0
- All failed transactions are rolled back completely

---

## cPanel Deployment

### Requirements

- cPanel hosting with **Node.js Selector** (Passenger)
- Node.js 20.x available
- MySQL database

### Step 1 – Create the MySQL database

In cPanel → MySQL Databases:
1. Create database: `yourusername_rms_test`
2. Create user: `yourusername_rmsuser` with a strong password
3. Add user to database with ALL PRIVILEGES

### Step 2 – Upload files

Upload all files **except** `node_modules/` and `.env` to your hosting directory (e.g. `/home/username/rms-hosting-tester/`).

Files to upload:
```
app.js
package.json
package-lock.json
schema.sql
seed.js
load-test.js
checkout-stress-test.js
dashboard.html
dashboard.js
socket-test.html
pre-commit-check.js
prepare-deploy.js
.env.example
README.md
```

### Step 3 – Create the Node.js application in cPanel

cPanel → Node.js → Create Application:

| Setting | Value |
|---------|-------|
| Node.js version | 20.x (latest available) |
| Application mode | Production |
| Application root | `/home/username/rms-hosting-tester` |
| Application URL | Your domain or subdomain |
| Application startup file | `app.js` |

### Step 4 – Set environment variables

In the Node.js application panel, add these environment variables:

```
NODE_ENV          production
DB_HOST           localhost
DB_PORT           3306
DB_USER           yourusername_rmsuser
DB_PASSWORD       your_strong_password
DB_NAME           yourusername_rms_test
DB_CONNECTION_LIMIT  10
TEST_SECRET       any-non-empty-string
```

Do not set `PORT` — Passenger assigns it automatically.

### Step 5 – Install dependencies

In the Node.js application panel, click **Run NPM Install** or open the terminal:

```bash
npm install --production
```

### Step 6 – Set up the database

```bash
mysql -u yourusername_rmsuser -p yourusername_rms_test < schema.sql
node seed.js
```

Or import `schema.sql` via cPanel → phpMyAdmin, then run `node seed.js`.

### Step 7 – Start the application

Click **Start** in the Node.js application panel.

### Step 8 – Verify

```bash
curl https://yourdomain.com/health
curl https://yourdomain.com/health/db
curl https://yourdomain.com/env-test
```

All should return `"success": true`.

---

## Application Restart Testing

This verifies Passenger can recover the application reliably.

1. Open `https://yourdomain.com/health` — confirm it works
2. Open `https://yourdomain.com/socket-test.html` — connect via Socket.IO
3. In cPanel → Node.js → click **Restart**
4. Watch the Socket.IO test page — it should show "Reconnecting" then "Connected" automatically
5. Call `https://yourdomain.com/health` again — should return `200 OK`
6. Run a checkout to confirm transactions still work after restart

Expected behaviour: The application restarts within a few seconds, the Socket.IO client reconnects automatically (up to 10 attempts), and all endpoints respond normally.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | `production` disables stack traces in error responses |
| `PORT` | No | `3000` | Set automatically by Passenger on cPanel |
| `DB_HOST` | Yes | `localhost` | MySQL server host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | Yes | — | MySQL username |
| `DB_PASSWORD` | Yes | — | MySQL password |
| `DB_NAME` | Yes | — | Database name |
| `DB_CONNECTION_LIMIT` | No | `10` | Connection pool size |
| `TEST_SECRET` | Yes | — | Any string — confirms env vars are loaded |

---

## Testing Checklist

Use this after deploying to cPanel.

### Basic Deployment

- [ ] Node.js application starts in cPanel
- [ ] `GET /health` returns `200 OK`
- [ ] Application is accessible through the public domain
- [ ] HTTPS works (SSL certificate active)
- [ ] `GET /env-test` returns `"Configured"` for all variables
- [ ] Application restart works (cPanel → Node.js → Restart)

### Database

- [ ] `GET /health/db` returns `"database": "connected"`
- [ ] `GET /db-test` returns server time and connection ID
- [ ] Connection pool is reused across multiple requests
- [ ] `GET /db-performance` completes without errors
- [ ] Foreign key relationships are active (run checkout, check order_items)

### Checkout / Transactions

- [ ] `POST /checkout` creates an order successfully
- [ ] order_items records are created
- [ ] Inventory is deducted after checkout
- [ ] stock_movements records are created
- [ ] Rollback works: checkout with quantity > stock returns HTTP 422, no partial data

### Concurrent Safety

- [ ] Checkout stress test completes
- [ ] Final stock is ≥ 0 (never negative)
- [ ] Successful orders ≤ initial stock
- [ ] Failed orders receive HTTP 422 (not 500)

### Real-Time (Socket.IO)

- [ ] `socket-test.html` connects via WSS (WebSocket Secure)
- [ ] `test:ping` → `test:pong` works
- [ ] `order:created` event received after `/checkout`
- [ ] `inventory:updated` event received after `/checkout`
- [ ] Client reconnects automatically after application restart

### Performance

- [ ] Load test Level 1 (10 concurrent) completed — results recorded
- [ ] Load test Level 2 (25 concurrent) completed — results recorded
- [ ] Load test Level 3 (50 concurrent) completed — results recorded
- [ ] Checkout stress test (20 concurrent) completed — results recorded
- [ ] `GET /db-performance` response times recorded

---

## Result Evaluation

There are no hardcoded pass/fail response time thresholds because performance depends heavily on server location, shared hosting load, and network conditions.

Focus on these questions:

1. **Success rate** — Does it stay above 95% at 25 concurrent users?
2. **Transaction safety** — Does the stress test confirm zero negative stock?
3. **Recovery** — Does the app restart and reconnect within an acceptable time?
4. **Stability** — Do error rates increase significantly under sustained load?

If the hosting passes transaction safety tests and maintains reasonable success rates at 25+ concurrent users, it is capable of supporting the RMS backend under realistic restaurant traffic.

---

## Quick Reference Commands

```bash
# Local development
npm start

# Seed database
npm run seed

# Load test (run from local machine)
TARGET_URL=https://yourdomain.com CONCURRENT_USERS=20 TOTAL_REQUESTS=200 node load-test.js

# Checkout stress test (run from local machine)
TARGET_URL=https://yourdomain.com CONCURRENT_REQUESTS=20 ITEM_ID=1 QUANTITY=1 node checkout-stress-test.js

# Security pre-commit check
npm run security-check

# Deployment checklist
npm run prepare-deploy
```
