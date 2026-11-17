/** Erreur métier renvoyée telle quelle au client : `message` doit être lisible et sans secret. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
