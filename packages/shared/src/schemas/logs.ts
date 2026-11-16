import { z } from 'zod';

/** Catégories de la console de logs en direct (cahier des charges §1). */
export const LOG_TYPES = [
  'system',
  'discord',
  'ai',
  'success',
  'error',
  'cooldown',
  'command',
  'dm',
  'event',
] as const;

export const logTypeSchema = z.enum(LOG_TYPES);
export type LogType = z.infer<typeof logTypeSchema>;

/** Libellés français affichés dans l'interface. */
export const LOG_TYPE_LABELS: Record<LogType, string> = {
  system: 'Système',
  discord: 'Discord',
  ai: 'IA',
  success: 'Succès',
  error: 'Erreur',
  cooldown: 'Cooldown',
  command: 'Commande',
  dm: 'Retranscription MP',
  event: 'Événement',
};

export const logEntrySchema = z.object({
  id: z.string().min(1),
  /** Horodatage ISO 8601. */
  timestamp: z.iso.datetime(),
  type: logTypeSchema,
  message: z.string(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;
