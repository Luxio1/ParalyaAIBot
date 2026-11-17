import { botConfigSchema, type AiModel, type BotConfig } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { AiError } from '../../core/ai/aiProvider';
import type { AiService } from '../../core/ai/aiService';
import type { SessionStore } from '../../core/memory/sessionStore';
import { AppError } from '../../lib/appError';
import type { ConfigService } from '../../services/configService';

export function registerConfigRoutes(
  app: FastifyInstance,
  config: ConfigService,
  ai: AiService,
  memory: SessionStore,
): void {
  app.get('/api/config', async (): Promise<BotConfig> => config.get());

  app.put('/api/config', async (request, reply) => {
    const updated = botConfigSchema.parse(request.body);
    config.update(updated);
    if (!updated.memoryEnabled) memory.clear();
    return reply.code(204).send();
  });

  app.get('/api/ai/models', async (): Promise<AiModel[]> => {
    try {
      return await ai.listModels();
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      // 502 : c'est le fournisseur d'IA qui a échoué, pas la requête du dashboard.
      throw new AppError(error.reason === 'missingKey' ? 400 : 502, 'ai_error', error.message);
    }
  });
}
