import { z } from 'zod';

/** Corps de toute réponse d'erreur de l'API. */
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
