const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, '..', 'node_modules', '@jitl', 'quickjs-wasmfile-release-sync', 'dist', 'emscripten-module.wasm');
const dest = path.join(__dirname, '..', 'src', 'vendor', 'quickjs.wasm');

if (!fs.existsSync(src)) {
    throw new Error('QuickJS WASM missing; run npm install in cloudflare/');
}
fs.copyFileSync(src, dest);
console.log('QuickJS WASM prepared');
