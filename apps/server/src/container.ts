import type { SecretName } from '@bot/shared';
import type { Client } from 'discord.js';
import { BotManager, type ClientOptions } from './adapters/discord/botManager';
import type { AiProvider } from './core/ai/aiProvider';
import { AiService } from './core/ai/aiService';
import { EventEngine } from './core/events/eventEngine';
import { LogBus } from './core/logs/logBus';
import { SessionStore } from './core/memory/sessionStore';
import { MessagePipeline } from './core/pipeline/messagePipeline';
import { RateLimiter } from './core/ratelimit/rateLimiter';
import type { Db } from './db/client';
import { AuthService } from './services/authService';
import { CommandService } from './services/commandService';
import { ConfigService } from './services/configService';
import { EventRuleService } from './services/eventRuleService';
import { ProfileService } from './services/profileService';
import { SecretsService } from './services/secretsService';

export interface ContainerOptions {
  db: Db;
  appSecret: string;
  /** Valeurs du `.env`, utilisées faute de valeur saisie dans le dashboard. */
  envSecrets: Partial<Record<SecretName, string>>;
  /** Fournisseur d'IA : Gemini en production, `FakeAiProvider` dans les tests. */
  createAiProvider: (secrets: SecretsService) => AiProvider;
  /** Client Discord ; un client factice dans les tests. */
  createDiscordClient?: (options: ClientOptions) => Client;
}

export type Container = ReturnType<typeof createContainer>;

/** Assemble les services du serveur, en production comme dans les tests. */
export function createContainer(options: ContainerOptions) {
  const { db } = options;
  const logBus = new LogBus();
  const auth = new AuthService(db, logBus);
  const secrets = new SecretsService(db, options.appSecret, options.envSecrets, logBus);
  const profiles = new ProfileService(db, logBus);
  const config = new ConfigService(db, logBus, profiles);
  const getConfig = () => config.get();
  const aiProvider = options.createAiProvider(secrets);
  const ai = new AiService(aiProvider);
  const memory = new SessionStore();
  const rateLimiter = new RateLimiter();
  const commands = new CommandService(db, logBus, profiles);
  const eventRules = new EventRuleService(db, logBus, profiles);
  const events = new EventEngine({ getConfig, getRules: () => eventRules.list(), ai, logBus });
  const pipeline = new MessagePipeline({ getConfig, ai, memory, commands, rateLimiter, logBus });
  const bot = new BotManager(
    db,
    secrets,
    logBus,
    pipeline,
    events,
    getConfig,
    options.createDiscordClient,
  );

  secrets.onChange((name) => {
    if (name === 'geminiApiKey') ai.clearModelCache();
  });
  // Un autre profil, c'est un autre persona : il ne reprend pas les conversations du précédent.
  let activeProfile = profiles.state().activeId;
  profiles.onChange(() => {
    const { activeId } = profiles.state();
    if (activeId !== activeProfile) memory.clear();
    activeProfile = activeId;
  });
  config.onChange((previous, next) => {
    if (previous.membersIntent !== next.membersIntent) {
      void bot.reconnect('Accès à la liste des membres modifié');
    }
  });

  return {
    logBus,
    auth,
    secrets,
    profiles,
    config,
    aiProvider,
    ai,
    memory,
    rateLimiter,
    commands,
    eventRules,
    events,
    pipeline,
    bot,
  };
}
