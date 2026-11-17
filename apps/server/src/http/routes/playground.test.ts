import { DEFAULT_BOT_CONFIG } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

/** PNG de 1 pixel. */
const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('routes /api/playground', () => {
  let ctx: TestApp;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestApp();
    cookie = await setupAdmin(ctx);
  });

  afterEach(async () => {
    await ctx.close();
  });

  const say = (text: string, overrides: object = {}) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/playground/messages',
      headers: { cookie },
      payload: { text, authorName: 'Alice', images: [], evaluateEvents: false, ...overrides },
    });

  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/playground/messages' });
    expect(response.statusCode).toBe(401);
  });

  it('répond comme sur Discord, commandes comprises, sans quota ni réglage des MP', async () => {
    ctx.config.update({
      ...DEFAULT_BOT_CONFIG,
      allowDMs: false,
      rateLimitEnabled: true,
      rateLimitMaxRequests: 1,
    });
    expect((await say('Bonjour')).json()).toEqual({
      replies: ['Réponse de test.'],
      events: [],
      eventsError: null,
    });
    expect((await say('Encore')).json().replies).toEqual(['Réponse de test.']);
    expect((await say('!regles')).json().replies[0]).toMatch(/^📜 \*\*Règles du serveur/);
  });

  it('garde une mémoire par pseudo, effaçable', async () => {
    await say('Je suis Alice');
    await say('Je suis Bob', { authorName: 'Bob' });
    expect(
      ctx.memory
        .list(60_000)
        .map((session) => [session.kind, session.userName])
        .sort(),
    ).toEqual([
      ['playground', 'Alice'],
      ['playground', 'Bob'],
    ]);

    await ctx.app.inject({
      method: 'POST',
      url: '/api/playground/reset',
      headers: { cookie },
      payload: { authorName: 'Alice' },
    });
    expect(ctx.memory.list(60_000).map((session) => session.userName)).toEqual(['Bob']);
  });

  it("transmet les images collées à l'IA, sans texte", async () => {
    await say('', { images: [{ mimeType: 'image/png', data: PIXEL }] });
    expect(ctx.aiProvider.requests[0]?.images).toEqual([{ mimeType: 'image/png', data: PIXEL }]);
  });

  it("accepte une image de plus d'1 Mo, limite des autres routes", async () => {
    const large = 'A'.repeat(2_000_000);
    const response = await say('', { images: [{ mimeType: 'image/png', data: large }] });
    expect(response.statusCode).toBe(200);
  });

  it('refuse un message vide ou une image dans un format non pris en charge', async () => {
    expect((await say('   ')).json().message).toBe('Message vide.');
    const gif = await say('', { images: [{ mimeType: 'image/gif', data: PIXEL }] });
    expect(gif.json().message).toBe('Image : PNG, JPEG ou WebP uniquement.');
  });

  it("montre les règles qui se seraient déclenchées, sans exécuter d'action", async () => {
    const [rule] = ctx.eventRules.list();
    if (!rule) throw new Error('exemples absents');
    ctx.eventRules.update(rule.id, {
      ...rule,
      enabled: true,
      channel: { ...rule.channel, enabled: false },
    });
    ctx.aiProvider.respond = (request) =>
      request.jsonSchema
        ? JSON.stringify({ matches: [{ id: rule.id, matched: true, reason: 'insulte' }] })
        : 'Réponse de test.';

    const response = (await say('Tu es nul', { evaluateEvents: true })).json();
    expect(response.replies).toEqual(['Réponse de test.']);
    expect(response.events).toEqual([
      expect.objectContaining({ name: rule.name, matched: true, reason: 'insulte' }),
    ]);
  });
});
