import { DISCORD_MAX_MESSAGE_LENGTH, MAX_ROLE_DM_RECIPIENTS } from '@bot/shared';
import type { Guild, Message, SendableChannels, User } from 'discord.js';
import type { EventActions } from '../../core/events/eventEngine';
import { chunkText } from '../../lib/chunkText';

const MEMBERS_REFRESH_MS = 10 * 60_000;
const membersFetchedAt = new Map<string, number>();

export function discordEventActions(message: Message): EventActions {
  const { client } = message;
  return {
    dmAuthor: (text) => sendDm(message.author, text),
    async dmUser(userId, text) {
      await sendDm(await client.users.fetch(userId), text);
    },
    async dmRoleMembers(roleId, text) {
      const guild = client.guilds.cache.find((candidate) => candidate.roles.cache.has(roleId));
      if (!guild) throw new Error('rôle introuvable sur les serveurs du bot');
      await refreshMembers(guild);
      const members = [...(guild.roles.cache.get(roleId)?.members.values() ?? [])]
        .filter((member) => !member.user.bot)
        .slice(0, MAX_ROLE_DM_RECIPIENTS);
      let sent = 0;
      for (const member of members) {
        // Un membre qui refuse les MP ne doit pas priver les autres de l'alerte.
        await sendDm(member.user, text).then(
          () => sent++,
          () => undefined,
        );
      }
      return sent;
    },
    async postInSource(text, mentionRoleId) {
      if (!message.channel.isSendable()) throw new Error("pas de droit d'écriture dans ce salon");
      await post(message.channel, text, mentionRoleId);
    },
    async postInChannel(channelId, text, mentionRoleId) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.isDMBased() || !channel.isSendable()) {
        throw new Error("salon introuvable ou sans droit d'écriture pour le bot");
      }
      await post(channel, text, mentionRoleId);
    },
  };
}

async function sendDm(user: User, text: string): Promise<void> {
  for (const chunk of chunkText(text, DISCORD_MAX_MESSAGE_LENGTH)) {
    await user.send({ content: chunk, allowedMentions: { parse: [] } });
  }
}

/** Seul le rôle choisi pour la règle peut être notifié, quoi que contienne le texte. */
async function post(channel: SendableChannels, text: string, mentionRoleId: string | null) {
  const content = mentionRoleId ? `<@&${mentionRoleId}> ${text}` : text;
  const roles = mentionRoleId ? [mentionRoleId] : [];
  for (const [index, chunk] of chunkText(content, DISCORD_MAX_MESSAGE_LENGTH).entries()) {
    await channel.send({
      content: chunk,
      allowedMentions: { parse: [], roles: index === 0 ? roles : [] },
    });
  }
}

/**
 * Charge la liste des membres (intent « Server Members » requis), au plus toutes les 10 minutes :
 * l'intent tient ensuite le cache à jour.
 */
async function refreshMembers(guild: Guild): Promise<void> {
  const fetchedAt = membersFetchedAt.get(guild.id) ?? 0;
  if (Date.now() - fetchedAt < MEMBERS_REFRESH_MS) return;
  await guild.members.fetch();
  membersFetchedAt.set(guild.id, Date.now());
}
