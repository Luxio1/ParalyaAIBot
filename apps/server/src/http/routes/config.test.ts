import { DEFAULT_BOT_CONFIG } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../../core/ai/aiProvider';
import { createTestApp, sessionCookie, setupAdmin, TEST_PASSWORD, type TestApp } from '../testApp';

describe('routes /api/config et /api/ai/models', () => {
  let ctx: TestApp;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestApp();
    cookie = await setupAdmin(ctx);
  });

  afterEach(async () => {
    await ctx.close();
  });

  const get = (url: string) => ctx.app.inject({ method: 'GET', url, headers: { cookie } });
  const putConfig = (payload: object) =>
    ctx.app.inject({ method: 'PUT', url: '/api/config', headers: { cookie }, payload });

  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/config' });
    expect(response.statusCode).toBe(401);
  });

  it('renvoie les valeurs par défaut puis conserve les réglages après un redémarrage', async () => {
    expect((await get('/api/config')).json()).toEqual(DEFAULT_BOT_CONFIG);

    const changed = { ...DEFAULT_BOT_CONFIG, prefix: '?', allowDMs: false };
    expect((await putConfig(changed)).statusCode).toBe(204);

    ctx = await ctx.restart();
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: TEST_PASSWORD },
    });
    cookie = sessionCookie(login);
    expect((await get('/api/config')).json()).toEqual(changed);
  });

  it('refuse un réglage invalide avec un message en français', async () => {
    const response = await putConfig({ ...DEFAULT_BOT_CONFIG, prefix: '! !' });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe("Le préfixe ne peut pas contenir d'espace.");
  });

  it('liste les modèles disponibles', async () => {
    expect((await get('/api/ai/models')).json()).toEqual([
      { id: 'gemini-test', label: 'Gemini Test' },
    ]);
  });

  it('explique pourquoi la liste des modèles est indisponible', async () => {
    ctx.aiProvider.error = new AiError('missingKey', 'Aucune clé Gemini.');
    const response = await get('/api/ai/models');
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Aucune clé Gemini.');
  });
});
