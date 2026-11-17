import { commandInputSchema, type Command } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CommandService } from '../../services/commandService';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerCommandRoutes(app: FastifyInstance, commands: CommandService): void {
  app.get('/api/commands', async (): Promise<Command[]> => commands.list());

  app.post('/api/commands', async (request, reply) => {
    commands.create(commandInputSchema.parse(request.body));
    return reply.code(204).send();
  });

  // Déclarée avant `/:id` pour la lisibilité ; Fastify préfère de toute façon la route statique.
  app.post('/api/commands/restore-examples', async (_request, reply) => {
    commands.restoreExamples();
    return reply.code(204).send();
  });

  app.put('/api/commands/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    commands.update(id, commandInputSchema.parse(request.body));
    return reply.code(204).send();
  });

  app.delete('/api/commands/:id', async (request, reply) => {
    commands.remove(paramsSchema.parse(request.params).id);
    return reply.code(204).send();
  });

  app.post('/api/commands/:id/duplicate', async (request, reply) => {
    commands.duplicate(paramsSchema.parse(request.params).id);
    return reply.code(204).send();
  });
}
