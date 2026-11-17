import { EXAMPLE_EVENT_RULES, type EventRule } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

describe('routes /api/events', () => {
  let ctx: TestApp;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestApp();
    cookie = await setupAdmin(ctx);
  });

  afterEach(async () => {
    await ctx.close();
  });

  const send = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    ctx.app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const list = async () => (await send('GET', '/api/events/rules')).json() as EventRule[];

  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/events/test' });
    expect(response.statusCode).toBe(401);
  });

  it("installe les exemples désactivés et refuse de les activer sans salon d'alerte", async () => {
    const rules = await list();
    expect(rules.map((rule) => [rule.name, rule.enabled])).toEqual(
      EXAMPLE_EVENT_RULES.map((rule) => [rule.name, false]),
    );

    const [toxic] = rules;
    const response = await send('PUT', `/api/events/rules/${toxic?.id}`, {
      ...toxic,
      enabled: true,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Choisissez le salon de l'alerte.");
  });

  it('crée, duplique et supprime une règle ; refuse une règle sans action', async () => {
    const base = EXAMPLE_EVENT_RULES[1];
    const noAction = await send('POST', '/api/events/rules', {
      ...base,
      dm: { ...base?.dm, enabled: false },
    });
    expect(noAction.json().message).toBe(
      'Choisissez au moins une action : MP ou message dans un salon.',
    );

    expect(
      (await send('POST', '/api/events/rules', { ...base, name: 'Ma règle' })).statusCode,
    ).toBe(204);
    const mine = (await list()).find((rule) => rule.name === 'Ma règle');
    await send('POST', `/api/events/rules/${mine?.id}/duplicate`);
    expect((await list()).find((rule) => rule.name === 'Ma règle (copie)')).toMatchObject({
      enabled: false,
    });

    expect((await send('DELETE', `/api/events/rules/${mine?.id}`)).statusCode).toBe(204);
    expect((await send('DELETE', `/api/events/rules/${mine?.id}`)).statusCode).toBe(404);
  });

  it('restaure les exemples sans doublon', async () => {
    for (const rule of await list()) await send('DELETE', `/api/events/rules/${rule.id}`);
    await send('POST', '/api/events/rules/restore-examples');
    await send('POST', '/api/events/rules/restore-examples');
    expect(await list()).toHaveLength(EXAMPLE_EVENT_RULES.length);
  });

  it('teste un message contre toutes les règles', async () => {
    const [first] = await list();
    ctx.aiProvider.answer = JSON.stringify({
      matches: [{ id: first?.id, matched: true, reason: 'propos insultant' }],
    });
    const response = await send('POST', '/api/events/test', { message: 'Tu es nul' });

    expect(response.statusCode).toBe(200);
    const results = response.json();
    expect(results).toHaveLength(EXAMPLE_EVENT_RULES.length);
    expect(results[0]).toMatchObject({ matched: true, reason: 'propos insultant' });
    expect(results[1]).toMatchObject({ matched: false });
  });
});
