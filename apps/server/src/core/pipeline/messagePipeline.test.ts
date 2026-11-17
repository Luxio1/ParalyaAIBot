import { DEFAULT_BOT_CONFIG, type BotConfig } from '@bot/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../ai/aiProvider';
import { AiService } from '../ai/aiService';
import { FakeAiProvider } from '../ai/fakeAiProvider';
import { LogBus } from '../logs/logBus';
import {
  AI_FAILURE_REPLY,
  MessagePipeline,
  type IncomingMessage,
  type Transport,
} from './messagePipeline';

const CHANNEL = '100000000000000001';
const OTHER_CHANNEL = '100000000000000002';
let nextId = 1;

function message(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    id: String(nextId++),
    text: 'Bonjour',
    author: { id: '200000000000000001', displayName: 'Alice' },
    isDM: false,
    channelId: CHANNEL,
    channelName: 'général',
    mentionsBot: false,
    repliesToBot: false,
    ...overrides,
  };
}

describe('MessagePipeline', () => {
  let config: BotConfig;
  let aiProvider: FakeAiProvider;
  let logBus: LogBus;
  let pipeline: MessagePipeline;
  let replies: string[];
  let transport: Transport;

  beforeEach(() => {
    config = DEFAULT_BOT_CONFIG;
    aiProvider = new FakeAiProvider();
    logBus = new LogBus();
    pipeline = new MessagePipeline(() => config, new AiService(aiProvider), logBus);
    replies = [];
    transport = {
      reply: async (text) => void replies.push(text),
      startTyping: () => () => undefined,
    };
  });

  const configure = (changes: Partial<BotConfig>) => {
    config = { ...DEFAULT_BOT_CONFIG, ...changes };
  };
  const handle = (overrides: Partial<IncomingMessage>) =>
    pipeline.handle(message(overrides), transport);
  const prompts = () => aiProvider.requests.map((request) => request.prompt);

  it('répond à une mention, à une réponse à son message et au préfixe', async () => {
    await handle({ text: 'Quelle heure ?', mentionsBot: true });
    await handle({ text: 'Et demain ?', repliesToBot: true });
    await handle({ text: '!  Une blague' });
    await handle({ text: 'Discussion entre membres' });

    expect(prompts()).toEqual(['Quelle heure ?', 'Et demain ?', 'Une blague']);
    expect(replies).toEqual(Array(3).fill('Réponse de test.'));
  });

  it.each([
    ['mention', { text: '!question' }, { text: 'question', mentionsBot: true }],
    ['prefix', { text: 'question', mentionsBot: true }, { text: '!question' }],
  ] as const)("en mode %s, ignore l'autre déclencheur", async (mode, ignored, answered) => {
    configure({ triggerMode: mode });
    await handle(ignored);
    await handle(answered);
    expect(prompts()).toEqual(['question']);
  });

  it("envoie une aide si le déclencheur n'est suivi d'aucun texte", async () => {
    await handle({ text: '!' });
    expect(replies).toEqual([
      'Bonjour ! Pour me poser une question, écrivez votre question après « ! ».',
    ]);
    expect(aiProvider.requests).toHaveLength(0);
  });

  it('ne répond que dans les salons de la liste blanche', async () => {
    configure({ channelMode: 'whitelist', allowedChannelIds: [CHANNEL] });
    await handle({ text: 'ici', mentionsBot: true });
    await handle({ text: 'ailleurs', mentionsBot: true, channelId: OTHER_CHANNEL });
    expect(prompts()).toEqual(['ici']);
  });

  it('répond aux MP sans déclencheur, sauf si les MP sont désactivés', async () => {
    await handle({ text: 'Salut', isDM: true, channelId: null });
    configure({ allowDMs: false });
    await handle({ text: 'Encore là ?', isDM: true, channelId: null });
    expect(prompts()).toEqual(['Salut']);
  });

  it('ne traite jamais deux fois le même message', async () => {
    const duplicate = message({ text: 'Une fois', mentionsBot: true });
    await pipeline.handle(duplicate, transport);
    await pipeline.handle(duplicate, transport);
    expect(replies).toHaveLength(1);
  });

  it('applique les réglages modifiés dès le message suivant', async () => {
    await handle({ text: 'Avant', mentionsBot: true });
    configure({ model: 'gemini-autre', systemPrompt: 'Tu es un pirate.' });
    await handle({ text: 'Après', mentionsBot: true });

    const [before, after] = aiProvider.requests;
    expect(before?.model).toBe(DEFAULT_BOT_CONFIG.model);
    expect(after?.model).toBe('gemini-autre');
    expect(after?.systemPrompt).toMatch(/^Tu es un pirate\.[\s\S]*Alice dans le salon #général/);
  });

  it("répond un message neutre et journalise la cause si l'IA échoue", async () => {
    aiProvider.error = new AiError('quota', 'Quota Gemini atteint.');
    await handle({ text: 'Question', mentionsBot: true });

    expect(replies).toEqual([AI_FAILURE_REPLY]);
    expect(logBus.entries().at(-1)).toMatchObject({
      type: 'error',
      message: 'Quota Gemini atteint.',
    });
  });
});
