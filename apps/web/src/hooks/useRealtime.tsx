import { LOG_BUFFER_SIZE, serverEventSchema, type BotStatus, type LogEntry } from '@bot/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authStateQuery, BOT_DISCOVERY_QUERY_KEY } from '@/lib/api';

const MAX_RETRY_DELAY_MS = 10_000;

interface Realtime {
  logs: LogEntry[];
  connected: boolean;
  /** `null` jusqu'au premier message du serveur. */
  bot: BotStatus | null;
}

const RealtimeContext = createContext<Realtime | null>(null);

/** Une seule connexion WebSocket `/ws` pour toutes les pages, reconnectée automatiquement. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [bot, setBot] = useState<BotStatus | null>(null);

  useEffect(() => {
    let socket: WebSocket;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let lastState: BotStatus['state'] | undefined;
    const refreshDiscovery = () =>
      void queryClient.invalidateQueries({ queryKey: BOT_DISCOVERY_QUERY_KEY });

    const connect = () => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.onopen = () => {
        setConnected(true);
        retryDelay = 1000;
      };
      socket.onmessage = (message: MessageEvent<string>) => {
        const event = serverEventSchema.parse(JSON.parse(message.data));
        switch (event.type) {
          case 'logs:snapshot':
            return setLogs(event.entries);
          case 'log':
            return setLogs((previous) => [...previous.slice(-(LOG_BUFFER_SIZE - 1)), event.entry]);
          case 'logs:cleared':
            return setLogs([]);
          case 'bot:status':
            setBot(event.status);
            // Hors ligne, la liste des serveurs se vide ; en ligne, elle se remplit.
            if (event.status.state !== lastState) refreshDiscovery();
            lastState = event.status.state;
            return;
          case 'bot:discovery-changed':
            return refreshDiscovery();
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (stopped) return;
        // Une session expirée ferme aussi le flux : revérifier renvoie alors vers la connexion.
        void queryClient.invalidateQueries({ queryKey: authStateQuery.queryKey });
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket.close();
    };
  }, [queryClient]);

  return (
    <RealtimeContext.Provider value={{ logs, connected, bot }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime(): Realtime {
  const realtime = useContext(RealtimeContext);
  if (!realtime) throw new Error('useRealtime doit être utilisé sous <RealtimeProvider>');
  return realtime;
}
