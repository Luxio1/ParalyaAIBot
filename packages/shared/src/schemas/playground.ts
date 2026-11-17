import { z } from 'zod';
import { eventTestResultSchema } from './events';

export const PLAYGROUND_MAX_IMAGES = 3;
export const PLAYGROUND_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PLAYGROUND_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Taille en base64 d'une image de `PLAYGROUND_IMAGE_MAX_BYTES` octets. */
const IMAGE_MAX_BASE64_LENGTH = Math.ceil(PLAYGROUND_IMAGE_MAX_BYTES / 3) * 4;

export const playgroundRequestSchema = z
  .object({
    text: z.string().max(4000, 'Message : 4000 caractères maximum.'),
    authorName: z
      .string()
      .trim()
      .min(1, 'Pseudo requis.')
      .max(32, 'Pseudo : 32 caractères maximum.'),
    images: z
      .array(
        z.object({
          mimeType: z.enum(PLAYGROUND_IMAGE_TYPES, 'Image : PNG, JPEG ou WebP uniquement.'),
          data: z.base64().max(IMAGE_MAX_BASE64_LENGTH, 'Image : 4 Mo maximum.'),
        }),
      )
      .max(PLAYGROUND_MAX_IMAGES, `${PLAYGROUND_MAX_IMAGES} images maximum.`),
    /** Analyser aussi le message avec les règles d'événements actives, sans exécuter d'action. */
    evaluateEvents: z.boolean(),
  })
  .refine((request) => request.text.trim() !== '' || request.images.length > 0, {
    message: 'Message vide.',
    path: ['text'],
  });
export type PlaygroundRequest = z.infer<typeof playgroundRequestSchema>;

export const playgroundResponseSchema = z.object({
  /** Messages du bot, dans l'ordre d'envoi ; vide si le message ne l'a pas déclenché. */
  replies: z.array(z.string()),
  /** Règles qui se seraient déclenchées. */
  events: z.array(eventTestResultSchema),
  /** Raison de l'échec de l'analyse des événements, le cas échéant. */
  eventsError: z.string().nullable(),
});
export type PlaygroundResponse = z.infer<typeof playgroundResponseSchema>;

export const playgroundResetSchema = z.object({ authorName: z.string().trim().min(1).max(32) });
