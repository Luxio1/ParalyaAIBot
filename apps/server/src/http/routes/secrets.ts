import { putSecretRequestSchema, secretNameSchema, type SecretStatus } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SecretsService } from '../../services/secretsService';

const paramsSchema = z.object({ name: secretNameSchema });

export function registerSecretsRoutes(app: FastifyInstance, secrets: SecretsService): void {
  app.get('/api/secrets', async (): Promise<SecretStatus[]> => secrets.list());

  app.put('/api/secrets/:name', async (request, reply) => {
    const { name } = paramsSchema.parse(request.params);
    secrets.set(name, putSecretRequestSchema.parse(request.body).value);
    return reply.code(204).send();
  });

  app.delete('/api/secrets/:name', async (request, reply) => {
    secrets.remove(paramsSchema.parse(request.params).name);
    return reply.code(204).send();
  });
}
