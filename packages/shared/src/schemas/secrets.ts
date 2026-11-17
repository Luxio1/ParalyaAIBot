import { z } from 'zod';

export const SECRET_NAMES = ['discordToken', 'geminiApiKey'] as const;
export const secretNameSchema = z.enum(SECRET_NAMES);
export type SecretName = z.infer<typeof secretNameSchema>;

export const SECRET_LABELS: Record<SecretName, string> = {
  discordToken: 'Token Discord',
  geminiApiKey: 'Clé API Gemini',
};

/** Seule vue d'un secret qui sort du serveur : jamais sa valeur. */
export const secretStatusSchema = z.object({
  name: secretNameSchema,
  isSet: z.boolean(),
  last4: z.string().nullable(),
  /** `env` : la valeur vient du fichier `.env` du serveur, faute de valeur saisie dans le dashboard. */
  source: z.enum(['dashboard', 'env']).nullable(),
});
export type SecretStatus = z.infer<typeof secretStatusSchema>;

export const putSecretRequestSchema = z.object({
  value: z.string().trim().min(1, 'Valeur requise.').max(512),
});
export type PutSecretRequest = z.infer<typeof putSecretRequestSchema>;
