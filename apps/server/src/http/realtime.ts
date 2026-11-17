import type { ServerEvent } from '@bot/shared';
import type { WebSocket } from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { BotManager } from '../adapters/discord/botManager';
import type { LogBus } from '../core/logs/logBus';
import type { SessionStore } from '../core/memory/sessionStore';
import type { AuthService } from '../services/authService';
import { SESSION_COOKIE } from './session';

const SESSION_RECHECK_MS = 60_000;
/** Code de fermeture applicatif (plage 4000-4999) : le client doit se reconnecter au dashboard. */
const WS_CLOSE_UNAUTHORIZED = 4401;

export function registerRealtimeRoutes(
  app: FastifyInstance,
  logBus: LogBus,
  bot: BotManager,
  memory: SessionStore,
  auth: AuthService,
): void {
  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = request.cookies[SESSION_COOKIE];
    send(socket, { type: 'logs:snapshot', entries: logBus.entries() });
    send(socket, { type: 'bot:status', status: bot.status() });
    const unsubscribers = [
      logBus.subscribe((event) => send(socket, event)),
      bot.subscribe((event) => send(socket, event)),
      memory.subscribe(() => send(socket, { type: 'memory:changed' })),
    ];

    // Une session fermée ailleurs (déconnexion, mot de passe changé) coupe aussi le flux ouvert.
    const recheck = setInterval(() => {
      if (!auth.authenticate(token)) socket.close(WS_CLOSE_UNAUTHORIZED, 'Session expirée');
    }, SESSION_RECHECK_MS);

    socket.on('close', () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      clearInterval(recheck);
    });
  });
}

function send(socket: WebSocket, event: ServerEvent): void {
  socket.send(JSON.stringify(event));
}
