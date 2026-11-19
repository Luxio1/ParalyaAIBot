import { z } from 'zod';

export const COMMAND_TYPES = ['static', 'ai'] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_TYPE_LABELS: Record<CommandType, string> = {
  static: 'Statique',
  ai: 'IA',
};

export const MAX_COMMANDS = 100;
export const STATIC_RESPONSE_MAX_LENGTH = 4000;
export const PROMPT_TEMPLATE_MAX_LENGTH = 2000;

const commandFields = z.object({
  /** Rangé en minuscules : `!Regles` et `!regles` désignent la même commande. */
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[\p{L}\p{N}_-]{1,32}$/u,
      'Nom : 1 à 32 caractères parmi lettres, chiffres, « _ » et « - », sans espace.',
    ),
  description: z.string().trim().max(200, 'Description : 200 caractères maximum.'),
  enabled: z.boolean(),
  type: z.enum(COMMAND_TYPES),
  /** Texte d'une commande statique ; variables `{commands}`, `{prefix}` et `{user}`. */
  response: z
    .string()
    .trim()
    .max(STATIC_RESPONSE_MAX_LENGTH, `Réponse : ${STATIC_RESPONSE_MAX_LENGTH} caractères maximum.`),
  /** Question d'une commande IA ; `{query}` reçoit le texte écrit après la commande. */
  promptTemplate: z
    .string()
    .trim()
    .max(PROMPT_TEMPLATE_MAX_LENGTH, `Modèle : ${PROMPT_TEMPLATE_MAX_LENGTH} caractères maximum.`),
  /** Consigne d'une commande IA ; vide, le persona global s'applique. */
  systemPrompt: z.string().trim(),
});

export const commandInputSchema = commandFields.superRefine((command, ctx) => {
  if (command.type === 'static' && !command.response) {
    ctx.addIssue({ code: 'custom', path: ['response'], message: 'Réponse requise.' });
  }
  if (command.type === 'ai' && !command.promptTemplate) {
    ctx.addIssue({
      code: 'custom',
      path: ['promptTemplate'],
      message: 'Modèle de question requis.',
    });
  }
});
export type CommandInput = z.infer<typeof commandInputSchema>;

export const commandSchema = commandFields.extend({ id: z.number().int() });
export type Command = z.infer<typeof commandSchema>;

const ai = (name: string, description: string, promptTemplate: string, systemPrompt: string) =>
  ({
    name,
    description,
    enabled: true,
    type: 'ai',
    response: '',
    promptTemplate,
    systemPrompt,
  }) as const;
const staticCommand = (name: string, description: string, response: string) =>
  ({
    name,
    description,
    enabled: true,
    type: 'static',
    response,
    promptTemplate: '',
    systemPrompt: '',
  }) as const;

export const EXAMPLE_COMMANDS: CommandInput[] = [
  staticCommand(
    'help',
    'Affiche les commandes disponibles',
    '🤖 **Commandes disponibles :**\n{commands}\n\nVous pouvez aussi me poser une question libre après « {prefix} » ou en me mentionnant.',
  ),
  staticCommand(
    'regles',
    'Rappelle les règles du serveur',
    '📜 **Règles du serveur :**\n1. **Respect mutuel** : aucune insulte, provocation ou propos discriminatoire.\n2. **Pas de spam** : évitez les mentions inutiles et les messages répétitifs.\n3. **Salons thématiques** : postez dans le salon approprié.\n4. **Entraide et bonne humeur** : partagez dans la bienveillance !',
  ),
  ai(
    'code',
    'Assistant développeur : coder, déboguer, expliquer',
    'Réponds de façon précise, avec des exemples de code commentés et les bonnes pratiques, à la demande suivante : {query}',
    'Tu es un ingénieur logiciel chevronné. Sois pédagogique, précis, et fournis du code propre dans des blocs Markdown.',
  ),
  ai(
    'traduis',
    'Traduit un texte en anglais (ou dans la langue demandée)',
    "Traduis le texte suivant de manière naturelle et fidèle en anglais, ou dans la langue indiquée par l'utilisateur : {query}",
    'Tu es un traducteur professionnel. Fournis uniquement la traduction, avec si nécessaire une brève note de contexte.',
  ),
  ai(
    'resume',
    'Résume un texte en points clés',
    'Résume le contenu suivant en 3 à 5 points clés clairs : {query}',
    'Tu es un assistant de synthèse. Sois clair, concis et structuré en puces.',
  ),
];
