// Copies the pinned monaco-editor build into apps/web/public/monaco so the editor
// loads from our own origin instead of a third-party CDN. Runs before dev/build.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = require.resolve('monaco-editor/package.json', { paths: [path.join(root, 'apps/web')] });
const { version } = JSON.parse(readFileSync(pkg, 'utf8'));
const target = path.join(root, 'apps/web/public/monaco');
const stamp = path.join(target, 'VERSION');

if (existsSync(stamp) && readFileSync(stamp, 'utf8').trim() === version) process.exit(0);
rmSync(target, { recursive: true, force: true });
cpSync(path.join(path.dirname(pkg), 'min', 'vs'), path.join(target, 'vs'), { recursive: true });
writeFileSync(stamp, version);
console.log(`[monaco] copied monaco-editor ${version} to apps/web/public/monaco`);
