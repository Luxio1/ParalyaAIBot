import { DEFAULT_BOT_CONFIG, type BotConfig, type EventRule } from '@bot/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiService } from '../ai/aiService';
import { FakeAiProvider } from '../ai/fakeAiProvider';
import { LogBus } from '../logs/logBus';
import type { IncomingMessage } from '../pipeline/messagePipeline';
import { EventEngine, type EventActions } from './eventEngine';

const CHANNEL = '100000000000000001';
const ALERTS = '100000000000000009';
const STAFF_ROLE = '300000000000000001';

const TOXIC: EventRule = {
  id: 1,
  name: 'Toxicité',
  description: '',
  enabled: true,
  triggerPrompt: 'Insultes',
  channelMode: 'all',
  channelIds: [],
  cooldownSeconds: 60,
  dm: {
    enabled: true,
    target: 'author',
    targetId: null,
    mode: 'custom',
    text: 'Calme-toi {pseudo}.',
  },
  channel: {
    enabled: true,
    target: 'specific',
    channelId: ALERTS,
    mode: 'custom',
    text: '{user} dans #{channel} : {message} ({reason})',
    mentionRoleId: STAFF_ROLE,
  },
};

let nextId = 1;
function message(text: string, overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: String(nextId++),
    text,
    author: { id: '200000000000000001', username: 'alice', displayName: 'Alice' },
    isDM: false,
    guildId: '400000000000000001',
    channelId: CHANNEL,
    channelName: 'général',
    mentionsBot: false,
    repliesToBot: false,
    isReply: false,
    attachments: [],
    inlineImages: [],
    isPlayground: false,
    ...overrides,
  };
}

/** Réponse d'analyse : chaque règle listée est déclenchée avec cette raison. */
const verdict = (ids: number[], reason = 'insulte directe') =>
  JSON.stringify({ matches: ids.map((id) => ({ id, matched: true, reason })) });

describe('EventEngine', () => {
  let config: BotConfig;
  let rules: EventRule[];
  let now: number;
  let aiProvider: FakeAiProvider;
  let logBus: LogBus;
  let engine: EventEngine;
  let sent: string[];
  let actions: EventActions;

  beforeEach(() => {
    config = { ...DEFAULT_BOT_CONFIG, eventsEnabled: true };
    rules = [TOXIC];
    now = 0;
    aiProvider = new FakeAiProvider();
    aiProvider.answer = verdict([1]);
    logBus = new LogBus();
    engine = new EventEngine({
      getConfig: () => config,
      getRules: () => rules,
      ai: new AiService(aiProvider),
      logBus,
      now: () => now,
    });
    sent = [];
    actions = {
      dmAuthor: async (text) => void sent.push(`MP auteur : ${text}`),
      dmUser: async (id, text) => void sent.push(`MP ${id} : ${text}`),
      dmRoleMembers: async (id, text) => {
        sent.push(`MP rôle ${id} : ${text}`);
        return 3;
      },
      postInSource: async (text, role) => void sent.push(`source (${role}) : ${text}`),
      postInChannel: async (id, text, role) => void sent.push(`${id} (${role}) : ${text}`),
    };
  });

  const analyze = (text: string, overrides?: Partial<IncomingMessage>, botAnswers = false) =>
    engine.handle(message(text, overrides), actions, botAnswers);

  it("n'appelle pas l'IA sans règle concernée ni message à analyser", async () => {
    await analyze('Bonjour à tous', { isDM: true });
    await analyze('ok');
    await analyze('😀 https://exemple.fr/lien');
    rules = [{ ...TOXIC, channelMode: 'specific', channelIds: [ALERTS] }];
    await analyze('Bonjour à tous');
    config = { ...config, eventsEnabled: false };
    rules = [TOXIC];
    await analyze('Bonjour à tous');

    expect(aiProvider.requests).toHaveLength(0);
  });

  it('exécute les actions avec les variables, une seule mention de rôle, puis respecte le délai', async () => {
    await analyze('Tu es nul');
    expect(sent).toEqual([
      'MP auteur : Calme-toi Alice.',
      `${ALERTS} (${STAFF_ROLE}) : @alice dans #général : Tu es nul (insulte directe)`,
    ]);
    expect(aiProvider.requests[0]?.jsonSchema).toBeDefined();
    expect(aiProvider.requests[0]?.prompt).toContain('- règle 1 : Insultes');

    now = 59_000;
    await analyze('Encore nul');
    expect(aiProvider.requests).toHaveLength(1);
    now = 60_000;
    await analyze('Toujours nul');
    expect(aiProvider.requests).toHaveLength(2);
  });

  it('plafonne les analyses par minute et le signale une fois', async () => {
    config = { ...config, eventsMaxPerMinute: 1 };
    aiProvider.answer = verdict([]);
    await analyze('Premier message');
    await analyze('Deuxième message');
    await analyze('Troisième message');
    expect(aiProvider.requests).toHaveLength(1);
    expect(
      logBus.entries().filter((entry) => entry.message.startsWith("Budget d'analyse")),
    ).toHaveLength(1);

    now = 60_000;
    await analyze('Nouvelle minute');
    expect(aiProvider.requests).toHaveLength(2);
  });

  it("saute l'action dans le salon d'origine quand le bot répond déjà au message", async () => {
    rules = [
      {
        ...TOXIC,
        dm: { ...TOXIC.dm, enabled: false },
        channel: { ...TOXIC.channel, target: 'source' },
      },
    ];
    await analyze('Bot, tu es nul', {}, true);
    expect(sent).toEqual([]);
    expect(logBus.entries().at(-1)?.message).toMatch(/salon d'origine sauté/);
  });

  it("fait rédiger le texte par l'IA en mode IA", async () => {
    rules = [{ ...TOXIC, dm: { ...TOXIC.dm, mode: 'ai', text: 'Rappelle les règles' } }];
    aiProvider.respond = (request) => (request.jsonSchema ? verdict([1]) : 'Texte rédigé.');
    await analyze('Tu es nul');
    expect(sent[0]).toBe('MP auteur : Texte rédigé.');
    expect(aiProvider.requests[1]?.prompt).toMatch(/^Consigne : Rappelle les règles/);
  });

  it("n'agit pas sur une réponse illisible, ni sans l'accès aux membres pour un rôle", async () => {
    aiProvider.answer = 'pas du JSON';
    await analyze('Tu es nul');
    expect(sent).toEqual([]);
    expect(logBus.entries().at(-1)?.message).toBe(
      "Analyse des événements impossible : réponse de l'IA illisible",
    );

    rules = [
      {
        ...TOXIC,
        channel: { ...TOXIC.channel, enabled: false },
        dm: { ...TOXIC.dm, target: 'role', targetId: STAFF_ROLE },
      },
    ];
    aiProvider.answer = verdict([1]);
    await analyze('Tu es nul');
    expect(sent).toEqual([]);
    expect(logBus.entries().at(-1)?.message).toMatch(/accès à la liste des membres est désactivé/);
  });

  it('teste toutes les règles avec un aperçu des messages, sans rien envoyer', async () => {
    const disabled = { ...TOXIC, id: 2, name: 'Recrutement', enabled: false };
    aiProvider.answer = JSON.stringify({
      matches: [
        { id: 1, matched: true, reason: 'insulte' },
        { id: 2, matched: false, reason: 'aucune candidature' },
      ],
    });
    const results = await engine.test({ message: 'Tu es nul', authorName: 'Testeur' }, [
      TOXIC,
      disabled,
    ]);

    expect(results).toEqual([
      {
        ruleId: 1,
        name: 'Toxicité',
        enabled: true,
        matched: true,
        reason: 'insulte',
        dmPreview: 'Calme-toi Testeur.',
        channelPreview: '@Testeur dans #test : Tu es nul (insulte)',
      },
      expect.objectContaining({ ruleId: 2, enabled: false, matched: false }),
    ]);
    expect(sent).toEqual([]);
  });
});
