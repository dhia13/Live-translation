// Build script to compile TypeScript Electron files
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building Electron TypeScript files...');

try {
  // Compile Electron TypeScript files
  execSync('tsc -p electron/tsconfig.json', { stdio: 'inherit' });
  
  // Copy preload.js to dist-electron if needed
  const preloadSource = path.join(__dirname, 'electron', 'dist', 'preload.js');
  const preloadDest = path.join(__dirname, 'dist-electron', 'preload.js');
  
  if (fs.existsSync(preloadSource)) {
    if (!fs.existsSync(path.dirname(preloadDest))) {
      fs.mkdirSync(path.dirname(preloadDest), { recursive: true });
    }
    fs.copyFileSync(preloadSource, preloadDest);
    console.log('Copied preload.js to dist-electron');
  }
  
  // Copy main.js to dist-electron
  const mainSource = path.join(__dirname, 'electron', 'dist', 'main.js');
  const mainDest = path.join(__dirname, 'dist-electron', 'main.js');
  
  if (fs.existsSync(mainSource)) {
    if (!fs.existsSync(path.dirname(mainDest))) {
      fs.mkdirSync(path.dirname(mainDest), { recursive: true });
    }
    fs.copyFileSync(mainSource, mainDest);
    console.log('Copied main.js to dist-electron');
  }
  
  console.log('Electron build complete!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}



