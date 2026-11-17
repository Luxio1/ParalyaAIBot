/** Valeurs disponibles dans les textes des règles d'événements. */
export interface EventVariables {
  /** `@nom_utilisateur`, en texte : une variable ne notifie jamais personne. */
  user: string;
  pseudo: string;
  userId: string;
  channel: string;
  message: string;
  reason: string;
}

const MESSAGE_MAX_LENGTH = 500;

export function fillVariables(template: string, values: EventVariables): string {
  const message =
    values.message.length > MESSAGE_MAX_LENGTH
      ? `${values.message.slice(0, MESSAGE_MAX_LENGTH)}...`
      : values.message;
  return template
    .replaceAll('{user}', values.user)
    .replaceAll('{pseudo}', values.pseudo)
    .replaceAll('{userId}', values.userId)
    .replaceAll('{channel}', values.channel)
    .replaceAll('{message}', message)
    .replaceAll('{reason}', values.reason);
}
