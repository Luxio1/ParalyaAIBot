import type { AiModel } from '@bot/shared';
import type { AiProvider, AiRequest } from './aiProvider';

const MODELS_CACHE_MS = 10 * 60_000;

/** Point d'entrée unique vers l'IA ; garde la liste des modèles en cache. */
export class AiService {
  #models: { list: AiModel[]; expiresAt: number } | null = null;

  constructor(private readonly provider: AiProvider) {}

  generate(request: AiRequest): Promise<string> {
    return this.provider.generate(request);
  }

  async listModels(): Promise<AiModel[]> {
    if (this.#models && this.#models.expiresAt > Date.now()) return this.#models.list;
    const list = await this.provider.listModels();
    this.#models = { list, expiresAt: Date.now() + MODELS_CACHE_MS };
    return list;
  }

  /** À appeler quand la clé change : la nouvelle peut donner accès à d'autres modèles. */
  clearModelCache(): void {
    this.#models = null;
  }
}
