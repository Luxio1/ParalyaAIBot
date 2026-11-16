import { APP_NAME, APP_VERSION } from '@bot/shared';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { EnvError, findRootDir, loadDotEnv, parseEnv } from './env';
import { buildApp } from './http/app';

async function main(): Promise<void> {
  const rootDir = findRootDir();
  loadDotEnv(rootDir);
  const env = parseEnv(process.env, rootDir);

  const database = openDatabase(env.databaseFile);
  runMigrations(database.db);

  const app = await buildApp({ env, database });
  app.log.info(`${APP_NAME} v${APP_VERSION}, base de données : ${env.databaseFile}`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info(`Signal ${signal} reçu, arrêt en cours`);
    try {
      await app.close();
    } finally {
      database.close();
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.host, port: env.port });
}

main().catch((error: unknown) => {
  if (error instanceof EnvError) {
    console.error(error.message);
  } else {
    console.error('Échec du démarrage du serveur :', error);
  }
  process.exit(1);
});
