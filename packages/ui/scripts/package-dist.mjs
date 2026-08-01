import { readFileSync, writeFileSync } from 'node:fs';

const dist = 'dist';
const manifest = JSON.parse(readFileSync('../../manifest.json', 'utf8'));
manifest.main = 'code.js';
manifest.ui = 'ui.html';
writeFileSync(`${dist}/manifest.json`, JSON.stringify(manifest, null, 2));

console.log('插件包已生成: dist/{ui.html, code.js, manifest.json}');
