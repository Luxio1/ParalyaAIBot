import { EventEmitter } from 'node:events';
import { Events, type ChannelType, type Client } from 'discord.js';

export interface FakeGuild {
  id: string;
  name: string;
  channels: { id: string; name: string; type: ChannelType; category?: string }[];
  roles: { id: string; name: string; position: number; color: number }[];
}

export interface FakeDiscordOptions {
  /** Erreur renvoyée par `login`, à la place d'une connexion réussie. */
  loginError?: Error;
  guilds?: FakeGuild[];
}

/** Pour les tests : imite la partie de `Client` (discord.js) utilisée par `BotManager`, sans réseau. */
export class FakeDiscordClient extends EventEmitter {
  token: string | null = null;
  user: { id: string; tag: string; displayAvatarURL(): string } | null = null;
  readonly application = { id: 'application-id' };
  readonly ws = { ping: 42 };
  readonly guilds = { cache: new Map<string, unknown>() };
  destroyed = false;

  constructor(private readonly options: FakeDiscordOptions) {
    super();
  }

  async login(token: string): Promise<string> {
    if (this.options.loginError) throw this.options.loginError;
    this.token = token;
    this.user = {
      id: 'bot-id',
      tag: 'Paralya#0001',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/bot-id/avatar.png',
    };
    for (const guild of this.options.guilds ?? []) this.guilds.cache.set(guild.id, toGuild(guild));
    this.emit(Events.ClientReady, this);
    return token;
  }

  isReady(): boolean {
    return this.user !== null;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
  }
}

/** Fabrique de clients factices ; `options` reste modifiable entre deux connexions. */
export function fakeDiscord(options: FakeDiscordOptions = {}) {
  const created: FakeDiscordClient[] = [];
  return {
    options,
    created,
    createClient: () => {
      const client = new FakeDiscordClient(options);
      created.push(client);
      return client as unknown as Client;
    },
  };
}
export type FakeDiscord = ReturnType<typeof fakeDiscord>;

function toGuild(guild: FakeGuild) {
  const categories = new Map<string, { name: string; rawPosition: number }>();
  const channels = guild.channels.map((channel, index) => {
    let parent = null;
    if (channel.category) {
      parent = categories.get(channel.category) ?? {
        name: channel.category,
        rawPosition: categories.size,
      };
      categories.set(channel.category, parent);
    }
    return [channel.id, { ...channel, parent, rawPosition: index }] as const;
  });
  const everyone = { id: guild.id, name: '@everyone', position: 0, color: 0 };
  const roles = [everyone, ...guild.roles].map((role) => [
    role.id,
    { ...role, hexColor: `#${role.color.toString(16).padStart(6, '0')}` },
  ]);
  return {
    id: guild.id,
    name: guild.name,
    iconURL: () => null,
    channels: { cache: new Map(channels) },
    roles: { cache: new Map(roles as [string, unknown][]) },
  };
}
