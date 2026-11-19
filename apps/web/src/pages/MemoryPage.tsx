import type { MemorySession } from '@bot/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FlaskConical, MessageSquare, Trash2, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SaveBar, Section, useConfigForm, type ConfigForm } from '@/components/ConfigForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  const form = useConfigForm();
  // Une conversation expirée disparaît à l'écran sans attendre le nettoyage du serveur.
  const active = (sessions.data ?? []).filter((session) => Date.parse(session.expiresAt) > now);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Mémoire</h1>

      {form && <MemorySettings form={form} />}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="mr-auto">Conversations en cours</CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={clearAll.isPending || active.length === 0}
              onClick={() => clearAll.mutate()}
            >
              <Trash2 />
              Tout effacer
            </Button>
          </div>
          <CardDescription>
            Leur contenu n'est jamais affiché ni écrit sur le disque. La mémoire est vidée au
            redémarrage du serveur et au changement de profil.
          </CardDescription>
        </CardHeader>
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

      {form && <SaveBar form={form} />}
    </div>
  );
}

const RETENTION_CHOICES = [
  [5, '5 minutes'],
  [15, '15 minutes'],
  [30, '30 minutes'],
  [60, '1 heure'],
  [180, '3 heures'],
  [720, '12 heures'],
  [1440, '24 heures'],
] as const;

function MemorySettings({ form }: { form: ConfigForm }) {
  const { draft, set } = form;
  return (
    <Section
      title="Réglages"
      description="Le bot se souvient des derniers échanges : une conversation par personne en MP, et par personne et salon sur un serveur."
      scope="profile"
    >
      <div className="flex items-center gap-3">
        <Switch
          id="memoryEnabled"
          checked={draft.memoryEnabled}
          onCheckedChange={(memoryEnabled) => set({ memoryEnabled })}
        />
        <Label htmlFor="memoryEnabled">Mémoire de conversation</Label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="memoryRetention">Oublier après une inactivité de</Label>
          <select
            id="memoryRetention"
            className="border-input dark:bg-input/30 [&>option]:bg-popover h-9 rounded-md border bg-transparent px-3 text-sm"
            disabled={!draft.memoryEnabled}
            value={draft.memoryRetentionMinutes}
            onChange={(event) => set({ memoryRetentionMinutes: Number(event.target.value) })}
          >
            {RETENTION_CHOICES.map(([minutes, label]) => (
              <option key={minutes} value={minutes}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="memoryMaxMessages">Messages conservés (4 à 20)</Label>
          <Input
            id="memoryMaxMessages"
            type="number"
            min={4}
            max={20}
            disabled={!draft.memoryEnabled}
            value={draft.memoryMaxMessages}
            onChange={(event) => set({ memoryMaxMessages: Number(event.target.value) })}
          />
        </div>
      </div>
    </Section>
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
