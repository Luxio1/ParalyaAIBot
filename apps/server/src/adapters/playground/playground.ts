import { randomUUID } from 'node:crypto';
import type { PlaygroundRequest } from '@bot/shared';
import type {
  IncomingMessage,
  QuotedMessage,
  Transport,
} from '../../core/pipeline/messagePipeline';

/** Identifiant stable par pseudo : chaque pseudo du simulateur a sa propre mémoire. */
export function playgroundAuthorId(authorName: string): string {
  return authorName.trim().toLowerCase().replace(/\s+/g, '_');
}

export function playgroundMessage(request: PlaygroundRequest): IncomingMessage {
  const id = playgroundAuthorId(request.authorName);
  return {
    id: randomUUID(),
    text: request.text.trim(),
    author: { id, username: id, displayName: request.authorName.trim() },
    isDM: false,
    guildId: null,
    channelId: null,
    channelName: 'simulateur',
    mentionsBot: true,
    repliesToBot: false,
    isReply: false,
    attachments: [],
    inlineImages: request.images,
    isPlayground: true,
  };
}

/** Garde les réponses du bot au lieu de les envoyer sur Discord. */
export class PlaygroundTransport implements Transport {
  readonly replies: string[] = [];

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }

  startTyping(): () => void {
    return () => undefined;
  }

  async fetchQuoted(): Promise<QuotedMessage | null> {
    return null;
  }

  /** Celui qui teste est l'administrateur : jamais limité. */
  async isExempt(): Promise<boolean> {
    return true;
  }
}
