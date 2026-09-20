import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const distClient = path.join(rootDir, 'dist', 'client');
const publicDir = path.join(rootDir, 'public');
const publicAssets = path.join(publicDir, 'assets');

console.log('🔄 Syncing Vite build from', distClient, 'to', publicDir);

if (!fs.existsSync(distClient)) {
  console.error('❌ dist/client does not exist. Run "npm run client:build" first.');
  process.exit(1);
}

// Ensure public/assets directory exists
if (!fs.existsSync(publicAssets)) {
  fs.mkdirSync(publicAssets, { recursive: true });
}

// Copy assets
const distAssets = path.join(distClient, 'assets');
if (fs.existsSync(distAssets)) {
  const files = fs.readdirSync(distAssets);
  for (const file of files) {
    fs.copyFileSync(path.join(distAssets, file), path.join(publicAssets, file));
    console.log(`  ✓ Copied asset: ${file}`);
  }
}

// Copy index.html
const indexSrc = path.join(distClient, 'index.html');
const indexDest = path.join(publicDir, 'index.html');
fs.copyFileSync(indexSrc, indexDest);
console.log('  ✓ Copied index.html to public/index.html');

console.log('✅ Port 3500 Vite client assets synced to public/');
