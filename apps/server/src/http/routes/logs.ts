import type { FastifyInstance } from 'fastify';
import type { LogBus } from '../../core/logs/logBus';

/** La lecture passe par le WebSocket (`logs:snapshot` puis `log`). */
export function registerLogsRoutes(app: FastifyInstance, logBus: LogBus): void {
  app.delete('/api/logs', async (_request, reply) => {
    logBus.clear();
    return reply.code(204).send();
  });
}
