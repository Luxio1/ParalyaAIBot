import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

/**
 * Dossier des migrations : `src/db/migrations` en développement,
 * `dist/migrations` (copié au build) à côté du bundle en production.
 */
function findMigrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const folder = join(here, 'migrations');
  if (!existsSync(join(folder, 'meta', '_journal.json'))) {
    throw new Error(`Dossier de migrations introuvable : ${folder}`);
  }
  return folder;
}

/** Applique les migrations en attente (idempotent, exécuté à chaque démarrage). */
export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: findMigrationsFolder() });
}
