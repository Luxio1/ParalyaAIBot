import type { BotConfig, BotState, BotStatus, DiscoveredGuild, ServerEvent } from '@bot/shared';
import {
  Client,
  DiscordjsErrorCodes,
  Events,
  GatewayCloseCodes,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  PermissionsBitField,
} from 'discord.js';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../../core/logs/logBus';
import type { EventEngine } from '../../core/events/eventEngine';
import { extractTrigger, type MessagePipeline } from '../../core/pipeline/messagePipeline';
import type { Db } from '../../db/client';
import { BOT_SETTINGS_ID, botSettings } from '../../db/schema';
import type { SecretsService } from '../../services/secretsService';
import { discoverGuilds } from './discovery';
import { discordTransport, toIncomingMessage } from './discordTransport';
import { formatBotReply, formatIncomingDm, sendToRelay } from './dmRelay';
import { discordEventActions } from './eventActions';

type BotEvent = Extract<ServerEvent, { type: 'bot:status' | 'bot:discovery-changed' }>;

const PING_REFRESH_MS = 30_000;

/** Lire les salons, y répondre (fils compris) et lire l'historique pour le contexte des messages cités. */
const INVITE_PERMISSIONS = PermissionsBitField.resolve([
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ReadMessageHistory,
]);

const DISCOVERY_EVENTS = [
  Events.GuildUpdate,
  Events.ChannelCreate,
  Events.ChannelDelete,
  Events.ChannelUpdate,
  Events.GuildRoleCreate,
  Events.GuildRoleDelete,
  Events.GuildRoleUpdate,
] as const;

const TOKEN_INVALID =
  'Token Discord refusé. Générez-en un nouveau (Developer Portal, onglet Bot, « Reset Token ») et enregistrez-le dans Paramètres.';
export interface ClientOptions {
  /** Intent privilégié « Server Members », pour écrire aux membres d'un rôle. */
  membersIntent: boolean;
}

function intentMissing(membersIntent: boolean): string {
  const intents = membersIntent
    ? '« Message Content Intent » et « Server Members Intent »'
    : '« Message Content Intent »';
  return `Discord refuse un accès demandé par le bot. Activez ${intents} (Developer Portal, onglet Bot, section Privileged Gateway Intents), puis redémarrez le bot.`;
}

export function createDiscordClient({ membersIntent }: ClientOptions): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      ...(membersIntent ? [GatewayIntentBits.GuildMembers] : []),
    ],
    // Discord n'envoie pas le salon d'un MP avec le message : sans ce partial, les MP sont ignorés.
    partials: [Partials.Channel],
  });
}

/**
 * Connexion du bot à Discord. Les opérations passent par une file : un démarrage et un arrêt
 * demandés en même temps s'exécutent l'un après l'autre.
 */
export class BotManager {
  #client: Client | null = null;
  #state: BotState = 'offline';
  #error: string | null = null;
  #queue: Promise<void> = Promise.resolve();
  #pingTimer: NodeJS.Timeout | undefined;
  #lastPing: number | null = null;
  readonly #listeners = new Set<(event: BotEvent) => void>();

  constructor(
    private readonly db: Db,
    private readonly secrets: SecretsService,
    private readonly logBus: LogBus,
    private readonly pipeline: MessagePipeline,
    private readonly events: EventEngine,
    private readonly getConfig: () => BotConfig,
    private readonly createClient: (options: ClientOptions) => Client = createDiscordClient,
  ) {
    secrets.onChange((name) => {
      if (name === 'discordToken' && this.#wantsRunning()) {
        void this.#enqueue(async () => {
          this.logBus.push('discord', 'Token Discord modifié : reconnexion du bot.');
          await this.#disconnect();
          await this.#connect();
        });
      }
    });
  }

  status(): BotStatus {
    const client = this.#client;
    const user = client?.user ?? null;
    const ping = client && client.ws.ping >= 0 ? Math.round(client.ws.ping) : null;
    return {
      state: this.#state,
      user: user && {
        id: user.id,
        tag: user.tag,
        avatarUrl: user.displayAvatarURL({ size: 128 }),
      },
      guildCount: client?.guilds.cache.size ?? 0,
      ping,
      error: this.#error,
      inviteUrl: user && inviteUrl(client?.application?.id ?? user.id),
    };
  }

  discovery(): DiscoveredGuild[] {
    return this.#client ? discoverGuilds(this.#client.guilds.cache.values()) : [];
  }

  start(): Promise<void> {
    return this.#enqueue(async () => {
      this.#setAutoStart(true);
      if (!this.#client) await this.#connect();
    });
  }

  stop(): Promise<void> {
    return this.#enqueue(async () => {
      this.#setAutoStart(false);
      if (this.#state === 'offline') return;
      await this.#disconnect();
      this.#setState('offline');
      this.logBus.push('discord', 'Bot arrêté.');
    });
  }

  /** Au démarrage du serveur : reconnecte le bot s'il tournait lors de l'arrêt précédent. */
  resume(): Promise<void> {
    return this.#enqueue(async () => {
      if (this.#wantsRunning() && !this.#client) await this.#connect();
    });
  }

  /** Reconnecte le bot s'il est censé tourner, par exemple pour changer d'intents. */
  reconnect(reason: string): Promise<void> {
    return this.#enqueue(async () => {
      if (!this.#wantsRunning()) return;
      this.logBus.push('discord', `${reason} : reconnexion du bot.`);
      await this.#disconnect();
      await this.#connect();
    });
  }

  /** À l'arrêt du serveur : déconnecte sans toucher à `autoStart`. */
  shutdown(): Promise<void> {
    return this.#enqueue(() => this.#disconnect());
  }

  /** Renvoie la fonction de désabonnement. */
  subscribe(listener: (event: BotEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.#queue.then(task);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async #connect(): Promise<void> {
    const token = this.secrets.get('discordToken');
    if (!token) return this.#fail('Aucun token Discord. Saisissez-le dans Paramètres.');

    const { membersIntent } = this.getConfig();
    const client = this.createClient({ membersIntent });
    this.#client = client;
    this.#listen(client);
    this.#setState('connecting');
    this.logBus.push('discord', 'Connexion à Discord...');
    try {
      await client.login(token);
    } catch (error) {
      // `login` a déjà détruit le client.
      client.removeAllListeners();
      this.#client = null;
      this.#fail(describeLoginError(error, membersIntent));
    }
  }

  async #disconnect(): Promise<void> {
    const client = this.#client;
    if (!client) return;
    this.#client = null;
    clearInterval(this.#pingTimer);
    client.removeAllListeners();
    try {
      await client.destroy();
    } catch (error) {
      this.logBus.push('error', `Déconnexion de Discord incomplète : ${errorMessage(error)}`);
    }
  }

  #listen(client: Client): void {
    client.once(Events.ClientReady, (ready) => {
      this.#setState('online');
      this.logBus.push(
        'success',
        `Connecté en tant que @${ready.user.tag} sur ${ready.guilds.cache.size} serveur(s).`,
      );
      this.#emit({ type: 'bot:discovery-changed' });
      this.#pingTimer = setInterval(() => this.#refreshPing(), PING_REFRESH_MS);
      this.#pingTimer.unref();
    });
    client.on(Events.ShardReconnecting, () => {
      this.#setState('connecting');
      this.logBus.push('discord', 'Connexion à Discord perdue, reconnexion en cours.');
    });
    client.on(Events.ShardResume, () => this.#reconnected());
    client.on(Events.ShardReady, () => {
      if (this.#state === 'connecting' && client.isReady()) this.#reconnected();
    });
    // Fermeture définitive (token révoqué, intent retiré) : discord.js ne se reconnectera pas.
    client.on(Events.ShardDisconnect, ({ code }) => {
      void this.#enqueue(async () => {
        if (this.#client !== client) return;
        await this.#disconnect();
        this.#fail(describeCloseCode(code, this.getConfig().membersIntent));
      });
    });
    client.on(Events.GuildCreate, (guild) => {
      this.logBus.push('discord', `Serveur rejoint : « ${guild.name} ».`);
      this.#guildsChanged();
    });
    client.on(Events.GuildDelete, (guild) => {
      this.logBus.push('discord', `Bot retiré du serveur « ${guild.name} ».`);
      this.#guildsChanged();
    });
    for (const event of DISCOVERY_EVENTS) {
      client.on(event, () => this.#emit({ type: 'bot:discovery-changed' }));
    }
    client.on(Events.MessageCreate, (message) => {
      const botId = client.user?.id;
      const incoming = botId && toIncomingMessage(message, botId);
      if (!incoming) return;
      let onReplied: ((text: string) => void) | undefined;
      if (incoming.isDM) {
        this.#relay(formatIncomingDm(incoming.author, message.content, incoming.attachments));
        onReplied = (text) => this.#relay(formatBotReply(incoming.author, text));
      }
      void this.pipeline.handle(incoming, discordTransport(message, botId, onReplied));
      if (!incoming.isDM) {
        const botAnswers = extractTrigger(incoming, this.getConfig()) !== null;
        void this.events.handle(incoming, discordEventActions(message), botAnswers);
      }
    });
    client.on(Events.Error, (error) => {
      this.logBus.push('error', `Erreur Discord : ${error.message}`);
    });
  }

  /** Retranscription des MP dans le salon du staff, si elle est activée. */
  #relay(content: string): void {
    const { dmRelayEnabled, dmRelayChannelId } = this.getConfig();
    if (!dmRelayEnabled || !dmRelayChannelId || !this.#client) return;
    sendToRelay(this.#client, dmRelayChannelId, content).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logBus.push('error', `Retranscription des MP impossible : ${reason}.`);
    });
  }

  #reconnected(): void {
    this.#setState('online');
    this.logBus.push('discord', 'Connexion à Discord rétablie.');
  }

  #guildsChanged(): void {
    this.#emitStatus();
    this.#emit({ type: 'bot:discovery-changed' });
  }

  #refreshPing(): void {
    const { ping } = this.status();
    if (ping !== this.#lastPing) this.#emitStatus();
  }

  #fail(message: string): void {
    this.logBus.push('error', message);
    this.#setState('error', message);
  }

  #setState(state: BotState, error: string | null = null): void {
    this.#state = state;
    this.#error = error;
    this.#emitStatus();
  }

  #emitStatus(): void {
    const status = this.status();
    this.#lastPing = status.ping;
    this.#emit({ type: 'bot:status', status });
  }

  #emit(event: BotEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  #wantsRunning(): boolean {
    const row = this.db.select().from(botSettings).where(eq(botSettings.id, BOT_SETTINGS_ID)).get();
    return row?.autoStart ?? false;
  }

  #setAutoStart(autoStart: boolean): void {
    this.db
      .insert(botSettings)
      .values({ id: BOT_SETTINGS_ID, autoStart })
      .onConflictDoUpdate({ target: botSettings.id, set: { autoStart, updatedAt: new Date() } })
      .run();
  }
}

export function inviteUrl(applicationId: string): string {
  const params = new URLSearchParams({
    client_id: applicationId,
    scope: 'bot',
    permissions: INVITE_PERMISSIONS.toString(),
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

function describeLoginError(error: unknown, membersIntent: boolean): string {
  const message = errorMessage(error);
  const code = error instanceof Error && 'code' in error ? error.code : undefined;
  if (code === DiscordjsErrorCodes.TokenInvalid || message === 'Authentication failed') {
    return TOKEN_INVALID;
  }
  if (message === 'Used disallowed intents') return intentMissing(membersIntent);
  return `Connexion à Discord impossible : ${message}`;
}

function describeCloseCode(code: number, membersIntent: boolean): string {
  if (code === GatewayCloseCodes.AuthenticationFailed) return TOKEN_INVALID;
  if (code === GatewayCloseCodes.DisallowedIntents) return intentMissing(membersIntent);
  return `Discord a fermé la connexion (code ${code}).`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
