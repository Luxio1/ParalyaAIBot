import type { DiscoveredGuild } from '@bot/shared';
import { ChannelType, type Guild, type GuildBasedChannel } from 'discord.js';

const CHANNEL_KINDS = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildAnnouncement]: 'announcement',
  [ChannelType.GuildForum]: 'forum',
} as const;

type ListedChannelType = keyof typeof CHANNEL_KINDS;
type ListedChannel = Extract<GuildBasedChannel, { type: ListedChannelType }>;

/** Serveurs vus par le bot, avec les salons où il peut écrire et les rôles, depuis le cache de discord.js. */
export function discoverGuilds(guilds: Iterable<Guild>): DiscoveredGuild[] {
  return [...guilds]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 64 }),
      channels: [...guild.channels.cache.values()]
        .filter(isListedChannel)
        .sort(byDiscordOrder)
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          kind: CHANNEL_KINDS[channel.type],
          category: channel.parent?.name ?? null,
        })),
      roles: [...guild.roles.cache.values()]
        .filter((role) => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color === 0 ? null : role.hexColor,
        })),
    }));
}

function isListedChannel(channel: GuildBasedChannel): channel is ListedChannel {
  return channel.type in CHANNEL_KINDS;
}

/** Discord affiche d'abord les salons sans catégorie, puis chaque catégorie dans l'ordre. */
function byDiscordOrder(a: ListedChannel, b: ListedChannel): number {
  const categoryA = a.parent?.rawPosition ?? -1;
  const categoryB = b.parent?.rawPosition ?? -1;
  return categoryA - categoryB || a.rawPosition - b.rawPosition;
}
