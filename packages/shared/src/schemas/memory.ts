import { z } from 'zod';

/** Conversation en mémoire, sans son contenu : le moniteur n'affiche que des métadonnées. */
export const memorySessionSchema = z.object({
  id: z.string(),
  kind: z.enum(['dm', 'guild', 'playground']),
  userName: z.string(),
  /** `null` en MP. */
  channelName: z.string().nullable(),
  messageCount: z.number().int(),
  expiresAt: z.iso.datetime(),
});
export type MemorySession = z.infer<typeof memorySessionSchema>;
