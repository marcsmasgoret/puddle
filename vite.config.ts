import { defineConfig } from 'vite';

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
  },
  server: {
    host: true,
  },
});
