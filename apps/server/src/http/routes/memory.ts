import type { MemorySession } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { LogBus } from '../../core/logs/logBus';
import type { SessionStore } from '../../core/memory/sessionStore';
import { AppError } from '../../lib/appError';
import type { ConfigService } from '../../services/configService';

const paramsSchema = z.object({ id: z.string().max(100) });

export function registerMemoryRoutes(
  app: FastifyInstance,
  memory: SessionStore,
  config: ConfigService,
  logBus: LogBus,
): void {
  app.get('/api/memory/sessions', async (): Promise<MemorySession[]> =>
    memory.list(config.get().memoryRetentionMinutes * 60_000),
  );

  app.delete('/api/memory/sessions/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    if (!memory.remove(id)) {
      throw new AppError(
        404,
        'not_found',
        'Conversation introuvable : elle a peut-être déjà expiré.',
      );
    }
    return reply.code(204).send();
  });

  app.delete('/api/memory/sessions', async (_request, reply) => {
    memory.clear();
    logBus.push('system', 'Mémoire des conversations effacée.');
    return reply.code(204).send();
  });
}
