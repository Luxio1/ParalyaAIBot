import { DiscordjsErrorCodes, Events, GatewayCloseCodes } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../../http/testApp';

const TOKEN = 'token-discord-de-test';

describe('BotManager', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('signale un token absent', async () => {
    await ctx.bot.start();
    expect(ctx.bot.status()).toMatchObject({
      state: 'error',
      error: expect.stringMatching(/Aucun token/),
    });
    expect(ctx.discord.created).toHaveLength(0);
  });

  it('se connecte, expose son statut et se déconnecte', async () => {
    ctx.secrets.set('discordToken', TOKEN);
    await ctx.bot.start();

    const status = ctx.bot.status();
    expect(status).toMatchObject({
      state: 'online',
      user: { tag: 'Paralya#0001' },
      ping: 42,
      error: null,
    });
    const invite = new URL(status.inviteUrl ?? '');
    expect(invite.searchParams.get('client_id')).toBe('application-id');
    // Voir les salons, écrire, écrire dans les fils, lire l'historique.
    expect(invite.searchParams.get('permissions')).toBe('274877975552');

    await ctx.bot.stop();
    expect(ctx.bot.status()).toMatchObject({ state: 'offline', user: null });
    expect(ctx.discord.created[0]?.destroyed).toBe(true);
  });

  it.each([
    [
      'un token refusé',
      Object.assign(new Error('An invalid token was provided.'), {
        code: DiscordjsErrorCodes.TokenInvalid,
      }),
      /Token Discord refusé/,
    ],
    ['un intent non activé', new Error('Used disallowed intents'), /Message Content Intent/],
  ])('traduit %s', async (_case, loginError, message) => {
    ctx.discord.options.loginError = loginError;
    ctx.secrets.set('discordToken', TOKEN);
    await ctx.bot.start();
    expect(ctx.bot.status()).toMatchObject({
      state: 'error',
      error: expect.stringMatching(message),
    });
  });

  it('se reconnecte avec le nouveau token quand il change', async () => {
    ctx.secrets.set('discordToken', TOKEN);
    await ctx.bot.start();
    ctx.secrets.set('discordToken', 'nouveau-token');
    await ctx.bot.start();

    const [first, second] = ctx.discord.created;
    expect(first?.destroyed).toBe(true);
    expect(second?.token).toBe('nouveau-token');
    expect(ctx.bot.status().state).toBe('online');
  });

  it("démarre dès l'enregistrement du token s'il en manquait un", async () => {
    await ctx.bot.start();
    ctx.secrets.set('discordToken', TOKEN);
    await ctx.bot.start();
    expect(ctx.discord.created).toHaveLength(1);
    expect(ctx.bot.status().state).toBe('online');
  });

  it('passe en erreur si Discord ferme définitivement la connexion', async () => {
    ctx.secrets.set('discordToken', TOKEN);
    await ctx.bot.start();
    ctx.discord.created[0]?.emit(Events.ShardDisconnect, {
      code: GatewayCloseCodes.AuthenticationFailed,
    });
    // Passe après la déconnexion dans la file des opérations, sans reconnecter le bot.
    await ctx.bot.shutdown();
    expect(ctx.bot.status()).toMatchObject({
      state: 'error',
      error: expect.stringMatching(/refusé/),
    });
  });

  it("reprend au redémarrage du serveur l'état choisi dans le dashboard", async () => {
    ctx.secrets.set('discordToken', TOKEN);
    await ctx.bot.start();
    ctx = await ctx.restart();
    await ctx.bot.resume();
    expect(ctx.bot.status().state).toBe('online');

    await ctx.bot.stop();
    ctx = await ctx.restart();
    await ctx.bot.resume();
    expect(ctx.bot.status().state).toBe('offline');
  });
});
