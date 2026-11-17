import { z } from 'zod';
import { DEFAULT_AI_MODEL } from '../constants';

export const TRIGGER_MODES = ['mentionOrPrefix', 'mention', 'prefix'] as const;
export type TriggerMode = (typeof TRIGGER_MODES)[number];

export const TRIGGER_MODE_LABELS: Record<TriggerMode, string> = {
  mentionOrPrefix: 'Mention ou préfixe',
  mention: 'Mention uniquement',
  prefix: 'Préfixe uniquement',
};

export const CHANNEL_MODES = ['all', 'whitelist'] as const;

export const SYSTEM_PROMPT_MAX_LENGTH = 8000;

/** Format des identifiants Discord (snowflakes). */
export const discordIdSchema = z.string().regex(/^\d{17,20}$/, 'Identifiant Discord invalide.');

export const botConfigSchema = z.object({
  triggerMode: z.enum(TRIGGER_MODES),
  prefix: z
    .string()
    .trim()
    .min(1, 'Préfixe requis.')
    .max(5, 'Préfixe : 5 caractères maximum.')
    .regex(/^\S+$/, "Le préfixe ne peut pas contenir d'espace."),
  channelMode: z.enum(CHANNEL_MODES),
  /** Salons autorisés en mode `whitelist` ; un fil suit son salon parent. */
  allowedChannelIds: z.array(discordIdSchema).max(200),
  allowDMs: z.boolean(),
  model: z
    .string()
    .trim()
    .regex(/^[\w.-]{1,100}$/, 'Nom de modèle invalide.'),
  systemPrompt: z
    .string()
    .trim()
    .min(1, 'Persona requis.')
    .max(SYSTEM_PROMPT_MAX_LENGTH, `Persona : ${SYSTEM_PROMPT_MAX_LENGTH} caractères maximum.`),
  memoryEnabled: z.boolean(),
  /** Durée d'inactivité au bout de laquelle une conversation est oubliée. */
  memoryRetentionMinutes: z
    .number()
    .int()
    .min(5, 'Rétention : 5 minutes minimum.')
    .max(1440, 'Rétention : 24 heures maximum.'),
  /** Messages conservés par conversation, ceux de l'utilisateur et du bot confondus. */
  memoryMaxMessages: z
    .number()
    .int()
    .min(4, 'Mémoire : 4 messages minimum.')
    .max(20, 'Mémoire : 20 messages maximum.'),
});
export type BotConfig = z.infer<typeof botConfigSchema>;

export const aiModelSchema = z.object({ id: z.string(), label: z.string() });
export type AiModel = z.infer<typeof aiModelSchema>;

export const PERSONA_PRESETS = [
  {
    name: 'Assistant polyvalent',
    description: 'Amical, professionnel et concis.',
    prompt:
      'Tu es un assistant virtuel utile, amical et très clair. Réponds toujours avec courtoisie, de manière concise, en utilisant des listes à puces si nécessaire.',
  },
  {
    name: 'Sarcastique',
    description: 'Humour grinçant, mais reste informatif.',
    prompt:
      "Tu es un bot Discord doté d'une personnalité cynique, ironique et sarcastique. Tu adores l'humour pince-sans-rire, mais tu finis quand même par donner de vraies réponses utiles sous tes airs désabusés. Reste concis.",
  },
  {
    name: 'Tuteur code',
    description: 'Pédagogue, fournit du code propre.',
    prompt:
      'Tu es un tuteur expert en informatique et programmation. Explique les concepts simplement, conseille les bonnes pratiques et présente le code dans des blocs Markdown impeccables.',
  },
  {
    name: 'Maître du Donjon',
    description: 'Narrateur de jeu de rôle fantastique.',
    prompt:
      "Tu es un Maître du Donjon pour un jeu de rôle médiéval-fantastique. Parle avec un ton mystérieux et épique. Réagis comme si l'utilisateur était un aventurier dans ton monde et propose-lui des choix.",
  },
  {
    name: 'Coach motivationnel',
    description: 'Énergie positive, conseils concrets.',
    prompt:
      "Tu es un coach de vie dynamique, positif et motivant. Utilise des expressions encourageantes, renforce la confiance en soi de l'utilisateur et donne des conseils pratiques pour surmonter la procrastination.",
  },
] as const;

export const DEFAULT_BOT_CONFIG: BotConfig = {
  triggerMode: 'mentionOrPrefix',
  prefix: '!',
  channelMode: 'all',
  allowedChannelIds: [],
  allowDMs: true,
  model: DEFAULT_AI_MODEL,
  systemPrompt: PERSONA_PRESETS[0].prompt,
  memoryEnabled: true,
  memoryRetentionMinutes: 30,
  memoryMaxMessages: 10,
};
