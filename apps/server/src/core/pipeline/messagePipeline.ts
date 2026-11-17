import type { BotConfig } from '@bot/shared';
import { AiError } from '../ai/aiProvider';
import type { AiService } from '../ai/aiService';
import type { LogBus } from '../logs/logBus';

/** Message reçu, indépendant de sa source (Discord, et le simulateur au J8). */
export interface IncomingMessage {
  id: string;
  /** Mentions remplacées par des noms lisibles ; la mention du bot est retirée. */
  text: string;
  author: { id: string; displayName: string };
  isDM: boolean;
  /** Salon, ou salon parent pour un fil ; `null` en MP. */
  channelId: string | null;
  channelName: string;
  mentionsBot: boolean;
  repliesToBot: boolean;
}

/** Moyen de répondre là où le message est arrivé. */
export interface Transport {
  reply(text: string): Promise<void>;
  /** Affiche « est en train d'écrire » ; renvoie la fonction qui l'arrête. */
  startTyping(): () => void;
}

/** Réponse aux utilisateurs quand l'IA échoue : la cause exacte va dans la console. */
export const AI_FAILURE_REPLY = 'Je ne peux pas répondre pour le moment.';

const DEDUP_SIZE = 1000;
const LOG_PREVIEW_LENGTH = 80;

export class MessagePipeline {
  /** Identifiants déjà traités, du plus ancien au plus récent. */
  readonly #seen = new Set<string>();

  constructor(
    private readonly getConfig: () => BotConfig,
    private readonly ai: AiService,
    private readonly logBus: LogBus,
  ) {}

  /** Ne lève jamais : les erreurs sont journalisées. */
  async handle(message: IncomingMessage, transport: Transport): Promise<void> {
    if (this.#alreadySeen(message.id)) return;
    const config = this.getConfig();
    const query = extractQuery(message, config);
    if (query === null) return;

    const where = message.isDM ? 'en MP' : `dans #${message.channelName}`;
    if (query === '') {
      await this.#send(transport, helpMessage(config), message);
      return;
    }
    this.logBus.push(
      message.isDM ? 'dm' : 'discord',
      `@${message.author.displayName} ${where} : « ${preview(query)} »`,
    );

    const stopTyping = transport.startTyping();
    const startedAt = Date.now();
    let answer: string;
    try {
      answer = await this.ai.generate({
        model: config.model,
        systemPrompt: systemPrompt(config, message),
        prompt: query,
      });
    } catch (error) {
      stopTyping();
      const reason = error instanceof AiError ? error.message : `Erreur IA : ${String(error)}`;
      this.logBus.push('error', reason);
      await this.#send(transport, AI_FAILURE_REPLY, message);
      return;
    }
    stopTyping();
    this.logBus.push(
      'ai',
      `${config.model} : ${answer.length} caractères en ${((Date.now() - startedAt) / 1000).toFixed(1)} s.`,
    );
    if (await this.#send(transport, answer, message)) {
      this.logBus.push('success', `Réponse envoyée à @${message.author.displayName} ${where}.`);
    }
  }

  async #send(transport: Transport, text: string, message: IncomingMessage): Promise<boolean> {
    try {
      await transport.reply(text);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logBus.push('error', `Envoi impossible à @${message.author.displayName} : ${reason}`);
      return false;
    }
  }

  #alreadySeen(id: string): boolean {
    if (this.#seen.has(id)) return true;
    this.#seen.add(id);
    if (this.#seen.size > DEDUP_SIZE) {
      this.#seen.delete(this.#seen.values().next().value as string);
    }
    return false;
  }
}

/**
 * Question adressée au bot, `''` si le déclencheur est vide, `null` si le message ne le concerne pas.
 * En MP, tout message s'adresse au bot.
 */
export function extractQuery(message: IncomingMessage, config: BotConfig): string | null {
  const text = message.text.trim();
  const hasPrefix = text.startsWith(config.prefix);
  const withoutPrefix = hasPrefix ? text.slice(config.prefix.length).trim() : text;

  if (message.isDM) return config.allowDMs ? withoutPrefix : null;

  if (config.channelMode === 'whitelist') {
    if (!message.channelId || !config.allowedChannelIds.includes(message.channelId)) return null;
  }
  const byPrefix = config.triggerMode !== 'mention' && hasPrefix;
  const byMention =
    config.triggerMode !== 'prefix' && (message.mentionsBot || message.repliesToBot);
  if (byPrefix) return withoutPrefix;
  if (byMention) return text;
  return null;
}

function helpMessage(config: BotConfig): string {
  const how =
    config.triggerMode === 'mention'
      ? 'mentionnez-moi suivi de votre question'
      : `écrivez votre question après « ${config.prefix} »`;
  return `Bonjour ! Pour me poser une question, ${how}.`;
}

function systemPrompt(config: BotConfig, message: IncomingMessage): string {
  const where = message.isDM ? 'en message privé' : `dans le salon #${message.channelName}`;
  return `${config.systemPrompt}

Tu es un bot Discord. Tu réponds à ${message.author.displayName} ${where}. Rédige directement ta réponse, sans préambule ni commentaire sur ta réponse. Tu peux utiliser le Markdown de Discord.`;
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > LOG_PREVIEW_LENGTH
    ? `${oneLine.slice(0, LOG_PREVIEW_LENGTH)}...`
    : oneLine;
}
