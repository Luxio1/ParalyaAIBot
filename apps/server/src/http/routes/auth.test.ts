import { authStateSchema } from '@bot/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessions } from '../../db/schema';
import { SESSION_COOKIE } from '../session';
import { TEST_PASSWORD, createTestApp, sessionCookie, setupAdmin, type TestApp } from '../testApp';

describe('authentification', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  const login = (password: string) =>
    ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password },
    });

  const authState = async (cookie?: string) => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/state',
      headers: cookie ? { cookie } : {},
    });
    return authStateSchema.parse(response.json());
  };

  it("exige le code d'installation pour créer le premier compte", async () => {
    expect((await authState()).needsSetup).toBe(true);
    ctx.auth.createSetupCode();

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { setupCode: 'mauvais-code', username: 'admin', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(403);
    expect((await authState()).needsSetup).toBe(true);
  });

  it('crée le compte, ouvre une session par cookie sécurisé, puis refuse une 2e installation', async () => {
    const setupCode = ctx.auth.createSetupCode();
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { setupCode, username: 'admin', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(204);
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(await authState(sessionCookie(response))).toEqual({
      needsSetup: false,
      user: { username: 'admin' },
    });

    expect(ctx.auth.createSetupCode()).toBeNull();
    const again = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { setupCode, username: 'pirate', password: TEST_PASSWORD },
    });
    expect(again.statusCode).toBe(409);
  });

  it('refuse un mot de passe trop court', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/setup',
      payload: { setupCode: ctx.auth.createSetupCode(), username: 'admin', password: 'court' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toMatch(/12 caractères/);
  });

  it('connecte avec le bon mot de passe et bloque le bruteforce', async () => {
    await setupAdmin(ctx);

    expect((await login('mauvais')).statusCode).toBe(401);
    expect((await login(TEST_PASSWORD)).statusCode).toBe(204);
    for (let i = 0; i < 3; i++) await login('mauvais');

    const blocked = await login(TEST_PASSWORD);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error).toBe('too_many_requests');
  });

  it('refuse une session expirée', async () => {
    const cookie = await setupAdmin(ctx);
    ctx.database.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .run();

    expect((await authState(cookie)).user).toBeNull();
  });

  it('se déconnecte', async () => {
    const cookie = await setupAdmin(ctx);
    await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });

    expect((await authState(cookie)).user).toBeNull();
  });

  it('change le mot de passe et ferme les autres sessions', async () => {
    const current = await setupAdmin(ctx);
    const other = sessionCookie(await login(TEST_PASSWORD));

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: current },
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'nouveau-mot-de-passe' },
    });

    expect(response.statusCode).toBe(204);
    expect((await authState(current)).user).not.toBeNull();
    expect((await authState(other)).user).toBeNull();
    expect((await login(TEST_PASSWORD)).statusCode).toBe(401);
  });

  it("ne stocke en base que l'empreinte du jeton de session", async () => {
    const cookie = await setupAdmin(ctx);
    const token = cookie.split('=')[1] ?? '';

    expect(ctx.database.db.select().from(sessions).where(eq(sessions.id, token)).get()).toBe(
      undefined,
    );
    expect(ctx.database.db.select().from(sessions).all()).toHaveLength(1);
  });
});
