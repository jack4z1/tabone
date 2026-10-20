// build_dist.js - Production Release Packaging & Bundler for tabone
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('📦 TABONE RELEASE PACKAGING & BUNDLER');
console.log('====================================================\n');

const projectRoot = __dirname;
const extensionDir = path.join(projectRoot, 'extension');
const distDir = path.join(projectRoot, 'dist');
const zipFileName = 'tabone-extension-v1.0.0.zip';
const zipFilePath = path.join(distDir, zipFileName);

// 1. Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 2. Remove existing zip if present
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
  console.log('  Cleaned existing package:', zipFileName);
}

// 3. Verify all mandatory extension files are present before bundling
const requiredFiles = [
  'manifest.json',
  'popup.html',
  'popup.css',
  'popup.js',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'lib/lz-string.js',
  'lib/qrcode.min.js',
  'web/index.html',
  'web/app.js',
  'web/style.css',
  'web/lib/lz-string.js'
];

console.log('Validating extension file manifest...');
let missing = 0;
for (const rel of requiredFiles) {
  const full = path.join(extensionDir, rel);
  if (!fs.existsSync(full)) {
    console.error(`  ❌ Missing required file: ${rel}`);
    missing++;
  } else {
    const size = fs.statSync(full).size;
    console.log(`  ✓ ${rel} (${size} bytes)`);
  }
}

if (missing > 0) {
  console.error(`\n❌ Packaging aborted: ${missing} files missing.`);
  process.exit(1);
}

// 4. Create ZIP archive using .NET ZipFile
console.log('\nCreating release archive...');
try {
  const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${extensionDir.replace(/'/g, "''")}', '${zipFilePath.replace(/'/g, "''")}')"`;
  execSync(psCommand, { stdio: 'inherit' });
  
  const zipStats = fs.statSync(zipFilePath);
  console.log(`  ✅ Successfully created release package:`);
  console.log(`     Path: ${zipFilePath}`);
  console.log(`     Size: ${(zipStats.size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('  ❌ Error creating zip file:', err.message);
  process.exit(1);
}

console.log('\n====================================================');
console.log('🎉 RELEASE BUNDLE READY FOR GITHUB');
console.log('====================================================');
