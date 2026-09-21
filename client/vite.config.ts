import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const currentDir = import.meta.dirname || path.resolve();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: currentDir,
  resolve: {
    alias: {
      '@': path.resolve(currentDir, './src'),
      '@client': path.resolve(currentDir, './src'),
    },
  },
  server: {
    port: 3500,
    strictPort: false,
    host: true,
    proxy: {
      // Direct Python AI Worker routes
      '/api/v1': {
        target: process.env.AI_WORKER_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Next.js BFF API routes
      '/api': {
        target: process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(currentDir, '../dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
