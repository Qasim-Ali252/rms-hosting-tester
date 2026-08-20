/**
 * prepare-deploy.js
 *
 * Deployment readiness checker.
 * Run: npm run prepare-deploy
 */

const fs = require('fs');

console.log('\n🚀 RMS Hosting Tester – Deployment Readiness Check\n');

// Files to include in deployment
const DEPLOY_FILES = [
  'app.js',
  'package.json',
  'package-lock.json',
  'schema.sql',
  'seed.js',
  'load-test.js',
  'checkout-stress-test.js',
  'dashboard.html',
  'dashboard.js',
  'socket-test.html',
  'pre-commit-check.js',
  'prepare-deploy.js',
  '.env.example',
  'README.md',
  '.gitignore',
];

// Files to explicitly exclude
const EXCLUDE_FILES = [
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '.env.production',
];

console.log('✅ Files to upload to cPanel:\n');
let missing = 0;
DEPLOY_FILES.forEach((file) => {
  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size;
    console.log(`   ${file.padEnd(35)} (${size} bytes)`);
  } else {
    console.log(`   ❌ MISSING: ${file}`);
    missing++;
  }
});

console.log('\n🚫 Files to EXCLUDE from cPanel upload:\n');
EXCLUDE_FILES.forEach((file) => {
  console.log(`   ${file}`);
});

if (missing > 0) {
  console.log(`\n❌ ${missing} required file(s) are missing. Fix before deploying.\n`);
  process.exit(1);
}

console.log('\n📋 cPanel Deployment Steps:\n');
console.log('  1. Create MySQL database and user in cPanel → MySQL Databases');
console.log('     DB name:  yourusername_rms_test');
console.log('     DB user:  yourusername_rmsuser  (ALL PRIVILEGES)');
console.log('');
console.log('  2. Upload the files listed above via File Manager or FTP');
console.log('     Target directory: /home/username/rms-hosting-tester/');
console.log('');
console.log('  3. Create Node.js application in cPanel → Node.js');
console.log('     Node.js version:  20.x');
console.log('     Application mode: Production');
console.log('     Application root: /home/username/rms-hosting-tester');
console.log('     Startup file:     app.js');
console.log('');
console.log('  4. Add environment variables in the Node.js panel:');
console.log('     NODE_ENV          production');
console.log('     DB_HOST           localhost');
console.log('     DB_PORT           3306');
console.log('     DB_USER           yourusername_rmsuser');
console.log('     DB_PASSWORD       <your password>');
console.log('     DB_NAME           yourusername_rms_test');
console.log('     DB_CONNECTION_LIMIT  10');
console.log('     TEST_SECRET       <any non-empty string>');
console.log('');
console.log('  5. Click "Run NPM Install" in the Node.js panel');
console.log('');
console.log('  6. Set up the database:');
console.log('     Option A: Import schema.sql via phpMyAdmin');
console.log('     Option B: mysql -u user -p dbname < schema.sql');
console.log('');
console.log('  7. Seed the database:');
console.log('     node seed.js');
console.log('');
console.log('  8. Start the application in the Node.js panel');
console.log('');
console.log('  9. Verify deployment:');
console.log('     curl https://yourdomain.com/health');
console.log('     curl https://yourdomain.com/health/db');
console.log('     curl https://yourdomain.com/env-test');
console.log('');
console.log('  10. Open the test pages:');
console.log('     https://yourdomain.com/dashboard');
console.log('     https://yourdomain.com/socket-test.html');
console.log('');
console.log('📖 See README.md for complete instructions.\n');
