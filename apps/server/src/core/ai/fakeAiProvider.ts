import type { AiModel } from '@bot/shared';
import type { AiProvider, AiRequest } from './aiProvider';

/** Pour les tests : remplace Gemini, sans réseau. Répond `answer`, ou lève `error` s'il est défini. */
export class FakeAiProvider implements AiProvider {
  readonly requests: AiRequest[] = [];
  answer = 'Réponse de test.';
  error: Error | null = null;
  models: AiModel[] = [{ id: 'gemini-test', label: 'Gemini Test' }];

  async generate(request: AiRequest): Promise<string> {
    this.requests.push(request);
    if (this.error) throw this.error;
    return this.answer;
  }

  async listModels(): Promise<AiModel[]> {
    if (this.error) throw this.error;
    return this.models;
  }
}
