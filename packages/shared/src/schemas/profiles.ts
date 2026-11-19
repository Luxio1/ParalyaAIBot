import { z } from 'zod';
import type { BotConfig } from './botConfig';

/**
 * Réglages propres à chaque profil de comportement ; les autres réglages (MP, quota, exemptions,
 * retranscription, moteur d'événements) sont communs à tous les profils. Chaque profil a aussi
 * ses propres commandes et règles d'événements actives.
 */
export const PROFILE_FIELDS = [
  'triggerMode',
  'prefix',
  'channelMode',
  'allowedChannelIds',
  'model',
  'systemPrompt',
  'memoryEnabled',
  'memoryRetentionMinutes',
  'memoryMaxMessages',
] as const satisfies readonly (keyof BotConfig)[];
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileBehavior = Pick<BotConfig, ProfileField>;

export const profileNameSchema = z
  .string()
  .trim()
  .min(1, 'Nom du profil requis.')
  .max(50, 'Nom du profil : 50 caractères maximum.');

export const profileInputSchema = z.object({ name: profileNameSchema });

export const profilesStateSchema = z.object({
  activeId: z.number().int(),
  profiles: z.array(z.object({ id: z.number().int(), name: z.string() })),
});
export type ProfilesState = z.infer<typeof profilesStateSchema>;
