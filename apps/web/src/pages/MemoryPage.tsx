import type { MemorySession } from '@bot/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlaskConical, MessageSquare, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiSend, memorySessionsQuery } from '@/lib/api';

export function MemoryPage() {
  const sessions = useQuery(memorySessionsQuery);
  const now = useNow();
  const onError = (error: Error) => toast.error(error.message);
  const clearAll = useMutation({
    mutationFn: () => apiSend('DELETE', '/api/memory/sessions'),
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiSend('DELETE', `/api/memory/sessions/${encodeURIComponent(id)}`),
    onError,
  });
  // Une conversation expirée disparaît à l'écran sans attendre le nettoyage du serveur.
  const active = (sessions.data ?? []).filter((session) => Date.parse(session.expiresAt) > now);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Mémoire</h1>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          disabled={clearAll.isPending || active.length === 0}
          onClick={() => clearAll.mutate()}
        >
          <Trash2 />
          Tout effacer
        </Button>
      </header>
      <p className="text-muted-foreground text-sm">
        Conversations dont le bot se souvient. Leur contenu n'est jamais affiché ni écrit sur le
        disque. Durée et taille se règlent dans{' '}
        <Link to="/comportement" className="underline">
          Comportement
        </Link>
        .
      </p>

      <Card>
        <CardContent className="grid gap-2">
          {sessions.isError && <p className="text-destructive text-sm">{sessions.error.message}</p>}
          {active.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune conversation en mémoire.</p>
          ) : (
            active.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                remainingMs={Date.parse(session.expiresAt) - now}
                removing={remove.isPending && remove.variables === session.id}
                onRemove={() => remove.mutate(session.id)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionRow(props: {
  session: MemorySession;
  remainingMs: number;
  removing: boolean;
  onRemove: () => void;
}) {
  const { session } = props;
  const Icon = { dm: User, guild: MessageSquare, playground: FlaskConical }[session.kind];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <span className="font-medium">{session.userName}</span>
      <span className="text-muted-foreground">
        {session.channelName
          ? `#${session.channelName}`
          : session.kind === 'playground'
            ? 'Simulateur'
            : 'Message privé'}
      </span>
      <span className="text-muted-foreground ml-auto">
        {session.messageCount} message(s), oubli dans {formatDuration(props.remainingMs)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Effacer la conversation avec ${session.userName}`}
        title="Effacer"
        disabled={props.removing}
        onClick={props.onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${minutes}:${seconds}`;
}
