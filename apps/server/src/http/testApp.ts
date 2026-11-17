import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { fakeDiscord, type FakeDiscord } from '../adapters/discord/fakeDiscordClient';
import { createContainer, type Container } from '../container';
import { FakeAiProvider } from '../core/ai/fakeAiProvider';
import { openDatabase, type DatabaseHandle } from '../db/client';
import { runMigrations } from '../db/migrate';
import { parseEnv } from '../env';
import { buildApp } from './app';
import { SESSION_COOKIE } from './session';

export const TEST_PASSWORD = 'mot-de-passe-solide';

const env = parseEnv({
  NODE_ENV: 'test',
  APP_SECRET: 'x'.repeat(48),
  WEB_DIST_DIR: '/dossier/inexistant',
});

export type TestApp = Omit<Container, 'aiProvider'> & {
  app: FastifyInstance;
  database: DatabaseHandle;
  /** Remplace Gemini : réponses et erreurs réglables par les tests. */
  aiProvider: FakeAiProvider;
  discord: FakeDiscord;
  /** Construit une nouvelle application sur la même base, comme après un redémarrage. */
  restart(): Promise<TestApp>;
  close(): Promise<void>;
};

export async function createTestApp(
  database: DatabaseHandle = openDatabase(':memory:'),
  discord: FakeDiscord = fakeDiscord(),
): Promise<TestApp> {
  runMigrations(database.db);
  const aiProvider = new FakeAiProvider();
  const container = createContainer({
    db: database.db,
    appSecret: env.appSecret,
    envSecrets: {},
    createAiProvider: () => aiProvider,
    createDiscordClient: discord.createClient,
  });
  const app = await buildApp({ env, database, ...container });
  const { bot } = container;
  return {
    ...container,
    app,
    database,
    aiProvider,
    discord,
    async restart() {
      await bot.shutdown();
      await app.close();
      return createTestApp(database, discord);
    },
    async close() {
      await bot.shutdown();
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
