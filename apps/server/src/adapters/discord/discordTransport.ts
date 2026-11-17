import { DISCORD_MAX_MESSAGE_LENGTH } from '@bot/shared';
import { cleanContent, type Guild, type Message } from 'discord.js';
import type {
  Attachment,
  IncomingMessage,
  QuotedMessage,
  Transport,
} from '../../core/pipeline/messagePipeline';
import { chunkText } from '../../lib/chunkText';

/** Discord efface l'indicateur au bout de 10 s ; il faut le renvoyer tant que la réponse se prépare. */
const TYPING_REFRESH_MS = 8_000;

/** `null` pour les messages à ignorer d'emblée : bots (dont lui-même) et messages système. */
export function toIncomingMessage(message: Message, botId: string): IncomingMessage | null {
  if (message.author.bot || message.system) return null;
  const { channel } = message;
  // Mentionner le rôle automatique du bot revient à le mentionner (confusion fréquente dans l'autocomplétion).
  const botRoleId = message.guild?.members.me?.roles.botRole?.id;
  const mentionsBot =
    message.mentions.users.has(botId) ||
    (botRoleId !== undefined && message.mentions.roles.has(botRoleId));

  let withoutBot = message.content.replaceAll(`<@${botId}>`, ' ').replaceAll(`<@!${botId}>`, ' ');
  if (botRoleId) withoutBot = withoutBot.replaceAll(`<@&${botRoleId}>`, ' ');

  return {
    id: message.id,
    text: cleanContent(withoutBot, channel).trim(),
    author: {
      id: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName ?? message.author.displayName,
    },
    isDM: channel.isDMBased(),
    channelId: channel.isDMBased() ? null : channel.isThread() ? channel.parentId : channel.id,
    channelName: 'name' in channel && channel.name ? channel.name : 'MP',
    mentionsBot,
    repliesToBot: message.mentions.repliedUser?.id === botId,
    isReply: message.reference?.messageId !== undefined,
    attachments: toAttachments(message),
  };
}

/** `onReplied` reçoit chaque réponse envoyée (retranscription des MP). */
export function discordTransport(
  message: Message,
  botId: string,
  onReplied?: (text: string) => void,
): Transport {
  return {
    async reply(text) {
      // Le texte vient de l'IA : il ne doit notifier personne, sauf l'auteur de la question.
      const [first = '', ...rest] = chunkText(text, DISCORD_MAX_MESSAGE_LENGTH);
      await message.reply({ content: first, allowedMentions: { parse: [], repliedUser: true } });
      if (message.channel.isSendable()) {
        for (const chunk of rest) {
          await message.channel.send({ content: chunk, allowedMentions: { parse: [] } });
        }
      }
      onReplied?.(text);
    },
    async isExempt(roleIds) {
      const { guild, member, author } = message;
      if (guild) {
        return guild.ownerId === author.id || roleIds.some((id) => member?.roles.cache.has(id));
      }
      // En MP : propriétaire d'un serveur commun, ou rôle exempté sur le serveur qui le définit.
      const guilds = [...message.client.guilds.cache.values()];
      if (guilds.some((candidate) => candidate.ownerId === author.id)) return true;
      for (const candidate of guilds) {
        const wanted = roleIds.filter((id) => candidate.roles.cache.has(id));
        if (wanted.length === 0) continue;
        const roles = await memberRoles(candidate, author.id);
        if (wanted.some((id) => roles.has(id))) return true;
      }
      return false;
    },
    startTyping() {
      const { channel } = message;
      if (!channel.isSendable()) return () => undefined;
      const send = () => void channel.sendTyping().catch(() => undefined);
      send();
      const timer = setInterval(send, TYPING_REFRESH_MS);
      return () => clearInterval(timer);
    },
    async fetchQuoted(): Promise<QuotedMessage | null> {
      if (!message.reference?.messageId) return null;
      const quoted = await message.fetchReference();
      return {
        authorName: quoted.member?.displayName ?? quoted.author.displayName,
        isBot: quoted.author.id === botId,
        text: cleanContent(quoted.content, quoted.channel).trim(),
        attachments: toAttachments(quoted),
      };
    },
  };
}

const ROLES_CACHE_MS = 5 * 60_000;
const rolesCache = new Map<string, { roles: Set<string>; expiresAt: number }>();

/**
 * Rôles d'une personne sur un serveur, demandés à Discord puis gardés 5 minutes : sans l'intent
 * privilégié « membres », le cache de discord.js n'est pas tenu à jour.
 */
async function memberRoles(guild: Guild, userId: string): Promise<Set<string>> {
  const key = `${guild.id}:${userId}`;
  const cached = rolesCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.roles;
  const member = await guild.members.fetch({ user: userId, force: true }).catch(() => null);
  const roles = new Set(member ? member.roles.cache.keys() : []);
  rolesCache.set(key, { roles, expiresAt: Date.now() + ROLES_CACHE_MS });
  return roles;
}

function toAttachments(message: Message): Attachment[] {
  return message.attachments.map((attachment) => ({
    url: attachment.url,
    name: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
  }));
}
