import { healthResponseSchema } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './testApp';

describe('application HTTP', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('GET /healthz répond ok avec un corps conforme au schéma partagé', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json()).database).toBe('ok');
  });

  it('GET /healthz répond 503 si la base est fermée', async () => {
    ctx.database.close();
    const response = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(503);
  });

  it('envoie les en-têtes de sécurité sans forcer le HTTPS', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('renvoie un 404 JSON pour une route inconnue', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/inconnue' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('not_found');
  });

  it('refuse un corps de requête trop volumineux', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ data: 'a'.repeat(2 * 1024 * 1024) }),
    });
    expect(response.statusCode).toBe(413);
  });

  it('refuse une requête qui modifie des données depuis une autre origine', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: 'https://site-malveillant.example', host: 'localhost:3000' },
      payload: { username: 'admin', password: 'x' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('forbidden_origin');
  });

  it.each([
    ['GET', '/api/secrets'],
    ['PUT', '/api/secrets/discordToken'],
    ['DELETE', '/api/logs'],
    ['POST', '/api/auth/password'],
  ] as const)('%s %s exige une session', async (method, url) => {
    const response = await ctx.app.inject({ method, url, payload: {} });
    expect(response.statusCode).toBe(401);
  });
});
