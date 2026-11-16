import { findRootDir, loadDotEnv, parseEnv } from '../env';
import { openDatabase } from './client';
import { runMigrations } from './migrate';

// Usage : `pnpm db:migrate` — applique les migrations sans démarrer le serveur.
const rootDir = findRootDir();
loadDotEnv(rootDir);
const env = parseEnv(process.env, rootDir);
const database = openDatabase(env.databaseFile);
try {
  runMigrations(database.db);
  console.log(`Migrations appliquées sur ${env.databaseFile}`);
} finally {
  database.close();
}
