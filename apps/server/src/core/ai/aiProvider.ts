import type { AiModel } from '@bot/shared';

/** Un message d'une conversation passée. */
export interface AiTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AiImage {
  mimeType: string;
  /** Contenu en base64. */
  data: string;
}

export interface AiRequest {
  model: string;
  systemPrompt: string;
  /** Du plus ancien au plus récent, commençant par un message de l'utilisateur. */
  history: AiTurn[];
  prompt: string;
  images: AiImage[];
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
