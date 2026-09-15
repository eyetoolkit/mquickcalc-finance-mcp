/**
 * Simple build script: copy src/index.js → dist/index.js
 * For a real project, use esbuild or tsc.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = __dirname + '/src/index.js';
const out = __dirname + '/dist/index.js';

mkdirSync(__dirname + '/dist', { recursive: true });

// Read ESM source, rewrite import paths to relative
let code = readFileSync(src, 'utf8');
// The SDK uses .js imports that resolve at runtime — just copy as-is
writeFileSync(out, code);
console.log('Built:', out);
