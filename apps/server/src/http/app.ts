import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyWebsocket from '@fastify/websocket';
import Fastify, {
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import { ZodError } from 'zod';
import type { BotManager } from '../adapters/discord/botManager';
import type { LogBus } from '../core/logs/logBus';
import type { DatabaseHandle } from '../db/client';
import type { Env } from '../env';
import { AppError } from '../lib/appError';
import type { AuthService } from '../services/authService';
import type { SecretsService } from '../services/secretsService';
import { registerRealtimeRoutes } from './realtime';
import { registerProtectedAuthRoutes, registerPublicAuthRoutes } from './routes/auth';
import { registerBotRoutes } from './routes/bot';
import { registerHealthRoute } from './routes/health';
import { registerLogsRoutes } from './routes/logs';
import { registerSecretsRoutes } from './routes/secrets';
import { SESSION_COOKIE } from './session';
import { registerStatic } from './static';

export interface AppDeps {
  env: Env;
  database: DatabaseHandle;
  logBus: LogBus;
  auth: AuthService;
  secrets: SecretsService;
  bot: BotManager;
}

/** Ne lance pas l'écoute : les tests passent par `app.inject()`. */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { env, database, logBus, auth, secrets, bot } = deps;
  const app = Fastify({
    logger: loggerOptions(env),
    bodyLimit: 1024 * 1024,
    trustProxy: env.trustProxy,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        // Avatars et icônes de serveurs servis par Discord.
        imgSrc: ["'self'", 'data:', 'https://cdn.discordapp.com'],
        // Le dashboard doit rester utilisable en HTTP simple (VPS sans certificat).
        upgradeInsecureRequests: null,
      },
    },
  });
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) =>
      new AppError(
        429,
        'too_many_requests',
        `Trop de tentatives. Réessayez dans ${Math.ceil(context.ttl / 1000)} s.`,
      ),
  });
  await app.register(fastifyWebsocket, { options: { maxPayload: 64 * 1024 } });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? 'Requête invalide.';
      return reply.code(400).send({ error: 'invalid_request', message });
    }
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode < 500) {
      return reply.code(statusCode).send({ error: 'bad_request', message: 'Requête invalide.' });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'internal_error', message: 'Erreur interne du serveur.' });
  });

  app.addHook('onRequest', async (request, reply) => {
    if (isStateChanging(request) && isCrossOrigin(request)) {
      return reply.code(403).send({ error: 'forbidden_origin', message: 'Origine non autorisée.' });
    }
  });

  registerHealthRoute(app, database);
  registerPublicAuthRoutes(app, auth);

  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', async (request, reply) => {
      const user = auth.authenticate(request.cookies[SESSION_COOKIE]);
      if (!user) {
        return reply.code(401).send({
          error: 'unauthorized',
          message: 'Session absente ou expirée. Reconnectez-vous.',
        });
      }
      request.user = user;
    });
    registerProtectedAuthRoutes(protectedApp, auth);
    registerSecretsRoutes(protectedApp, secrets);
    registerLogsRoutes(protectedApp, logBus);
    registerBotRoutes(protectedApp, bot);
    registerRealtimeRoutes(protectedApp, logBus, bot, auth);
  });

  const hasWeb = await registerStatic(app, env.webDistDir);
  if (env.isProduction && !hasWeb) {
    app.log.warn(`Dashboard introuvable dans ${env.webDistDir} : lancez « pnpm build ».`);
  }
  return app;
}

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.nodeEnv === 'test') return false;
  return {
    level: env.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.token',
        '*.password',
        '*.apiKey',
      ],
      censor: '[masqué]',
    },
    ...(env.isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        }),
  };
}

/** La connexion WebSocket est un GET, mais elle ouvre une session authentifiée par cookie. */
function isStateChanging(request: FastifyRequest): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.url.startsWith('/ws');
}

/** Sans en-tête `Origin` (curl, scripts), la requête ne vient pas d'une page tierce dans un navigateur. */
function isCrossOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (origin === undefined) return false;
  return !URL.canParse(origin) || new URL(origin).host !== request.host;
}
