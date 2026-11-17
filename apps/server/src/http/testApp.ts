import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { BotManager } from '../adapters/discord/botManager';
import { fakeDiscord, type FakeDiscord } from '../adapters/discord/fakeDiscordClient';
import { AiService } from '../core/ai/aiService';
import { FakeAiProvider } from '../core/ai/fakeAiProvider';
import { LogBus } from '../core/logs/logBus';
import { SessionStore } from '../core/memory/sessionStore';
import { RateLimiter } from '../core/ratelimit/rateLimiter';
import { MessagePipeline } from '../core/pipeline/messagePipeline';
import { openDatabase, type DatabaseHandle } from '../db/client';
import { runMigrations } from '../db/migrate';
import { parseEnv } from '../env';
import { AuthService } from '../services/authService';
import { CommandService } from '../services/commandService';
import { ConfigService } from '../services/configService';
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
  secrets: SecretsService;
  config: ConfigService;
  aiProvider: FakeAiProvider;
  memory: SessionStore;
  commands: CommandService;
  bot: BotManager;
  discord: FakeDiscord;
  /** Construit une nouvelle application sur la même base, comme après un redémarrage. */
  restart(): Promise<TestApp>;
  close(): Promise<void>;
}

export async function createTestApp(
  database: DatabaseHandle = openDatabase(':memory:'),
  discord: FakeDiscord = fakeDiscord(),
): Promise<TestApp> {
  runMigrations(database.db);
  const logBus = new LogBus();
  const auth = new AuthService(database.db, logBus);
  const secrets = new SecretsService(database.db, env.appSecret, {}, logBus);
  const config = new ConfigService(database.db, logBus);
  const aiProvider = new FakeAiProvider();
  const ai = new AiService(aiProvider);
  const memory = new SessionStore();
  const commands = new CommandService(database.db, logBus);
  const getConfig = () => config.get();
  const rateLimiter = new RateLimiter();
  const pipeline = new MessagePipeline({ getConfig, ai, memory, commands, rateLimiter, logBus });
  const bot = new BotManager(
    database.db,
    secrets,
    logBus,
    pipeline,
    getConfig,
    discord.createClient,
  );
  const app = await buildApp({
    env,
    database,
    logBus,
    auth,
    secrets,
    config,
    ai,
    memory,
    commands,
    bot,
  });
  return {
    app,
    database,
    logBus,
    auth,
    secrets,
    config,
    aiProvider,
    memory,
    commands,
    bot,
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
