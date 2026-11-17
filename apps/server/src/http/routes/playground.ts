import {
  playgroundRequestSchema,
  playgroundResetSchema,
  type EventTestResult,
  type PlaygroundResponse,
} from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { PlaygroundTransport, playgroundMessage } from '../../adapters/playground/playground';
import type { EventEngine } from '../../core/events/eventEngine';
import type { SessionStore } from '../../core/memory/sessionStore';
import { sessionInfo, type MessagePipeline } from '../../core/pipeline/messagePipeline';
import type { EventRuleService } from '../../services/eventRuleService';

/** Seule route qui accepte des images en base64 : 3 images de 4 Mo, plus le texte. */
const PLAYGROUND_BODY_LIMIT = 20 * 1024 * 1024;

export function registerPlaygroundRoutes(
  app: FastifyInstance,
  pipeline: MessagePipeline,
  engine: EventEngine,
  rules: EventRuleService,
  memory: SessionStore,
): void {
  app.post(
    '/api/playground/messages',
    { bodyLimit: PLAYGROUND_BODY_LIMIT },
    async (request): Promise<PlaygroundResponse> => {
      const body = playgroundRequestSchema.parse(request.body);
      const message = playgroundMessage(body);
      const transport = new PlaygroundTransport();

      const analyze = async (): Promise<{
        events: EventTestResult[];
        eventsError: string | null;
      }> => {
        const enabled = rules.enabled();
        if (!body.evaluateEvents || enabled.length === 0 || !message.text) {
          return { events: [], eventsError: null };
        }
        try {
          const results = await engine.test(
            { message: message.text, authorName: message.author.displayName },
            enabled,
          );
          return { events: results.filter((result) => result.matched), eventsError: null };
        } catch (error) {
          return {
            events: [],
            eventsError: error instanceof Error ? error.message : String(error),
          };
        }
      };

      const [, analysis] = await Promise.all([pipeline.handle(message, transport), analyze()]);
      return { replies: transport.replies, ...analysis };
    },
  );

  app.post('/api/playground/reset', async (request, reply) => {
    const { authorName } = playgroundResetSchema.parse(request.body);
    const message = playgroundMessage({ text: '', authorName, images: [], evaluateEvents: false });
    memory.remove(sessionInfo(message).id);
    return reply.code(204).send();
  });
}
