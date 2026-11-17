import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Le port de l'API est lu dans le `.env` de la racine (PORT), 3000 par défaut.
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');
  // `changeOrigin: false` garde l'en-tête Host du navigateur : le serveur le compare à `Origin`.
  const apiTarget = { target: `http://127.0.0.1:${rootEnv.PORT || 3000}`, changeOrigin: false };

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
        '/ws': { ...apiTarget, ws: true },
      },
    },
  };
});
