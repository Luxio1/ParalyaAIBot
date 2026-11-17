import { z } from 'zod';
import { logEntrySchema } from './logs';

/** Messages poussés par le serveur sur le WebSocket `/ws`. */
export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('logs:snapshot'), entries: z.array(logEntrySchema) }),
  z.object({ type: z.literal('log'), entry: logEntrySchema }),
  z.object({ type: z.literal('logs:cleared') }),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
