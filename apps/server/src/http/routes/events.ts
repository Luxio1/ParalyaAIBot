import {
  eventRuleInputSchema,
  eventTestRequestSchema,
  type EventRule,
  type EventTestResult,
} from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AiError } from '../../core/ai/aiProvider';
import type { EventEngine } from '../../core/events/eventEngine';
import { AppError } from '../../lib/appError';
import type { EventRuleService } from '../../services/eventRuleService';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerEventRoutes(
  app: FastifyInstance,
  rules: EventRuleService,
  engine: EventEngine,
): void {
  app.get('/api/events/rules', async (): Promise<EventRule[]> => rules.list());

  app.post('/api/events/rules', async (request, reply) => {
    rules.create(eventRuleInputSchema.parse(request.body));
    return reply.code(204).send();
  });

  app.post('/api/events/rules/restore-examples', async (_request, reply) => {
    rules.restoreExamples();
    return reply.code(204).send();
  });

  app.put('/api/events/rules/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    rules.update(id, eventRuleInputSchema.parse(request.body));
    return reply.code(204).send();
  });

  app.delete('/api/events/rules/:id', async (request, reply) => {
    rules.remove(paramsSchema.parse(request.params).id);
    return reply.code(204).send();
  });

  app.post('/api/events/rules/:id/duplicate', async (request, reply) => {
    rules.duplicate(paramsSchema.parse(request.params).id);
    return reply.code(204).send();
  });

  app.post('/api/events/test', async (request): Promise<EventTestResult[]> => {
    try {
      return await engine.test(eventTestRequestSchema.parse(request.body), rules.list());
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      throw new AppError(error.reason === 'missingKey' ? 400 : 502, 'ai_error', error.message);
    }
  });
}
