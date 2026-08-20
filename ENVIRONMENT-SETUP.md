# 🔐 Environment Configuration Guide

## 🛡️ **Security First Setup**

This guide helps you securely configure your environment variables for both **local development** and **production deployment**.

## 📁 **Environment Files Overview**

| File | Purpose | Include in Git? |
|------|---------|-----------------|
| `.env.production` | Template for production | ✅ **YES** (no real secrets) |
| `.env` | Your actual local config | ❌ **NO** (contains real secrets) |
| `.gitignore` | Protects sensitive files | ✅ **YES** |

## 🔧 **Local Development Setup**

### Step 1: Create Your Local Environment File
```bash
# Copy the template
cp .env.production .env

# Edit with your local database details
nano .env  # or use any text editor
```

### Step 2: Configure for Local MySQL
```env
# Local Development Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=rms_test
TEST_SECRET=local_development_secret_key
PORT=3001
NODE_ENV=development
```

### Step 3: Create Local Database
```sql
-- Connect to MySQL and run:
CREATE DATABASE rms_test;
CREATE USER 'rmsuser'@'localhost' IDENTIFIED BY 'secure_local_password';
GRANT ALL PRIVILEGES ON rms_test.* TO 'rmsuser'@'localhost';
FLUSH PRIVILEGES;
```

## 🌐 **Production (cPanel) Setup**

### Step 1: Create cPanel Database
1. **cPanel → MySQL Databases**
2. **Create Database**: `yourusername_rmstest`
3. **Create User**: `yourusername_rmsuser`
4. **Set Strong Password**: Use password generator
5. **Add User to Database**: Grant ALL PRIVILEGES

### Step 2: Configure Production Environment
```env
# Production Configuration Example
DB_HOST=localhost
DB_USER=mysite_rmsuser
DB_PASSWORD=Xy9$kL2@mN4pR7!qW
DB_NAME=mysite_rmstest
TEST_SECRET=prod_secret_Bz8#nK5@tY3vC9!
PORT=3000
NODE_ENV=production
```

### Step 3: Secure Environment Variable Management

**Option A: cPanel Node.js Environment Variables**
1. Go to **cPanel → Node.js Apps**
2. Select your application
3. **Environment Variables** section
4. Add each variable individually

**Option B: Server .env File**
1. Upload `.env` file to your app directory
2. **Ensure it's outside public_html** if possible
3. **Set file permissions**: `chmod 600 .env`

## 🔒 **Security Best Practices**

### ✅ **Do's**
- **Use strong passwords**: Mix of letters, numbers, symbols
- **Different passwords**: Never reuse database passwords
- **Limit database permissions**: Only grant necessary privileges
- **Use environment variables**: Never hardcode secrets
- **Regular password rotation**: Change passwords periodically

### ❌ **Don'ts**
- **Don't commit .env files** with real secrets
- **Don't use default passwords** (root, admin, 123456)
- **Don't share credentials** via email or chat
- **Don't use production data** in development
- **Don't store secrets** in code or documentation

## 🔑 **Password Generation Examples**

### Strong Database Password Examples:
```
Kp9$mL7@nR4sT8!    (16 characters, mixed case, symbols)
Bv6#xC3@yQ9wE2!    (16 characters, high entropy)
Nz5$jK8@tM1pL4!    (16 characters, random)
```

### Strong TEST_SECRET Examples:
```
app_secret_Dx7#kM2@vN9sQ4!
test_key_Fy3$pL8@wR6tJ9!
auth_token_Hz4#nC7@yK2sM8!
```

## 🧪 **Environment Validation**

### Test Your Configuration:
```bash
# Start the application
npm start

# Test environment endpoint
curl http://localhost:3001/env-test

# Expected response:
{"environment":"Working","TEST_SECRET":"your_secret_here"}
```

### Validate Database Connection:
```bash
# Test database endpoint  
curl http://localhost:3001/db-test

# Expected response:
{"success":true,"database":"Connected","serverTime":"..."}
```

## 🚨 **Emergency Procedures**

### If Credentials Are Compromised:
1. **Immediately change** all affected passwords
2. **Revoke database access** for old credentials
3. **Update environment variables** on all systems
4. **Restart applications** to use new credentials
5. **Review access logs** for suspicious activity

### If .env File Is Accidentally Committed:
1. **Remove from repository**: `git rm --cached .env`
2. **Change all passwords** in the committed file
3. **Update .gitignore**: Ensure `.env` is ignored
4. **Force push** if repository is private
5. **Consider repository as compromised** if public

## 📋 **Environment Checklist**

### Local Development:
- [ ] `.env` file created and configured
- [ ] Database connection working
- [ ] `.env` added to .gitignore  
- [ ] No real secrets in code
- [ ] Application starts without errors

### Production Deployment:
- [ ] cPanel database created
- [ ] Strong passwords generated
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Application deployed successfully
- [ ] All endpoints responding correctly

## 🛠️ **Troubleshooting**

### Common Issues:

**"Environment variable not found"**
- Check `.env` file exists
- Verify variable names match exactly
- Restart application after changes

**"Database connection failed"**
- Verify database exists and user has access
- Check host, username, password
- Confirm database server is running

**"TEST_SECRET missing"**
- Ensure TEST_SECRET is set in .env
- Check for typos in variable name
- Verify .env file is in correct directory

## 📚 **Additional Resources**

- **MySQL Security**: [MySQL Security Best Practices](https://dev.mysql.com/doc/refman/8.0/en/security.html)
- **Node.js Security**: [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
- **cPanel Documentation**: Check your hosting provider's specific guides

---

**Remember**: Security is not optional. Always use strong, unique passwords and never commit secrets to version control! 🔐