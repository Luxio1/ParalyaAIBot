import type { FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_MAX_AGE_MS, type AuthenticatedUser, type Session } from '../services/authService';

export const SESSION_COOKIE = 'paralya_session';

declare module 'fastify' {
  interface FastifyRequest {
    /** Renseigné par le hook d'authentification ; à lire uniquement dans les routes protégées. */
    user: AuthenticatedUser;
  }
}

export function setSessionCookie(request: FastifyRequest, reply: FastifyReply, session: Session) {
  reply.setCookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'strict',
    // Un cookie `Secure` n'est jamais renvoyé en HTTP : il ne faut l'exiger que si la requête est en HTTPS.
    secure: request.protocol === 'https',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
