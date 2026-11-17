import type { AiModel } from '@bot/shared';
import { ApiError, GoogleGenAI } from '@google/genai';
import { AiError, type AiProvider, type AiRequest } from '../aiProvider';

const REQUEST_TIMEOUT_MS = 60_000;

export class GeminiProvider implements AiProvider {
  #client: GoogleGenAI | null = null;
  #clientKey: string | undefined;

  /** La clé est relue à chaque appel : la modifier dans le dashboard s'applique aussitôt. */
  constructor(private readonly getApiKey: () => string | undefined) {}

  async generate({ model, systemPrompt, prompt }: AiRequest): Promise<string> {
    try {
      const response = await this.#getClient().models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: systemPrompt, httpOptions: { timeout: REQUEST_TIMEOUT_MS } },
      });
      const text = response.text?.trim();
      if (!text) {
        throw new AiError(
          'emptyAnswer',
          `Réponse vide de Gemini (${response.candidates?.[0]?.finishReason ?? 'raison inconnue'}).`,
        );
      }
      return text;
    } catch (error) {
      throw toAiError(error, model);
    }
  }

  async listModels(): Promise<AiModel[]> {
    try {
      const models: AiModel[] = [];
      for await (const model of await this.#getClient().models.list()) {
        const id = model.name?.replace(/^models\//, '');
        if (!id?.startsWith('gemini') || !model.supportedActions?.includes('generateContent')) {
          continue;
        }
        models.push({ id, label: model.displayName ?? id });
      }
      return models.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      throw toAiError(error);
    }
  }

  #getClient(): GoogleGenAI {
    const apiKey = this.getApiKey();
    if (!apiKey)
      throw new AiError('missingKey', 'Aucune clé Gemini. Saisissez-la dans Paramètres.');
    if (!this.#client || this.#clientKey !== apiKey) {
      this.#client = new GoogleGenAI({ apiKey });
      this.#clientKey = apiKey;
    }
    return this.#client;
  }
}

function toAiError(error: unknown, model?: string): AiError {
  if (error instanceof AiError) return error;
  if (!(error instanceof ApiError)) {
    const message = error instanceof Error ? error.message : String(error);
    return new AiError('unavailable', `Gemini injoignable : ${message}`);
  }
  if (error.status === 401 || error.status === 403 || /API key/i.test(error.message)) {
    return new AiError('invalidKey', 'Clé Gemini refusée par Google. Vérifiez-la dans Paramètres.');
  }
  if (error.status === 429) {
    return new AiError(
      'quota',
      'Quota Gemini atteint. Réessayez plus tard ou choisissez un autre modèle.',
    );
  }
  if (error.status === 404 && model) {
    return new AiError(
      'unknownModel',
      `Modèle « ${model} » inconnu de Gemini. Choisissez-en un autre dans Comportement.`,
    );
  }
  if (error.status >= 500) {
    return new AiError('unavailable', `Gemini est momentanément indisponible (${error.status}).`);
  }
  return new AiError('other', `Erreur Gemini (${error.status}) : ${error.message}`);
}
