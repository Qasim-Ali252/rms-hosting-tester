# cPanel Deployment Checklist ✅

## Before You Start
- [ ] Have cPanel login credentials ready
- [ ] Know your domain/subdomain for the app
- [ ] Have FTP/File Manager access

## Database Setup
- [ ] Created MySQL database in cPanel
- [ ] Created database user with strong password
- [ ] Added user to database with ALL PRIVILEGES
- [ ] Noted database connection details

## File Upload
- [ ] Uploaded all project files (except node_modules)
- [ ] Verified all files uploaded correctly
- [ ] Set proper file permissions (644 for files)

## Environment Configuration  
- [ ] Updated .env with production database details
- [ ] Changed TEST_SECRET to production value
- [ ] Verified all environment variables

## Node.js App Setup
- [ ] Created Node.js application in cPanel
- [ ] Set application root folder correctly
- [ ] Set startup file to app.js
- [ ] Selected appropriate Node.js version
- [ ] Set application mode to Production

## Dependencies Installation
- [ ] Ran npm install (via terminal or cPanel interface)
- [ ] Verified no installation errors
- [ ] Confirmed all dependencies installed

## Database Seeding
- [ ] Ran seed-db.js to create tables and test data
- [ ] Verified tables created successfully
- [ ] Confirmed sample data inserted

## Application Testing
- [ ] Started the application in cPanel
- [ ] Tested health check endpoint (/)
- [ ] Tested environment variables (/env-test)
- [ ] Tested database connection (/db-test)
- [ ] Tested performance endpoint (/pos-test)
- [ ] Tested Socket.IO connection
- [ ] Ran basic load test from local machine

## Production Optimization
- [ ] Enabled HTTPS (if available)
- [ ] Set up monitoring/logging
- [ ] Documented the production URL
- [ ] Created backup of working configuration

## Final Verification
- [ ] All endpoints responding correctly
- [ ] Socket.IO working properly  
- [ ] Database operations functioning
- [ ] No errors in application logs
- [ ] Performance acceptable under load

## Documentation
- [ ] Recorded production database details (securely)
- [ ] Noted application URL
- [ ] Documented any hosting-specific configurations
- [ ] Created maintenance/update procedures