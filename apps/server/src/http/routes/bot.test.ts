import { ChannelType } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeDiscord } from '../../adapters/discord/fakeDiscordClient';
import { openDatabase } from '../../db/client';
import { createTestApp, setupAdmin, type TestApp } from '../testApp';

describe('routes /api/bot', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await createTestApp(
      openDatabase(':memory:'),
      fakeDiscord({
        guilds: [
          {
            id: 'g1',
            name: 'Paralya',
            channels: [
              {
                id: 'c2',
                name: 'annonces',
                type: ChannelType.GuildAnnouncement,
                category: 'Infos',
              },
              { id: 'v1', name: 'Vocal', type: ChannelType.GuildVoice },
              { id: 'c1', name: 'général', type: ChannelType.GuildText },
            ],
            roles: [
              { id: 'r1', name: 'Membre', position: 1, color: 0 },
              { id: 'r2', name: 'Staff', position: 2, color: 0xff0000 },
            ],
          },
        ],
      }),
    );
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('exige une session', async () => {
    const start = await ctx.app.inject({ method: 'POST', url: '/api/bot/start' });
    const discovery = await ctx.app.inject({ method: 'GET', url: '/api/bot/discovery' });
    expect([start.statusCode, discovery.statusCode]).toEqual([401, 401]);
    expect(ctx.discord.created).toHaveLength(0);
  });

  it('démarre le bot et liste ses serveurs, salons et rôles', async () => {
    const cookie = await setupAdmin(ctx);
    ctx.secrets.set('discordToken', 'token-discord-de-test');

    const start = await ctx.app.inject({
      method: 'POST',
      url: '/api/bot/start',
      headers: { cookie },
    });
    expect(start.statusCode).toBe(204);

    const discovery = await ctx.app.inject({
      method: 'GET',
      url: '/api/bot/discovery',
      headers: { cookie },
    });
    expect(discovery.json()).toEqual([
      {
        id: 'g1',
        name: 'Paralya',
        iconUrl: null,
        channels: [
          { id: 'c1', name: 'général', kind: 'text', category: null },
          { id: 'c2', name: 'annonces', kind: 'announcement', category: 'Infos' },
        ],
        roles: [
          { id: 'r2', name: 'Staff', color: '#ff0000' },
          { id: 'r1', name: 'Membre', color: null },
        ],
      },
    ]);

    const stop = await ctx.app.inject({
      method: 'POST',
      url: '/api/bot/stop',
      headers: { cookie },
    });
    expect(stop.statusCode).toBe(204);
    expect(ctx.bot.status().state).toBe('offline');
  });
});
