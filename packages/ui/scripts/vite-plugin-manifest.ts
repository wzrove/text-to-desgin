import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default function manifestPlugin() {
  const root = resolve(process.cwd(), '../..');
  const outDir = resolve(process.cwd(), 'dist');
  return {
    name: 'emit-manifest',
    buildStart() {
      const manifest = JSON.parse(
        readFileSync(resolve(root, 'manifest.json'), 'utf8'),
      );
      manifest.main = 'code.js';
      manifest.ui = 'ui.html';
      writeFileSync(
        resolve(outDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
      );
    },
  };
}
