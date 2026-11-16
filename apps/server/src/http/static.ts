import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const NOT_FOUND = { error: 'not_found', message: 'Ressource introuvable.' };

/**
 * Sert le dashboard buildé (`apps/web/dist`) avec repli SPA sur `index.html`.
 * En développement le dossier n'existe pas : Vite sert le front et proxifie l'API.
 */
export async function registerStatic(app: FastifyInstance, webDistDir: string): Promise<boolean> {
  const hasWeb = existsSync(join(webDistDir, 'index.html'));

  if (hasWeb) {
    await app.register(fastifyStatic, { root: webDistDir, wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    const isApi = path === '/api' || path.startsWith('/api/') || path.startsWith('/ws');
    const wantsHtml =
      request.method === 'GET' && (request.headers.accept ?? '').includes('text/html');
    if (hasWeb && !isApi && wantsHtml) {
      return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
    }
    return reply.code(404).send(NOT_FOUND);
  });

  return hasWeb;
}
