import { DEFAULT_BOT_CONFIG } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

describe('routes /api/memory/sessions', () => {
  let ctx: TestApp;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestApp();
    cookie = await setupAdmin(ctx);
    for (const [id, userName] of [
      ['dm:1', 'Alice'],
      ['dm:2', 'Bob'],
    ] as const) {
      ctx.memory.append(
        { id, kind: 'dm', userName, channelName: null },
        [
          { role: 'user', text: 'secret' },
          { role: 'model', text: 'réponse' },
        ],
        10,
      );
    }
  });

  afterEach(async () => {
    await ctx.close();
  });

  const call = (method: 'GET' | 'DELETE', url: string) =>
    ctx.app.inject({ method, url, headers: { cookie } });

  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/memory/sessions' });
    expect(response.statusCode).toBe(401);
  });

  it('liste les conversations sans leur contenu', async () => {
    const response = await call('GET', '/api/memory/sessions');
    expect(response.json()).toHaveLength(2);
    expect(response.json()[0]).toMatchObject({ kind: 'dm', messageCount: 2, channelName: null });
    expect(response.body).not.toContain('secret');
  });

  it('efface une conversation, puis toutes', async () => {
    expect((await call('DELETE', '/api/memory/sessions/dm%3A1')).statusCode).toBe(204);
    expect((await call('DELETE', '/api/memory/sessions/dm%3A1')).statusCode).toBe(404);
    expect((await call('GET', '/api/memory/sessions')).json()).toHaveLength(1);

    expect((await call('DELETE', '/api/memory/sessions')).statusCode).toBe(204);
    expect((await call('GET', '/api/memory/sessions')).json()).toEqual([]);
  });

  it('vide la mémoire quand elle est désactivée dans les réglages', async () => {
    await ctx.app.inject({
      method: 'PUT',
      url: '/api/config',
      headers: { cookie },
      payload: { ...DEFAULT_BOT_CONFIG, memoryEnabled: false },
    });
    expect((await call('GET', '/api/memory/sessions')).json()).toEqual([]);
  });
});
