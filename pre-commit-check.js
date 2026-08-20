/**
 * pre-commit-check.js
 *
 * Security audit before committing to Git.
 * Run: npm run security-check
 */

const fs = require('fs');

console.log('\n🔍 Pre-commit Security Check\n');

// Files that must never be committed
const SENSITIVE_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.test',
  'secrets.json',
  'config.json',
];

// Patterns that indicate hardcoded credentials in source files
const SENSITIVE_PATTERNS = [
  /password\s*=\s*['"][^'"]{3,}['"]/i,
  /secret\s*=\s*['"][^'"]{3,}['"]/i,
  /api_key\s*=\s*['"][^'"]{3,}['"]/i,
  /DB_PASSWORD\s*=\s*[^#\n\r'"\s]+/,
  /mysql:\/\/.+:.+@/i,
];

let issues = 0;

// ---------------------------------------------------------------
// 1. Sensitive files
// ---------------------------------------------------------------
console.log('🔐 Checking for sensitive files...');
SENSITIVE_FILES.forEach((file) => {
  if (fs.existsSync(file)) {
    console.log(`   ❌ FOUND: ${file}  — contains secrets and must not be committed`);
    issues++;
  }
});
if (issues === 0) console.log('   ✅ No sensitive files found\n');
else console.log('');

// ---------------------------------------------------------------
// 2. Hardcoded secrets in source files
// ---------------------------------------------------------------
console.log('📄 Checking source files for hardcoded credentials...');

const SOURCE_FILES = [
  'app.js',
  'seed.js',
  'load-test.js',
  'checkout-stress-test.js',
  'socket-test.js',
  'dashboard.js',
];

let secretIssues = 0;
SOURCE_FILES.forEach((file) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  SENSITIVE_PATTERNS.forEach((pattern) => {
    const match = content.match(pattern);
    if (match) {
      console.log(`   ❌ ${file}: potential hardcoded secret — ${match[0].substring(0, 60)}`);
      secretIssues++;
      issues++;
    }
  });
});
if (secretIssues === 0) console.log('   ✅ No hardcoded secrets found\n');
else console.log('');

// ---------------------------------------------------------------
// 3. .gitignore coverage
// ---------------------------------------------------------------
console.log('🛡️  Checking .gitignore...');
const REQUIRED_IGNORES = ['.env', 'node_modules/', '*.log', 'passenger.log'];
if (fs.existsSync('.gitignore')) {
  const content = fs.readFileSync('.gitignore', 'utf8');
  const missing = REQUIRED_IGNORES.filter((p) => !content.includes(p));
  if (missing.length > 0) {
    console.log(`   ❌ .gitignore is missing: ${missing.join(', ')}`);
    issues++;
  } else {
    console.log('   ✅ .gitignore is properly configured\n');
  }
} else {
  console.log('   ❌ .gitignore not found');
  issues++;
}

// ---------------------------------------------------------------
// 4. Required files present
// ---------------------------------------------------------------
console.log('\n📋 Checking required files...');
const REQUIRED_FILES = [
  'app.js',
  'package.json',
  'schema.sql',
  'seed.js',
  '.env.example',
  'README.md',
  '.gitignore',
  'load-test.js',
  'checkout-stress-test.js',
  'socket-test.html',
  'dashboard.html',
];

REQUIRED_FILES.forEach((file) => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file}  — MISSING`);
    issues++;
  }
});

// ---------------------------------------------------------------
// Summary
// ---------------------------------------------------------------
console.log('\n📊 Summary:');
if (issues === 0) {
  console.log('🎉 All checks passed. Repository is safe to commit.\n');
} else {
  console.log(`❌ ${issues} issue(s) must be resolved before committing.\n`);
  process.exit(1);
}

console.log('🚀 Ready to push? Run:');
console.log('   git add .');
console.log('   git commit -m "your message"');
console.log('   git push origin main\n');
