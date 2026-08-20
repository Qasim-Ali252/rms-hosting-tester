const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing files for cPanel deployment...\n');

// Files that should be deployed
const deployFiles = [
  'app.js',
  'package.json',
  'package-lock.json',
  'dashboard.html',
  'dashboard.js',
  'load-test.js',
  'seed-db.js', 
  'socket-test.js',
  'static-check.js',
  'test-client.html',
  '.env.production',
  'DEPLOY-GUIDE.md',
  'DEPLOYMENT-CHECKLIST.md'
];

// Files to exclude from deployment
const excludeFiles = [
  'node_modules',
  '.git',
  '.env',
  'prepare-deploy.js'
];

console.log('✅ Files to deploy:');
deployFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    const size = stats.isDirectory() ? 'Directory' : `${stats.size} bytes`;
    console.log(`   ${file} (${size})`);
  } else {
    console.log(`   ❌ ${file} - NOT FOUND`);
  }
});

console.log('\n🚫 Files to exclude:');
excludeFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ${file} (excluded)`);
  }
});

console.log('\n📋 Deployment Steps:');
console.log('1. Create MySQL database in cPanel');
console.log('2. Upload the files listed above to your hosting');
console.log('3. Rename .env.production to .env and configure');
console.log('4. Create Node.js app in cPanel');
console.log('5. Run npm install');
console.log('6. Run node seed-db.js');  
console.log('7. Start the application');
console.log('8. Test all endpoints');

console.log('\n📖 See DEPLOY-GUIDE.md for detailed instructions');
console.log('📋 Use DEPLOYMENT-CHECKLIST.md to track progress');