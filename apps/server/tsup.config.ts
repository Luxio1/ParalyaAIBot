import { cp } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Le package interne est intégré au bundle ; les dépendances npm restent externes.
  noExternal: ['@bot/shared'],
  async onSuccess() {
    // Les migrations SQL sont lues à l'exécution, à côté du bundle.
    await cp('src/db/migrations', 'dist/migrations', { recursive: true });
  },
});
