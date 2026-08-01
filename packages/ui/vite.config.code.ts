import { resolve } from 'node:path';
import { defineConfig, type UserConfig } from 'vite';

export default defineConfig(
  (): UserConfig => ({
    define: {
      global: '{}',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: 'inline',
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
