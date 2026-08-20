# cPanel Deployment Guide for RMS Hosting Test

## Pre-deployment Checklist

### 1. Files to Upload
Upload these files to your cPanel hosting:
```
rms-hosting-test/
├── app.js
├── package.json
├── package-lock.json
├── load-test.js
├── seed-db.js
├── socket-test.js
├── static-check.js
├── test-client.html
├── .env (configure for production)
└── DEPLOY-GUIDE.md
```

**DO NOT upload:**
- node_modules/ (will be installed on server)
- .git/ (if exists)

### 2. cPanel Requirements
- Node.js version 16+ support
- MySQL database access
- SSH access (recommended) or cPanel File Manager

## Deployment Steps

### Step 1: Create MySQL Database
1. Log into cPanel
2. Go to "MySQL Databases"
3. Create database: `yourusername_rmstest`
4. Create user: `yourusername_rmsuser`
5. Set password for user
6. Add user to database with ALL PRIVILEGES
7. Note down: hostname, database name, username, password

### Step 2: Upload Files
**Option A - File Manager:**
1. Open cPanel File Manager
2. Navigate to your domain's folder (usually public_html or a subdomain folder)
3. Create folder: `rms-hosting-test`
4. Upload all project files (except node_modules)

**Option B - FTP/SFTP:**
1. Use FileZilla or similar
2. Connect to your hosting
3. Navigate to appropriate folder
4. Upload project files

### Step 3: Configure Environment Variables
Edit `.env` file with your cPanel database details:
```
DB_HOST=localhost
DB_USER=yourusername_rmsuser
DB_PASSWORD=your_database_password
DB_NAME=yourusername_rmstest
TEST_SECRET=hello-rms-production
PORT=3000
```

### Step 4: Setup Node.js App in cPanel
1. Go to cPanel → "Node.js Apps" or "Node.js Selector"
2. Click "Create Application"
3. Fill in:
   - **Node.js version**: 18.x or latest available
   - **Application mode**: Production
   - **Application root**: `rms-hosting-test`
   - **Application URL**: Choose subdomain/path (e.g., `api-test.yourdomain.com`)
   - **Application startup file**: `app.js`
4. Click "Create"

### Step 5: Install Dependencies
**Option A - cPanel Terminal (if available):**
```bash
cd ~/rms-hosting-test
npm install
```

**Option B - cPanel Node.js App Interface:**
1. Go to your created app
2. Click "NPM Install"
3. Wait for installation to complete

### Step 6: Add Environment Variables in cPanel
In your Node.js App settings, add environment variables:
- `DB_HOST`: localhost
- `DB_USER`: your database user
- `DB_PASSWORD`: your database password  
- `DB_NAME`: your database name
- `TEST_SECRET`: hello-rms-production
- `PORT`: (usually set automatically by cPanel)

### Step 7: Seed the Database
Run the seeder (via SSH or cPanel terminal):
```bash
cd ~/rms-hosting-test
node seed-db.js
```

### Step 8: Start the Application
1. In cPanel Node.js Apps, click "Start App"
2. Note the URL provided (e.g., https://api-test.yourdomain.com)

## Testing Your Deployed App

### Basic Tests
1. **Health Check**: `https://your-app-url.com/`
2. **Environment**: `https://your-app-url.com/env-test`
3. **Database**: `https://your-app-url.com/db-test`
4. **Performance**: `https://your-app-url.com/pos-test`

### Socket.IO Test
1. Upload `test-client.html` to public folder
2. Access via browser: `https://yourdomain.com/test-client.html`
3. Enter your app URL when prompted

### Load Testing
Modify `load-test.js` target URL and run from your local machine:
```bash
TARGET=https://your-app-url.com/pos-test CONCURRENCY=10 REQUESTS=50 node load-test.js
```

## Common Issues & Solutions

### Issue 1: "Module not found" errors
- Run `npm install` in the app directory
- Check that package.json was uploaded

### Issue 2: Database connection fails  
- Verify database credentials in .env
- Check if database user has proper permissions
- Ensure database exists

### Issue 3: Port conflicts
- cPanel usually handles ports automatically
- Remove PORT from .env if causing issues
- Check cPanel logs for specific port assignments

### Issue 4: Socket.IO not working
- Ensure WebSocket support is enabled in hosting
- Check if hosting provider blocks WebSocket connections
- Test with polling transport only if needed

### Issue 5: File permission errors
- Set proper file permissions (644 for files, 755 for directories)
- Ensure app.js is executable

## Production Optimizations

### 1. Update package.json for production
```json
{
  "engines": {
    "node": ">=16.0.0"
  },
  "scripts": {
    "start": "NODE_ENV=production node app.js"
  }
}
```

### 2. Enable process management
Some hosts support PM2:
```bash
pm2 start app.js --name rms-test
```

### 3. Database optimization
- Add indexes for frequently queried fields
- Optimize connection pool size based on hosting limits
- Monitor slow queries

## Monitoring & Logs

### cPanel Logs
- Check Node.js app logs in cPanel
- Monitor error logs for issues
- Set up log rotation if needed

### Application Logs
Add logging middleware in production:
```javascript
// Add to app.js
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
```

## Security Notes

### For Production Deployment:
1. Use strong database passwords
2. Limit database user permissions
3. Enable HTTPS (usually available in cPanel)
4. Add rate limiting if needed
5. Validate all inputs
6. Keep dependencies updated

## Support

If you encounter issues:
1. Check cPanel error logs
2. Verify all environment variables
3. Test database connection separately
4. Contact your hosting provider if needed

## URLs to Test After Deployment
- `GET /` - Health check
- `GET /env-test` - Environment variables
- `GET /db-test` - Database connectivity  
- `GET /pos-test` - Performance test
- `GET /orders-test` - Orders endpoint
- `GET /inventory-test` - Inventory endpoint
- `GET /report-test` - Reports endpoint
- Socket.IO via test-client.html