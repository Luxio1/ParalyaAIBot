import { serverEventSchema, type ServerEvent } from '@bot/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, setupAdmin, type TestApp } from './testApp';

describe('WebSocket /ws', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('refuse une connexion sans session', async () => {
    const address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    const socket = new WebSocket(`${address.replace('http', 'ws')}/ws`);
    const opened = await new Promise<boolean>((resolve) => {
      socket.addEventListener('open', () => resolve(true));
      socket.addEventListener('error', () => resolve(false));
    });
    expect(opened).toBe(false);
  });

  it("envoie l'historique, le statut du bot puis les nouveaux logs", async () => {
    const cookie = await setupAdmin(ctx);
    const events: ServerEvent[] = [];
    const received = new Promise<void>((resolve) => {
      const onMessage = (data: Buffer) => {
        events.push(serverEventSchema.parse(JSON.parse(data.toString())));
        if (events.length === 3) resolve();
      };
      void ctx.app
        .injectWS('/ws', { headers: { cookie } }, { onInit: (ws) => ws.on('message', onMessage) })
        .then(() => ctx.logBus.push('discord', 'Bot connecté'));
    });

    await received;
    expect(events[0]).toMatchObject({ type: 'logs:snapshot' });
    expect(events[1]).toMatchObject({ type: 'bot:status', status: { state: 'offline' } });
    expect(events[2]).toMatchObject({
      type: 'log',
      entry: { type: 'discord', message: 'Bot connecté' },
    });
  });
});
