import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { DatabaseHandle } from '../db/client';
import type { Env } from '../env';
import { registerHealthRoute } from './routes/health';
import { registerStatic } from './static';

export interface AppDeps {
  env: Env;
  database: DatabaseHandle;
}

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  if (env.nodeEnv === 'test') return false;
  return {
    level: env.logLevel,
    // Ne jamais logger un secret : en-têtes et champs sensibles masqués.
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

/** Construit l'application HTTP sans l'écouter (testable via `app.inject()`). */
export async function buildApp({ env, database }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(env),
    bodyLimit: 1024 * 1024, // 1 Mo (le legacy acceptait 50 Mo)
  });

  registerHealthRoute(app, database);
  const hasWeb = await registerStatic(app, env.webDistDir);
  if (env.isProduction && !hasWeb) {
    app.log.warn(`Dashboard introuvable dans ${env.webDistDir} : lancez « pnpm build ».`);
  }

  return app;
}
