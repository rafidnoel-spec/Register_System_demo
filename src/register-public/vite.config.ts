import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API:t körs på https://localhost:7180 (se RegisterSystem.Api/Properties/launchSettings.json)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: ['..'] }, // demo-mock ligger utanför projektmappen
    host: true, // gör att en surfplatta i samma nätverk kan nå utvecklingsservern
    proxy: {
      '/api': { target: 'https://localhost:7180', changeOrigin: true, secure: false }
    }
  }
});
