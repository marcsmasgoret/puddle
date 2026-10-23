import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// The site lives at marcsmasgoret.github.io/puddle/. The deploy workflow also
// builds a frozen copy of every commit under /puddle/c/<sha>/, so the base path
// can be overridden with VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/puddle/',
  define: {
    __COMMIT__: JSON.stringify(process.env.VITE_COMMIT ?? 'dev'),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
    // three pages: the puddle, the physics write-up and the validation run
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        physics: resolve(import.meta.dirname, 'physics.html'),
        validate: resolve(import.meta.dirname, 'validate.html'),
      },
    },
  },
  server: {
    host: true,
  },
});
