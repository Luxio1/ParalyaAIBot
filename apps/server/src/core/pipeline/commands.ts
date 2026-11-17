import type { Command } from '@bot/shared';

/** Accès aux commandes personnalisées ; `find` ne renvoie que les commandes actives. */
export interface CommandCatalog {
  find(name: string): Command | undefined;
  enabled(): Command[];
}

export interface CommandCall {
  command: Command;
  /** Texte écrit après le nom de la commande. */
  argument: string;
}

/** `text` est le message sans le préfixe : son premier mot désigne peut-être une commande. */
export function matchCommand(text: string, catalog: CommandCatalog): CommandCall | null {
  const name = text.split(/\s+/, 1)[0] ?? '';
  const command = name ? catalog.find(name) : undefined;
  return command ? { command, argument: text.slice(name.length).trim() } : null;
}

/** Sans `{query}` dans le modèle, le texte de l'utilisateur est ajouté à la fin. */
export function applyTemplate(template: string, query: string): string {
  return template.includes('{query}')
    ? template.replaceAll('{query}', query)
    : `${template}\n\n${query}`;
}

export function expandStatic(
  response: string,
  values: { prefix: string; user: string; commands: Command[] },
): string {
  return response
    .replaceAll('{commands}', commandList(values.commands, values.prefix))
    .replaceAll('{prefix}', values.prefix)
    .replaceAll('{user}', values.user);
}

export function commandList(commands: Command[], prefix: string): string {
  return commands
    .map((command) => {
      const usage = command.type === 'ai' ? ` <texte>` : '';
      const description = command.description ? ` : ${command.description}` : '';
      return `- \`${prefix}${command.name}${usage}\`${description}`;
    })
    .join('\n');
}
