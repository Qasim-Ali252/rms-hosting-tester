const fs = require('fs');
const path = require('path');

console.log('🔍 Pre-commit Security Check\n');

// Files that should NOT be committed
const sensitiveFiles = [
  '.env',
  '.env.local', 
  '.env.development',
  '.env.test',
  'config/database.json',
  'secrets.json'
];

// Patterns that should NOT be in committed files
const sensitivePatterns = [
  /password\s*=\s*['"][^'"]+['"]/i,
  /secret\s*=\s*['"][^'"]+['"]/i,
  /api_key\s*=\s*['"][^'"]+['"]/i,
  /DB_PASSWORD\s*=\s*[^#\n\r]+/,
  /mysql:\/\/.*:.*@/i
];

let issues = 0;

// Check for sensitive files
console.log('🔐 Checking for sensitive files...');
sensitiveFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`❌ FOUND: ${file} - This file contains secrets and should not be committed!`);
    issues++;
  }
});

if (issues === 0) {
  console.log('✅ No sensitive files found');
}

console.log('\n📄 Checking code files for hardcoded secrets...');

// Check JavaScript files for hardcoded secrets
const checkFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  sensitivePatterns.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`❌ FOUND in ${filePath}: Potential hardcoded secret - ${matches[0]}`);
      issues++;
    }
  });
};

// Files to check
const filesToCheck = [
  'app.js',
  'dashboard.js',
  'seed-db.js',
  'load-test.js',
  'socket-test.js'
];

filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    checkFile(file);
  }
});

if (issues === 0) {
  console.log('✅ No hardcoded secrets found in code files');
}

console.log('\n🛡️ Checking .gitignore coverage...');

// Check if .gitignore exists and covers sensitive files
if (fs.existsSync('.gitignore')) {
  const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  
  const requiredIgnores = ['.env', 'node_modules/', '*.log'];
  const missingIgnores = [];
  
  requiredIgnores.forEach(pattern => {
    if (!gitignoreContent.includes(pattern)) {
      missingIgnores.push(pattern);
    }
  });
  
  if (missingIgnores.length > 0) {
    console.log(`❌ .gitignore missing patterns: ${missingIgnores.join(', ')}`);
    issues++;
  } else {
    console.log('✅ .gitignore properly configured');
  }
} else {
  console.log('❌ .gitignore file not found!');
  issues++;
}

console.log('\n📋 Checking required files...');

const requiredFiles = [
  'package.json',
  'app.js', 
  'dashboard.html',
  'dashboard.js',
  '.env.production',
  'README.md',
  '.gitignore'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing`);
    issues++;
  }
});

console.log('\n📊 Summary:');
if (issues === 0) {
  console.log('🎉 All checks passed! Repository is safe to commit.');
  console.log('\n💡 Remember to:');
  console.log('   - Configure .env with your local database details');
  console.log('   - Never commit files containing real passwords');
  console.log('   - Use strong, unique passwords for production');
} else {
  console.log(`❌ Found ${issues} security issues that need to be resolved before committing.`);
  console.log('\n🔧 Actions needed:');
  console.log('   - Remove or add sensitive files to .gitignore');
  console.log('   - Replace hardcoded secrets with environment variables');
  console.log('   - Ensure .gitignore covers all sensitive patterns');
  
  process.exit(1);
}

console.log('\n🚀 Ready for GitHub? Run these commands:');
console.log('   git add .');
console.log('   git commit -m "Add RMS hosting test with dashboard"');  
console.log('   git push origin main');