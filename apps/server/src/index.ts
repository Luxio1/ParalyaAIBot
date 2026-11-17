import { APP_NAME, APP_VERSION } from '@bot/shared';
import { BotManager } from './adapters/discord/botManager';
import { AiService } from './core/ai/aiService';
import { GeminiProvider } from './core/ai/providers/gemini';
import { LogBus } from './core/logs/logBus';
import { SessionStore } from './core/memory/sessionStore';
import { RateLimiter } from './core/ratelimit/rateLimiter';
import { MessagePipeline } from './core/pipeline/messagePipeline';
import { openDatabase } from './db/client';
import { runMigrations } from './db/migrate';
import { EnvError, findRootDir, loadDotEnv, parseEnv } from './env';
import { buildApp } from './http/app';
import { AuthService } from './services/authService';
import { CommandService } from './services/commandService';
import { ConfigService } from './services/configService';
import { SecretsService } from './services/secretsService';

async function main(): Promise<void> {
  const rootDir = findRootDir();
  loadDotEnv(rootDir);
  const env = parseEnv(process.env, rootDir);

  const database = openDatabase(env.databaseFile);
  runMigrations(database.db);

  const logBus = new LogBus();
  const auth = new AuthService(database.db, logBus);
  const secrets = new SecretsService(
    database.db,
    env.appSecret,
    { geminiApiKey: env.geminiApiKey },
    logBus,
  );
  const config = new ConfigService(database.db, logBus);
  const ai = new AiService(new GeminiProvider(() => secrets.get('geminiApiKey')));
  secrets.onChange((name) => {
    if (name === 'geminiApiKey') ai.clearModelCache();
  });
  const memory = new SessionStore();
  // Les conversations expirées disparaissent du moniteur sans attendre un nouveau message.
  const rateLimiter = new RateLimiter();
  setInterval(() => {
    memory.sweep(config.get().memoryRetentionMinutes * 60_000);
    rateLimiter.sweep(config.get().rateLimitWindowSeconds * 1000);
  }, 30_000).unref();
  const commands = new CommandService(database.db, logBus);
  const getConfig = () => config.get();
  const pipeline = new MessagePipeline({ getConfig, ai, memory, commands, rateLimiter, logBus });
  const bot = new BotManager(database.db, secrets, logBus, pipeline, getConfig);
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
  app.log.info(`${APP_NAME} v${APP_VERSION}, base de données : ${env.databaseFile}`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info(`Signal ${signal} reçu, arrêt en cours`);
    try {
      await bot.shutdown();
      await app.close();
    } finally {
      database.close();
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.host, port: env.port });
  logBus.push('system', `Serveur démarré (v${APP_VERSION}).`);

  // Lisible uniquement par qui a accès aux logs du serveur, et invalide dès le premier compte créé.
  const setupCode = auth.createSetupCode();
  if (setupCode) {
    app.log.warn(
      `Aucun compte administrateur. Ouvrez le dashboard et saisissez ce code d'installation : ${setupCode}`,
    );
  }
  await bot.resume();
}

main().catch((error: unknown) => {
  if (error instanceof EnvError) {
    console.error(error.message);
  } else {
    console.error('Échec du démarrage du serveur :', error);
  }
  process.exit(1);
});
