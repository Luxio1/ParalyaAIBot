import { EXAMPLE_COMMANDS, type Command, type CommandInput } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

const METEO: CommandInput = {
  name: 'Météo',
  description: 'Prévisions',
  enabled: true,
  type: 'ai',
  response: '',
  promptTemplate: 'Donne la météo de {query}',
  systemPrompt: '',
};

describe('routes /api/commands', () => {
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
  const list = async () => (await send('GET', '/api/commands')).json() as Command[];
  const byName = async (name: string) => (await list()).find((command) => command.name === name);

  it('exige une session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/commands' });
    expect(response.statusCode).toBe(401);
  });

  it("installe les exemples une seule fois, même s'ils ont été supprimés", async () => {
    expect((await list()).map((command) => command.name)).toEqual([
      'code',
      'help',
      'regles',
      'resume',
      'traduis',
    ]);
    for (const command of await list()) await send('DELETE', `/api/commands/${command.id}`);

    ctx = await ctx.restart();
    expect(ctx.commands.list()).toEqual([]);
  });

  it('crée, modifie et supprime une commande', async () => {
    expect((await send('POST', '/api/commands', METEO)).statusCode).toBe(204);
    const created = await byName('météo');
    expect(created).toMatchObject({ name: 'météo', type: 'ai' });

    const id = created?.id ?? 0;
    await send('PUT', `/api/commands/${id}`, { ...METEO, enabled: false });
    expect((await byName('météo'))?.enabled).toBe(false);

    expect((await send('DELETE', `/api/commands/${id}`)).statusCode).toBe(204);
    expect((await send('DELETE', `/api/commands/${id}`)).statusCode).toBe(404);
  });

  it('refuse un nom déjà pris ou invalide, et une commande sans contenu', async () => {
    const duplicate = await send('POST', '/api/commands', { ...METEO, name: 'HELP' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().message).toBe('Une commande « help » existe déjà.');

    const spaced = await send('POST', '/api/commands', { ...METEO, name: 'deux mots' });
    expect(spaced.json().message).toMatch(/^Nom : 1 à 32 caractères/);

    const empty = await send('POST', '/api/commands', { ...METEO, promptTemplate: '' });
    expect(empty.json().message).toBe('Modèle de question requis.');
  });

  it('duplique une commande en copie désactivée', async () => {
    const help = await byName('help');
    await send('POST', `/api/commands/${help?.id}/duplicate`);
    await send('POST', `/api/commands/${help?.id}/duplicate`);
    expect(await byName('help-copie')).toMatchObject({ enabled: false, response: help?.response });
    expect(await byName('help-copie-2')).toBeDefined();
  });

  it('restaure les exemples sans toucher aux autres commandes', async () => {
    const regles = await byName('regles');
    await send('PUT', `/api/commands/${regles?.id}`, { ...regles, response: 'Modifié' });
    await send('DELETE', `/api/commands/${(await byName('code'))?.id}`);
    await send('POST', '/api/commands', METEO);

    expect((await send('POST', '/api/commands/restore-examples')).statusCode).toBe(204);
    expect((await byName('regles'))?.response).toBe(EXAMPLE_COMMANDS[1]?.response);
    expect(await byName('code')).toBeDefined();
    expect(await byName('météo')).toBeDefined();
  });
});
