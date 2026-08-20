const fs = require('fs');
const path = require('path');

function checkJS(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    // Wrap in Function to only parse, not execute top-level requires
    new Function(code);
    console.log(`OK: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    console.error(`SYNTAX ERROR in ${path.basename(filePath)}: ${err.message}`);
    return false;
  }
}

function main() {
  const root = __dirname;
  const files = fs.readdirSync(root);
  let ok = true;
  for (const f of files) {
    if (f.endsWith('.js')) {
      const p = path.join(root, f);
      const res = checkJS(p);
      ok = ok && res;
    }
  }

  // Validate package.json
  try {
    const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    JSON.parse(pkg);
    console.log('OK: package.json');
  } catch (err) {
    console.error('package.json error:', err.message);
    ok = false;
  }

  // Check .env presence (not contents)
  if (fs.existsSync(path.join(root, '.env'))) {
    console.log('OK: .env found');
  } else {
    console.warn('WARN: .env not found');
  }

  if (!ok) process.exit(2);
}

main();
