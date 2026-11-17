import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { LogBus } from '../core/logs/logBus';
import { openDatabase, type DatabaseHandle } from '../db/client';
import { runMigrations } from '../db/migrate';
import { parseEnv } from '../env';
import { AuthService } from '../services/authService';
import { SecretsService } from '../services/secretsService';
import { buildApp } from './app';
import { SESSION_COOKIE } from './session';

export const TEST_PASSWORD = 'mot-de-passe-solide';

const env = parseEnv({
  NODE_ENV: 'test',
  APP_SECRET: 'x'.repeat(48),
  WEB_DIST_DIR: '/dossier/inexistant',
});

export interface TestApp {
  app: FastifyInstance;
  database: DatabaseHandle;
  logBus: LogBus;
  auth: AuthService;
  /** Construit une nouvelle application sur la même base, comme après un redémarrage. */
  restart(): Promise<TestApp>;
  close(): Promise<void>;
}

export async function createTestApp(
  database: DatabaseHandle = openDatabase(':memory:'),
): Promise<TestApp> {
  runMigrations(database.db);
  const logBus = new LogBus();
  const auth = new AuthService(database.db, logBus);
  const secrets = new SecretsService(database.db, env.appSecret, {}, logBus);
  const app = await buildApp({ env, database, logBus, auth, secrets });
  return {
    app,
    database,
    logBus,
    auth,
    async restart() {
      await app.close();
      return createTestApp(database);
    },
    async close() {
      await app.close();
      database.close();
    },
  };
}

/** Crée le compte admin et renvoie l'en-tête `cookie` de sa session. */
export async function setupAdmin({ app, auth }: TestApp): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: { setupCode: auth.createSetupCode(), username: 'admin', password: TEST_PASSWORD },
  });
  return sessionCookie(response);
}

export function sessionCookie(response: LightMyRequestResponse): string {
  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
  if (!cookie) throw new Error(`Pas de cookie de session (statut ${response.statusCode})`);
  return `${SESSION_COOKIE}=${cookie.value}`;
}
