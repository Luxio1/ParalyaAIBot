import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Le port de l'API est lu dans le `.env` de la racine (PORT), 3000 par défaut.
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');
  const apiTarget = `http://127.0.0.1:${rootEnv.PORT || 3000}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': apiTarget,
        '/healthz': apiTarget,
        '/ws': { target: apiTarget, ws: true },
      },
    },
  };
});
