import { z } from 'zod';

export const BOT_STATES = ['offline', 'connecting', 'online', 'error'] as const;
export type BotState = (typeof BOT_STATES)[number];

export const BOT_STATE_LABELS: Record<BotState, string> = {
  offline: 'Hors ligne',
  connecting: 'Connexion',
  online: 'En ligne',
  error: 'Erreur',
};

export const botStatusSchema = z.object({
  state: z.enum(BOT_STATES),
  user: z.object({ id: z.string(), tag: z.string(), avatarUrl: z.string() }).nullable(),
  guildCount: z.number().int(),
  /** Latence du WebSocket Discord en millisecondes, inconnue avant le premier battement. */
  ping: z.number().int().nullable(),
  error: z.string().nullable(),
  inviteUrl: z.string().nullable(),
});
export type BotStatus = z.infer<typeof botStatusSchema>;

export const CHANNEL_KINDS = ['text', 'announcement', 'forum'] as const;

export const discoveredGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconUrl: z.string().nullable(),
  /** Dans l'ordre d'affichage de Discord. */
  channels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(CHANNEL_KINDS),
      category: z.string().nullable(),
    }),
  ),
  /** Du plus haut au plus bas, sans `@everyone`. */
  roles: z.array(z.object({ id: z.string(), name: z.string(), color: z.string().nullable() })),
});
export type DiscoveredGuild = z.infer<typeof discoveredGuildSchema>;
