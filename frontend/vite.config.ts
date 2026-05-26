import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setupTests.ts',
    globals: true,
  },

  // ── Pre-bundle heavy deps so Vite doesn't re-process them on every HMR ──────
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'recharts',
      'clsx',
    ],
  },

  // ── Production build chunking ────────────────────────────────────────────────
  build: {
    // Raise warning threshold (default 500kb is too low for this app)
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached by browser between deploys
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Heavy UI libs — separate chunks so pages load fast
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },

  // ── Dev server ───────────────────────────────────────────────────────────────
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
    // Hot Module Replacement — keep HMR websocket stable
    hmr: {
      overlay: true,
    },
  },
});
