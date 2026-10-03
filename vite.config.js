import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Proxy GitHub API calls through the dev server so the browser makes
    // same-origin requests. The token (from appsettings.json) is forwarded.
    proxy: {
      '/gh': {
        target: 'https://api.github.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/gh/, '')
      }
    }
  }
});
