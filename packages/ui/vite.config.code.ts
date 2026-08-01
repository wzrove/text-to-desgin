import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';
import manifestPlugin from './scripts/vite-plugin-manifest.js';

export default defineConfig(
  (): UserConfig => ({
    plugins: [manifestPlugin()],
    define: {
      global: '{}',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: false,
      target: 'es6',
      minify: false,
      rolldownOptions: {
        input: resolve(import.meta.dirname, 'src/code/code.ts'),
        output: {
          entryFileNames: 'code.js',
        },
      },
    },
  }),
);
