import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 127.0.0.1, а не localhost: на Windows localhost может уйти в IPv6 и не открыться.
    host: '127.0.0.1',
    port: 5173,
    // В разработке фронтенд и API на разных портах; прокси делает их одним адресом, как в проде.
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
});
