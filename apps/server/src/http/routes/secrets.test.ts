import { secretStatusSchema } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { secrets } from '../../db/schema';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

const TOKEN = 'MTIzNDU2Nzg5.discord-token-de-test.ABCD1234';

describe('secrets', () => {
  let ctx: TestApp;
  let cookie: string;

  beforeEach(async () => {
    ctx = await createTestApp();
    cookie = await setupAdmin(ctx);
  });

  afterEach(async () => {
    await ctx.close();
  });

  const putToken = () =>
    ctx.app.inject({
      method: 'PUT',
      url: '/api/secrets/discordToken',
      headers: { cookie },
      payload: { value: TOKEN },
    });

  const listSecrets = (app = ctx.app) =>
    app.inject({ method: 'GET', url: '/api/secrets', headers: { cookie } });

  it('enregistre un secret chiffré et ne renvoie que son masque', async () => {
    expect((await putToken()).statusCode).toBe(204);

    const response = await listSecrets();
    expect(response.body).not.toContain(TOKEN);
    const discordToken = secretStatusSchema
      .array()
      .parse(response.json())
      .find((s) => s.name === 'discordToken');
    expect(discordToken).toEqual({
      name: 'discordToken',
      isSet: true,
      last4: '1234',
      source: 'dashboard',
    });

    const stored = ctx.database.db.select().from(secrets).all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.ciphertext).not.toContain(TOKEN);
  });

  it('retrouve le secret après un redémarrage', async () => {
    await putToken();
    ctx = await ctx.restart();

    const response = await listSecrets();
    expect(response.json()).toContainEqual(
      expect.objectContaining({ name: 'discordToken', isSet: true, last4: '1234' }),
    );
  });

  it('supprime un secret', async () => {
    await putToken();
    await ctx.app.inject({
      method: 'DELETE',
      url: '/api/secrets/discordToken',
      headers: { cookie },
    });

    expect((await listSecrets()).json()).toContainEqual(
      expect.objectContaining({ name: 'discordToken', isSet: false, last4: null }),
    );
  });

  it('refuse un nom de secret inconnu', async () => {
    const response = await ctx.app.inject({
      method: 'PUT',
      url: '/api/secrets/inconnu',
      headers: { cookie },
      payload: { value: 'x' },
    });
    expect(response.statusCode).toBe(400);
  });
});
