/**
 * Gras (`**`) ou souligné (`__`) ouvert sur une ligne et refermé au début d'une suivante :
 * `**@AirDox\n\n** est...`. Discord n'applique pas une mise en forme coupée par un saut de ligne
 * et affiche alors les astérisques.
 */
const SPLIT_EMPHASIS = /(\*\*|__)([^\n*_]+?)[ \t]*\n+[ \t]*\1(?=[ \t]|$)/gm;

/** Répare les erreurs de mise en forme fréquentes dans les réponses de l'IA, hors blocs de code. */
export function repairDiscordMarkdown(text: string): string {
  // Les parties impaires sont dans des blocs de code : elles restent intactes.
  return text
    .split('```')
    .map((part, index) => (index % 2 === 1 ? part : part.replace(SPLIT_EMPHASIS, '$1$2$1')))
    .join('```');
}
