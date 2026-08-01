import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import solid from 'vite-plugin-solid';

function reorderCss(): Plugin {
  const out = resolve(import.meta.dirname, 'dist/ui.html');
  return {
    name: 'reorder-css',
    closeBundle() {
      const html = readFileSync(out, 'utf-8');
      const styleRe = /<style[^>]*>[\s\S]*?<\/style>/;
      const match = html.match(styleRe);
      if (!match) return;
      const without = html.replace(styleRe, '');
      const titleEnd = without.indexOf('</title>');
      if (titleEnd === -1) return;
      const insertAt = titleEnd + '</title>'.length;
      const reordered =
        without.slice(0, insertAt) +
        '\n    ' +
        match[0] +
        without.slice(insertAt);
      writeFileSync(out, reordered);
    },
  };
}

export default defineConfig({
  plugins: [solid(), viteSingleFile(), reorderCss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es6',
    sourcemap: 'inline',
    assetsInlineLimit: 100000000,
    rolldownOptions: {
      input: resolve(import.meta.dirname, 'ui.html'),
    },
  },
});
