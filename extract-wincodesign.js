const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cacheDir = 'C:\\Users\\Preetha T\\AppData\\Local\\electron-builder\\Cache\\winCodeSign';
const zipFile = path.join(cacheDir, '943153519.7z');
const destDir = path.join(cacheDir, 'winCodeSign-2.6.0');
const exe7z = 'D:\\Namma Kada\\ITHU-NAMMA-KADA\\electron\\node_modules\\7zip-bin\\win\\x64\\7za.exe';

console.log('Cleaning destination directory...');
fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });

console.log('Extracting archive excluding macOS (darwin) symlink files...');
const cmd = `"${exe7z}" x "${zipFile}" -o"${destDir}" -x!darwin -y`;
console.log(`Executing: ${cmd}`);

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('Extraction completed successfully!');
} catch (err) {
  console.error('Extraction failed:', err.message);
}
