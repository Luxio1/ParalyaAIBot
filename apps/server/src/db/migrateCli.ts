import { findRootDir, loadDotEnv, parseEnv } from '../env';
import { openDatabase } from './client';
import { runMigrations } from './migrate';

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
