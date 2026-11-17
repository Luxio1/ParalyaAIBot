import {
  changePasswordRequestSchema,
  loginRequestSchema,
  setupRequestSchema,
  type AuthState,
} from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../lib/appError';
import type { AuthService } from '../../services/authService';
import { SESSION_COOKIE, clearSessionCookie, setSessionCookie } from '../session';

/** Anti-bruteforce : par IP et par route. */
const BRUTEFORCE_LIMIT = { rateLimit: { max: 5, timeWindow: 60_000 } };

export function registerPublicAuthRoutes(app: FastifyInstance, auth: AuthService): void {
  app.get('/api/auth/state', async (request): Promise<AuthState> => {
    const user = auth.authenticate(request.cookies[SESSION_COOKIE]);
    return { needsSetup: auth.needsSetup(), user: user ? { username: user.username } : null };
  });

  app.post('/api/auth/setup', { config: BRUTEFORCE_LIMIT }, async (request, reply) => {
    const session = await auth.setup(setupRequestSchema.parse(request.body));
    setSessionCookie(request, reply, session);
    return reply.code(204).send();
  });

  app.post('/api/auth/login', { config: BRUTEFORCE_LIMIT }, async (request, reply) => {
    const session = await auth.login(loginRequestSchema.parse(request.body));
    if (!session) {
      throw new AppError(401, 'invalid_credentials', 'Identifiant ou mot de passe incorrect.');
    }
    setSessionCookie(request, reply, session);
    return reply.code(204).send();
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) auth.logout(token);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}

export function registerProtectedAuthRoutes(app: FastifyInstance, auth: AuthService): void {
  app.post('/api/auth/password', { config: BRUTEFORCE_LIMIT }, async (request, reply) => {
    await auth.changePassword(request.user, changePasswordRequestSchema.parse(request.body));
    return reply.code(204).send();
  });
}
