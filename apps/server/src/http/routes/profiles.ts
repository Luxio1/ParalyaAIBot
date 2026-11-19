import { profileInputSchema, type ProfilesState } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProfileService } from '../../services/profileService';

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerProfileRoutes(app: FastifyInstance, profiles: ProfileService): void {
  app.get('/api/profiles', async (): Promise<ProfilesState> => profiles.state());

  /** Nouveau profil, copie du profil actif. */
  app.post('/api/profiles', async (request, reply) => {
    profiles.create(profileInputSchema.parse(request.body).name);
    return reply.code(204).send();
  });

  app.put('/api/profiles/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    profiles.rename(id, profileInputSchema.parse(request.body).name);
    return reply.code(204).send();
  });

  app.delete('/api/profiles/:id', async (request, reply) => {
    profiles.remove(paramsSchema.parse(request.params).id);
    return reply.code(204).send();
  });

  app.post('/api/profiles/:id/activate', async (request, reply) => {
    profiles.activate(paramsSchema.parse(request.params).id);
    return reply.code(204).send();
  });
}
