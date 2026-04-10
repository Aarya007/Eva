import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/generate-diet': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/generate-full-plan': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/feedback': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/onboard': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/onboarding': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/profile': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/plans': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/track': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
