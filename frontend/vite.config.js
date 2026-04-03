import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
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
    },
  },
});
