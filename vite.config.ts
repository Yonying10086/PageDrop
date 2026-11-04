import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // JSZip 走动态 import，单独切一个 chunk，首屏不加载
        manualChunks: (id) => (id.includes('jszip') ? 'jszip' : undefined),
      },
    },
  },
  server: { port: 5173 },
});
