import type { DiscoveredGuild } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import type { BotManager } from '../../adapters/discord/botManager';

/** Le statut du bot est poussé sur le WebSocket (`bot:status`), il n'a pas de route GET. */
export function registerBotRoutes(app: FastifyInstance, bot: BotManager): void {
  app.post('/api/bot/start', async (_request, reply) => {
    await bot.start();
    return reply.code(204).send();
  });

  app.post('/api/bot/stop', async (_request, reply) => {
    await bot.stop();
    return reply.code(204).send();
  });

  app.get('/api/bot/discovery', async (): Promise<DiscoveredGuild[]> => bot.discovery());
}
