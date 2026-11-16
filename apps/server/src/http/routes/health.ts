import type { HealthResponse } from '@bot/shared';
import { APP_VERSION } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import type { DatabaseHandle } from '../../db/client';

/** Sonde de disponibilité publique : ne renvoie aucune information sensible. */
export function registerHealthRoute(app: FastifyInstance, database: DatabaseHandle): void {
  // logLevel « warn » : la sonde est appelée en boucle, inutile de tracer chaque appel.
  app.get('/healthz', { logLevel: 'warn' }, async (_request, reply) => {
    const databaseOk = database.ping();
    const body: HealthResponse = {
      status: 'ok',
      version: APP_VERSION,
      uptime: Math.round(process.uptime()),
      database: databaseOk ? 'ok' : 'error',
    };
    return reply.code(databaseOk ? 200 : 503).send(body);
  });
}
