import type { BotConfig, EventRule, EventTestRequest, EventTestResult } from '@bot/shared';
import { z } from 'zod';
import { AiError } from '../ai/aiProvider';
import type { AiService } from '../ai/aiService';
import { DATA_BLOCK_RULE, dataBlock } from '../ai/promptData';
import type { LogBus } from '../logs/logBus';
import type { IncomingMessage } from '../pipeline/messagePipeline';
import { fillVariables, type EventVariables } from './variables';

/** Envois déclenchés par une règle ; implémentés par l'adaptateur (Discord). */
export interface EventActions {
  dmAuthor(text: string): Promise<void>;
  dmUser(userId: string, text: string): Promise<void>;
  /** Renvoie le nombre de membres effectivement contactés. */
  dmRoleMembers(roleId: string, text: string): Promise<number>;
  /** `mentionRoleId` est la seule mention autorisée à notifier. */
  postInSource(text: string, mentionRoleId: string | null): Promise<void>;
  postInChannel(channelId: string, text: string, mentionRoleId: string | null): Promise<void>;
}

export interface EventEngineDeps {
  getConfig: () => BotConfig;
  getRules: () => EventRule[];
  ai: AiService;
  logBus: LogBus;
  now?: () => number;
}

interface Verdict {
  matched: boolean;
  reason: string;
}

const BUDGET_WINDOW_MS = 60_000;
/** Un message avec moins de lettres (« ok », un emoji, un lien seul) n'est pas analysé. */
const MIN_LETTERS = 3;

const evaluationSchema = z.object({
  matches: z.array(z.object({ id: z.number(), matched: z.boolean(), reason: z.string() })),
});

/** Schéma imposé à la réponse de Gemini, miroir de `evaluationSchema`. */
const EVALUATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          matched: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['id', 'matched', 'reason'],
      },
    },
  },
  required: ['matches'],
};

const EVALUATION_SYSTEM_PROMPT = [
  "Tu es le moteur de détection d'événements d'un serveur Discord.",
  'Pour chaque règle, décide si le message correspond sans ambiguïté à la situation décrite par son critère. Sois strict : en cas de doute, la règle ne correspond pas.',
  'Donne pour chaque règle une raison courte, 15 mots au plus, en français.',
  DATA_BLOCK_RULE,
].join('\n');

const WRITER_SYSTEM_PROMPT = [
  "Tu rédiges un message envoyé par un bot Discord à la suite du déclenchement d'une règle de modération ou d'animation.",
  'Rédige directement le message final, sans préambule ni commentaire. Tu peux utiliser le Markdown de Discord.',
  DATA_BLOCK_RULE,
].join('\n');

/**
 * Analyse les messages des serveurs selon les règles d'événements. Une seule requête à l'IA par
 * message, seulement si une règle est concernée, dans la limite d'un budget par minute.
 */
export class EventEngine {
  /** `<règle>:<utilisateur>` vers la fin du délai de la règle pour cette personne. */
  readonly #cooldowns = new Map<string, number>();
  #budget = { windowStart: 0, used: 0, warned: false };

  constructor(private readonly deps: EventEngineDeps) {}

  /** `botAnswers` : le bot répond déjà à ce message, l'action dans le salon d'origine est sautée. */
  async handle(
    message: IncomingMessage,
    actions: EventActions,
    botAnswers: boolean,
  ): Promise<void> {
    const config = this.deps.getConfig();
    if (!config.eventsEnabled || message.isDM || !hasEnoughLetters(message.text)) return;
    const now = this.#now();
    const candidates = this.deps
      .getRules()
      .filter((rule) => rule.enabled && watches(rule, message.channelId))
      .filter((rule) => (this.#cooldowns.get(cooldownKey(rule, message)) ?? 0) <= now);
    if (candidates.length === 0 || !this.#takeBudget(config.eventsMaxPerMinute)) return;

    let verdicts: Map<number, Verdict>;
    try {
      verdicts = await this.evaluate(
        message.text,
        message.author.displayName,
        message.channelName,
        candidates,
        config.eventsModel,
      );
    } catch (error) {
      this.deps.logBus.push('error', `Analyse des événements impossible : ${reason(error)}`);
      return;
    }

    for (const rule of candidates) {
      const verdict = verdicts.get(rule.id);
      if (!verdict?.matched) continue;
      this.#cooldowns.set(cooldownKey(rule, message), now + rule.cooldownSeconds * 1000);
      this.deps.logBus.push(
        'event',
        `Règle « ${rule.name} » déclenchée par @${message.author.displayName} dans #${message.channelName} : ${verdict.reason}`,
      );
      await this.#execute(rule, variables(message, verdict.reason), actions, botAnswers, config);
    }
  }

  /** Testeur du dashboard : toutes les règles, sans filtre de salon, délai ni action réelle. */
  async test(request: EventTestRequest, rules: EventRule[]): Promise<EventTestResult[]> {
    if (rules.length === 0) return [];
    const { eventsModel } = this.deps.getConfig();
    const verdicts = await this.evaluate(
      request.message,
      request.authorName,
      'test',
      rules,
      eventsModel,
    );
    return rules.map((rule) => {
      const verdict = verdicts.get(rule.id) ?? {
        matched: false,
        reason: 'Aucune réponse pour cette règle.',
      };
      const values: EventVariables = {
        user: `@${request.authorName}`,
        pseudo: request.authorName,
        userId: '000000000000000000',
        channel: 'test',
        message: request.message,
        reason: verdict.reason,
      };
      const preview = (action: { enabled: boolean; mode: string; text: string }) => {
        if (!action.enabled) return null;
        return action.mode === 'ai'
          ? `(Rédigé par l'IA selon : ${action.text})`
          : fillVariables(action.text, values);
      };
      return {
        ruleId: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        matched: verdict.matched,
        reason: verdict.reason,
        dmPreview: preview(rule.dm),
        channelPreview: preview(rule.channel),
      };
    });
  }

  /** Une requête pour toutes les règles ; une règle absente de la réponse ne se déclenche pas. */
  async evaluate(
    text: string,
    authorName: string,
    channelName: string,
    rules: EventRule[],
    model: string,
  ): Promise<Map<number, Verdict>> {
    const ruleList = rules.map((rule) => `- règle ${rule.id} : ${rule.triggerPrompt}`).join('\n');
    const raw = await this.deps.ai.generate({
      model,
      systemPrompt: EVALUATION_SYSTEM_PROMPT,
      history: [],
      images: [],
      prompt: `Règles :\n${ruleList}\n\n${dataBlock(`message de ${authorName} dans #${channelName}`, text)}`,
      jsonSchema: EVALUATION_JSON_SCHEMA,
    });
    let parsed: z.infer<typeof evaluationSchema>;
    try {
      parsed = evaluationSchema.parse(JSON.parse(raw));
    } catch {
      throw new AiError('other', "réponse de l'IA illisible");
    }
    const known = new Set(rules.map((rule) => rule.id));
    return new Map(
      parsed.matches
        .filter((match) => known.has(match.id))
        .map((match) => [match.id, { matched: match.matched, reason: match.reason.trim() }]),
    );
  }

  /** Oublie les délais écoulés. */
  sweep(): void {
    const now = this.#now();
    for (const [key, until] of this.#cooldowns) if (until <= now) this.#cooldowns.delete(key);
  }

  async #execute(
    rule: EventRule,
    values: EventVariables,
    actions: EventActions,
    botAnswers: boolean,
    config: BotConfig,
  ): Promise<void> {
    const attempt = async (label: string, send: () => Promise<string>) => {
      try {
        this.deps.logBus.push('event', `Règle « ${rule.name} » : ${await send()}.`);
      } catch (error) {
        this.deps.logBus.push(
          'error',
          `Règle « ${rule.name} » : ${label} impossible (${reason(error)}).`,
        );
      }
    };

    const { dm, channel } = rule;
    if (dm.enabled) {
      await attempt('MP', async () => {
        const text = await this.#text(rule, dm, values, config);
        if (dm.target === 'author') {
          await actions.dmAuthor(text);
          return `MP envoyé à ${values.user}`;
        }
        if (!dm.targetId) throw new Error('destinataire non choisi');
        if (dm.target === 'user') {
          await actions.dmUser(dm.targetId, text);
          return `MP envoyé à l'utilisateur ${dm.targetId}`;
        }
        if (!config.membersIntent) {
          throw new Error("l'accès à la liste des membres est désactivé (page Événements)");
        }
        return `MP envoyé à ${await actions.dmRoleMembers(dm.targetId, text)} membre(s) du rôle`;
      });
    }

    if (channel.enabled) {
      if (channel.target === 'source' && botAnswers) {
        this.deps.logBus.push(
          'event',
          `Règle « ${rule.name} » : message dans le salon d'origine sauté, le bot y répond déjà.`,
        );
        return;
      }
      await attempt('message de salon', async () => {
        const text = await this.#text(rule, channel, values, config);
        if (channel.target === 'source') {
          await actions.postInSource(text, channel.mentionRoleId);
          return `message envoyé dans #${values.channel}`;
        }
        if (!channel.channelId) throw new Error('salon non choisi');
        await actions.postInChannel(channel.channelId, text, channel.mentionRoleId);
        return 'alerte envoyée';
      });
    }
  }

  /** Texte d'une action : variables remplacées, ou rédaction par l'IA selon la consigne. */
  async #text(
    rule: EventRule,
    action: { mode: string; text: string },
    values: EventVariables,
    config: BotConfig,
  ): Promise<string> {
    if (action.mode === 'custom') return fillVariables(action.text, values);
    return this.deps.ai.generate({
      model: config.eventsModel,
      systemPrompt: WRITER_SYSTEM_PROMPT,
      history: [],
      images: [],
      prompt: [
        `Consigne : ${action.text}`,
        `La règle « ${rule.name} » s'est déclenchée. Raison : ${values.reason}`,
        dataBlock(
          `message de ${values.pseudo} (${values.user}) dans #${values.channel}`,
          values.message,
        ),
      ].join('\n\n'),
    });
  }

  /** Fenêtre fixe d'une minute ; le dépassement est signalé une fois par fenêtre. */
  #takeBudget(maxPerMinute: number): boolean {
    const now = this.#now();
    if (now - this.#budget.windowStart >= BUDGET_WINDOW_MS) {
      this.#budget = { windowStart: now, used: 0, warned: false };
    }
    if (this.#budget.used < maxPerMinute) {
      this.#budget.used++;
      return true;
    }
    if (!this.#budget.warned) {
      this.#budget.warned = true;
      this.deps.logBus.push(
        'system',
        `Budget d'analyse atteint (${maxPerMinute} par minute) : les messages suivants ne sont pas analysés jusqu'à la minute suivante.`,
      );
    }
    return false;
  }

  #now(): number {
    return (this.deps.now ?? Date.now)();
  }
}

function watches(rule: EventRule, channelId: string | null): boolean {
  return rule.channelMode === 'all' || (channelId !== null && rule.channelIds.includes(channelId));
}

function cooldownKey(rule: EventRule, message: IncomingMessage): string {
  return `${rule.id}:${message.author.id}`;
}

function hasEnoughLetters(text: string): boolean {
  const withoutLinks = text.replace(/https?:\/\/\S+/g, '');
  return (withoutLinks.match(/\p{L}/gu)?.length ?? 0) >= MIN_LETTERS;
}

function variables(message: IncomingMessage, verdictReason: string): EventVariables {
  return {
    user: `@${message.author.username}`,
    pseudo: message.author.displayName,
    userId: message.author.id,
    channel: message.channelName,
    message: message.text,
    reason: verdictReason,
  };
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
