import { LOG_BUFFER_SIZE, serverEventSchema, type LogEntry } from '@bot/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { authStateQuery } from '@/lib/api';

const MAX_RETRY_DELAY_MS = 10_000;

/** Flux WebSocket `/ws`, reconnecté automatiquement. */
export function useRealtime(): { logs: LogEntry[]; connected: boolean } {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = () => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.onopen = () => {
        setConnected(true);
        retryDelay = 1000;
      };
      socket.onmessage = (message: MessageEvent<string>) => {
        const event = serverEventSchema.parse(JSON.parse(message.data));
        if (event.type === 'logs:snapshot') setLogs(event.entries);
        if (event.type === 'log') {
          setLogs((previous) => [...previous.slice(-(LOG_BUFFER_SIZE - 1)), event.entry]);
        }
        if (event.type === 'logs:cleared') setLogs([]);
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

  return { logs, connected };
}
