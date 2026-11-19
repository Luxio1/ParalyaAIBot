import { type BotConfig, type Command, type ProfilesState } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

describe('routes /api/profiles', () => {
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
  const state = async () => (await send('GET', '/api/profiles')).json() as ProfilesState;
  const config = async () => (await send('GET', '/api/config')).json() as BotConfig;
  const idOf = async (name: string) =>
    (await state()).profiles.find((profile) => profile.name === name)?.id;
  const command = async (name: string) =>
    ((await send('GET', '/api/commands')).json() as Command[]).find((c) => c.name === name);

  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/profiles' });
    expect(response.statusCode).toBe(401);
  });

  it('démarre avec un profil « Normal » actif', async () => {
    const { activeId, profiles } = await state();
    expect(profiles).toEqual([{ id: activeId, name: 'Normal' }]);
  });

  it('copie le profil actif, puis garde des réglages propres à chaque profil', async () => {
    await send('PUT', '/api/config', { ...(await config()), systemPrompt: 'Assistant sérieux.' });
    await send('POST', '/api/profiles', { name: 'Animation' });
    const animation = await idOf('Animation');
    await send('POST', `/api/profiles/${animation}/activate`);
    expect((await config()).systemPrompt).toBe('Assistant sérieux.');

    await send('PUT', '/api/config', {
      ...(await config()),
      systemPrompt: 'Maître du jeu.',
      rateLimitEnabled: true,
    });
    await send('POST', `/api/profiles/${await idOf('Normal')}/activate`);
    const normal = await config();
    expect(normal.systemPrompt).toBe('Assistant sérieux.');
    // Réglage commun à tous les profils.
    expect(normal.rateLimitEnabled).toBe(true);
  });

  it('active les commandes par profil', async () => {
    await send('POST', '/api/profiles', { name: 'Animation' });
    await send('POST', `/api/profiles/${await idOf('Animation')}/activate`);
    const regles = await command('regles');
    await send('PUT', `/api/commands/${regles?.id}`, { ...regles, enabled: false });
    expect((await command('regles'))?.enabled).toBe(false);

    await send('POST', `/api/profiles/${await idOf('Normal')}/activate`);
    expect((await command('regles'))?.enabled).toBe(true);
  });

  it('efface la mémoire en changeant de profil', async () => {
    ctx.memory.append(
      { id: 'dm:1', kind: 'dm', userName: 'Alice', channelName: null },
      [{ role: 'user', text: 'bonjour' }],
      10,
    );
    await send('POST', '/api/profiles', { name: 'Animation' });
    await send('POST', `/api/profiles/${await idOf('Animation')}/activate`);
    expect(ctx.memory.list(60_000)).toEqual([]);
  });

  it('renomme, refuse un doublon et protège le profil actif', async () => {
    await send('POST', '/api/profiles', { name: 'Animation' });
    const animation = await idOf('Animation');
    expect((await send('POST', '/api/profiles', { name: 'animation' })).statusCode).toBe(409);
    await send('PUT', `/api/profiles/${animation}`, { name: 'Soirée jeux' });
    expect(await idOf('Soirée jeux')).toBe(animation);

    const active = (await state()).activeId;
    const refused = await send('DELETE', `/api/profiles/${active}`);
    expect(refused.json().message).toBe('Activez un autre profil avant de supprimer celui-ci.');
    expect((await send('DELETE', `/api/profiles/${animation}`)).statusCode).toBe(204);
  });
});
