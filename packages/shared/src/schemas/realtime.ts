import { z } from 'zod';
import { botStatusSchema } from './bot';
import { logEntrySchema } from './logs';

/** Messages poussés par le serveur sur le WebSocket `/ws`. */
export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('logs:snapshot'), entries: z.array(logEntrySchema) }),
  z.object({ type: z.literal('log'), entry: logEntrySchema }),
  z.object({ type: z.literal('logs:cleared') }),
  z.object({ type: z.literal('bot:status'), status: botStatusSchema }),
  /** Serveurs, salons ou rôles modifiés : le client relit `GET /api/bot/discovery`. */
  z.object({ type: z.literal('bot:discovery-changed') }),
  /** Conversations en mémoire modifiées : le client relit `GET /api/memory/sessions`. */
  z.object({ type: z.literal('memory:changed') }),
  /** Réglages ou profil actif modifiés : le client relit réglages, profils, commandes et règles. */
  z.object({ type: z.literal('config:changed') }),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
