import type { AiModel } from '@bot/shared';

export interface AiRequest {
  model: string;
  systemPrompt: string;
  prompt: string;
}

/** Un fournisseur d'IA (Gemini aujourd'hui). Ses erreurs sont des `AiError`. */
export interface AiProvider {
  generate(request: AiRequest): Promise<string>;
  listModels(): Promise<AiModel[]>;
}

export type AiErrorReason =
  'missingKey' | 'invalidKey' | 'quota' | 'unknownModel' | 'unavailable' | 'emptyAnswer' | 'other';

/** `message` est destiné à la console du dashboard, jamais aux utilisateurs Discord. */
export class AiError extends Error {
  constructor(
    readonly reason: AiErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
