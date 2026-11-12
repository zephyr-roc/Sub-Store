const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '..', 'node_modules', '@jitl', 'quickjs-wasmfile-release-sync', 'dist', 'emscripten-module.wasm');
const destination = path.resolve(__dirname, '..', '..', 'cloudflare', 'src', 'vendor', 'quickjs.wasm');
if (!fs.existsSync(source)) throw new Error('Install dependencies in edgeone/ before building');
fs.copyFileSync(source, destination);
console.log('Prepared QuickJS WASM for the shared Sub-Store compatibility layer');
