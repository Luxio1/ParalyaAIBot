import { DISCORD_MAX_MESSAGE_LENGTH } from '@bot/shared';
import type { Client } from 'discord.js';
import { chunkText } from '../../lib/chunkText';

export interface RelayAuthor {
  id: string;
  username: string;
  displayName: string;
}

export function formatIncomingDm(
  author: RelayAuthor,
  text: string,
  attachments: { name: string; url: string }[],
): string {
  const lines = [
    `📩 **MP reçu de ${author.displayName}** (@${author.username}, \`${author.id}\`) :`,
    quote(text || '(sans texte)'),
    ...attachments.map((attachment) => `📎 [${attachment.name}](<${attachment.url}>)`),
  ];
  return lines.join('\n');
}

export function formatBotReply(author: RelayAuthor, text: string): string {
  return `🤖 **Réponse du bot à ${author.displayName}** (@${author.username}) :\n${quote(text)}`;
}

/** Les messages recopiés ne notifient personne, même s'ils contiennent @everyone ou une mention. */
export async function sendToRelay(
  client: Client,
  channelId: string,
  content: string,
): Promise<void> {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.isDMBased() || !channel.isSendable()) {
    throw new Error("salon introuvable ou sans droit d'écriture pour le bot");
  }
  for (const chunk of chunkText(content, DISCORD_MAX_MESSAGE_LENGTH)) {
    await channel.send({ content: chunk, allowedMentions: { parse: [] } });
  }
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}
