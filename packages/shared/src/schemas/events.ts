import { z } from 'zod';
import { discordIdSchema } from './botConfig';

export const DM_TARGETS = ['author', 'user', 'role'] as const;
export const ALERT_TARGETS = ['source', 'specific'] as const;
export const TEXT_MODES = ['custom', 'ai'] as const;
export type TextMode = (typeof TEXT_MODES)[number];

export const EVENT_TEXT_MAX_LENGTH = 2000;
export const MAX_EVENT_RULES = 50;
/** Membres d'un rôle contactés au plus par MP pour une même alerte. */
export const MAX_ROLE_DM_RECIPIENTS = 10;

/** Texte écrit à l'avance (avec variables) ou consigne donnée à l'IA pour le rédiger. */
const actionText = z
  .string()
  .trim()
  .max(EVENT_TEXT_MAX_LENGTH, `Texte : ${EVENT_TEXT_MAX_LENGTH} caractères maximum.`);

const eventRuleFields = z.object({
  name: z.string().trim().min(1, 'Nom requis.').max(100, 'Nom : 100 caractères maximum.'),
  description: z.string().trim().max(300, 'Description : 300 caractères maximum.'),
  enabled: z.boolean(),
  /** Situation à détecter, décrite en langage courant. */
  triggerPrompt: z
    .string()
    .trim()
    .min(1, 'Critère de déclenchement requis.')
    .max(1000, 'Critère : 1000 caractères maximum.'),
  channelMode: z.enum(['all', 'specific']),
  channelIds: z.array(discordIdSchema).max(100),
  /** Délai minimum entre deux déclenchements de la règle pour une même personne. */
  cooldownSeconds: z
    .number()
    .int()
    .min(0, 'Délai : 0 seconde minimum.')
    .max(86_400, 'Délai : 24 heures maximum.'),
  dm: z.object({
    enabled: z.boolean(),
    target: z.enum(DM_TARGETS),
    /** Utilisateur (`user`) ou rôle (`role`) destinataire. */
    targetId: discordIdSchema.nullable(),
    mode: z.enum(TEXT_MODES),
    text: actionText,
  }),
  channel: z.object({
    enabled: z.boolean(),
    target: z.enum(ALERT_TARGETS),
    channelId: discordIdSchema.nullable(),
    mode: z.enum(TEXT_MODES),
    text: actionText,
    /** Seule mention autorisée à notifier dans l'alerte. */
    mentionRoleId: discordIdSchema.nullable(),
  }),
});

export const eventRuleInputSchema = eventRuleFields.superRefine((rule, ctx) => {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });
  if (!rule.dm.enabled && !rule.channel.enabled) {
    issue(['dm', 'enabled'], 'Choisissez au moins une action : MP ou message dans un salon.');
  }
  if (rule.channelMode === 'specific' && rule.channelIds.length === 0) {
    issue(['channelIds'], 'Choisissez au moins un salon surveillé.');
  }
  if (rule.dm.enabled) {
    if (rule.dm.target !== 'author' && !rule.dm.targetId) {
      issue(['dm', 'targetId'], 'Choisissez le destinataire du MP.');
    }
    if (!rule.dm.text) issue(['dm', 'text'], textRequired('MP', rule.dm.mode));
  }
  if (rule.channel.enabled) {
    if (rule.channel.target === 'specific' && !rule.channel.channelId) {
      issue(['channel', 'channelId'], "Choisissez le salon de l'alerte.");
    }
    if (!rule.channel.text)
      issue(['channel', 'text'], textRequired('message de salon', rule.channel.mode));
  }
});
export type EventRuleInput = z.infer<typeof eventRuleInputSchema>;

/** Règle enregistrée : les exemples peuvent être incomplets tant qu'ils restent désactivés. */
export const eventRuleSchema = eventRuleFields.extend({ id: z.number().int() });
export type EventRule = z.infer<typeof eventRuleSchema>;

function textRequired(action: string, mode: TextMode): string {
  return mode === 'ai' ? `Consigne du ${action} requise.` : `Texte du ${action} requis.`;
}

export const eventTestRequestSchema = z.object({
  message: z.string().trim().min(1, 'Message à tester requis.').max(2000),
  authorName: z.string().trim().min(1).max(32).default('Testeur'),
});
export type EventTestRequest = z.infer<typeof eventTestRequestSchema>;

export const eventTestResultSchema = z.object({
  ruleId: z.number().int(),
  name: z.string(),
  enabled: z.boolean(),
  matched: z.boolean(),
  reason: z.string(),
  /** Aperçu des messages prévus ; un texte rédigé par l'IA n'est pas généré par le testeur. */
  dmPreview: z.string().nullable(),
  channelPreview: z.string().nullable(),
});
export type EventTestResult = z.infer<typeof eventTestResultSchema>;

const noDm = {
  enabled: false,
  target: 'author',
  targetId: null,
  mode: 'custom',
  text: '',
} as const;
const noAlert = {
  enabled: false,
  target: 'source',
  channelId: null,
  mode: 'custom',
  text: '',
  mentionRoleId: null,
} as const;

/** Installés désactivés : le salon d'alerte et le rôle à mentionner restent à choisir. */
export const EXAMPLE_EVENT_RULES: EventRuleInput[] = [
  {
    name: 'Toxicité et vulgarité',
    description: "Avertit l'auteur en MP et alerte les modérateurs.",
    enabled: false,
    triggerPrompt:
      "Quand quelqu'un insulte, menace, utilise des propos grossiers ou se montre agressif envers d'autres membres.",
    channelMode: 'all',
    channelIds: [],
    cooldownSeconds: 60,
    dm: {
      enabled: true,
      target: 'author',
      targetId: null,
      mode: 'custom',
      text: 'Bonjour {pseudo}, ton message dans #{channel} ne respecte pas les règles de courtoisie du serveur. Merci de rester respectueux.',
    },
    channel: {
      enabled: true,
      target: 'specific',
      channelId: null,
      mode: 'custom',
      text: '🚨 **Propos inappropriés** de {user} dans #{channel} : {message}\nRaison : {reason}',
      mentionRoleId: null,
    },
  },
  {
    name: 'Demande de recrutement',
    description: 'Envoie en MP la marche à suivre pour rejoindre le staff.',
    enabled: false,
    triggerPrompt:
      "Quand quelqu'un demande comment devenir modérateur, rejoindre le staff ou postuler dans l'équipe.",
    channelMode: 'all',
    channelIds: [],
    cooldownSeconds: 3600,
    dm: {
      enabled: true,
      target: 'author',
      targetId: null,
      mode: 'custom',
      text: "Bonjour {pseudo} ! Pour rejoindre l'équipe, consulte le salon des candidatures ou contacte un administrateur.",
    },
    channel: noAlert,
  },
  {
    name: 'Détresse ou harcèlement',
    description: "Alerte l'équipe en priorité, avec un résumé rédigé par l'IA.",
    enabled: false,
    triggerPrompt:
      "Quand un membre exprime une grande détresse, dit être victime de harcèlement ou de menaces, ou demande une aide d'urgence.",
    channelMode: 'all',
    channelIds: [],
    cooldownSeconds: 300,
    dm: noDm,
    channel: {
      enabled: true,
      target: 'specific',
      channelId: null,
      mode: 'ai',
      text: "Rédige une alerte prioritaire et factuelle pour l'équipe de modération : résume la situation et cite le salon concerné.",
      mentionRoleId: null,
    },
  },
  {
    name: 'Questions sur le serveur',
    description: 'Oriente les membres perdus vers les bons salons.',
    enabled: false,
    triggerPrompt:
      "Quand quelqu'un pose une question générale sur le fonctionnement du serveur, les rôles ou où trouver les informations.",
    channelMode: 'all',
    channelIds: [],
    cooldownSeconds: 600,
    dm: noDm,
    channel: {
      enabled: true,
      target: 'source',
      channelId: null,
      mode: 'ai',
      text: 'Réponds chaleureusement et brièvement, en orientant le membre vers les salons utiles (règles, rôles, annonces).',
      mentionRoleId: null,
    },
  },
];
