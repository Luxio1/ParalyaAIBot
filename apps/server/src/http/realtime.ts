import type { ServerEvent } from '@bot/shared';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { LogBus } from '../core/logs/logBus';
import type { AuthService } from '../services/authService';
import { SESSION_COOKIE } from './session';

const SESSION_RECHECK_MS = 60_000;
/** Code de fermeture applicatif (plage 4000-4999) : le client doit se reconnecter au dashboard. */
const WS_CLOSE_UNAUTHORIZED = 4401;

export function registerRealtimeRoutes(
  app: FastifyInstance,
  logBus: LogBus,
  auth: AuthService,
): void {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = request.cookies[SESSION_COOKIE];
    send(socket, { type: 'logs:snapshot', entries: logBus.entries() });
    const unsubscribe = logBus.subscribe((event) => send(socket, event));

    // Une session fermée ailleurs (déconnexion, mot de passe changé) coupe aussi le flux ouvert.
    const recheck = setInterval(() => {
      if (!auth.authenticate(token)) socket.close(WS_CLOSE_UNAUTHORIZED, 'Session expirée');
    }, SESSION_RECHECK_MS);

    socket.on('close', () => {
      unsubscribe();
      clearInterval(recheck);
    });
  });
}

function send(socket: WebSocket, event: ServerEvent): void {
  socket.send(JSON.stringify(event));
}
