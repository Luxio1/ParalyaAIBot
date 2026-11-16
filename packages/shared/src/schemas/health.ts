import { z } from 'zod';

/** Réponse de `GET /healthz` (sonde de disponibilité, sans authentification). */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  /** Durée de fonctionnement du serveur, en secondes. */
  uptime: z.number().nonnegative(),
  database: z.enum(['ok', 'error']),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
