import { BOT_STATE_LABELS, type BotStatus, type DiscoveredGuild } from '@bot/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, ExternalLink, Hash, Megaphone, MessagesSquare, Play, Square } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BotStateDot } from '@/components/BotStateDot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtime } from '@/hooks/useRealtime';
import { apiSend, botDiscoveryQuery } from '@/lib/api';

const CHANNEL_ICONS = { text: Hash, announcement: Megaphone, forum: MessagesSquare };

export function BotPage() {
  const { bot } = useRealtime();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Bot</h1>
      {bot && <StatusCard status={bot} />}
      <GuildsCard online={bot?.state === 'online'} />
    </div>
  );
}

function StatusCard({ status }: { status: BotStatus }) {
  const onError = (error: Error) => toast.error(error.message);
  const start = useMutation({ mutationFn: () => apiSend('POST', '/api/bot/start'), onError });
  const stop = useMutation({ mutationFn: () => apiSend('POST', '/api/bot/stop'), onError });
  const running = status.state === 'online' || status.state === 'connecting';

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {status.user ? (
            <img src={status.user.avatarUrl} alt="" className="size-14 rounded-full" />
          ) : (
            <span className="bg-secondary flex size-14 items-center justify-center rounded-full">
              <Bot className="text-muted-foreground size-6" aria-hidden />
            </span>
          )}
          <div className="grid gap-1">
            <span className="font-semibold">{status.user?.tag ?? 'Bot Discord'}</span>
            <span className="flex items-center gap-2 text-sm">
              <BotStateDot state={status.state} />
              {BOT_STATE_LABELS[status.state]}
            </span>
          </div>
          <div className="ml-auto flex gap-2">
            {running ? (
              <Button variant="outline" disabled={stop.isPending} onClick={() => stop.mutate()}>
                <Square />
                Arrêter
              </Button>
            ) : (
              <Button disabled={start.isPending} onClick={() => start.mutate()}>
                <Play />
                Démarrer
              </Button>
            )}
          </div>
        </div>

        {status.error && (
          <p className="text-destructive text-sm" role="alert">
            {status.error}{' '}
            {status.error.includes('Paramètres') && (
              <Link to="/parametres" className="underline">
                Ouvrir Paramètres
              </Link>
            )}
          </p>
        )}

        {status.state === 'online' && (
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Stat label="Serveurs" value={String(status.guildCount)} />
            <Stat
              label="Latence"
              value={status.ping === null ? 'mesure...' : `${status.ping} ms`}
            />
          </dl>
        )}

        {status.inviteUrl && (
          <Button asChild variant="outline" className="justify-self-start">
            <a href={status.inviteUrl} target="_blank" rel="noreferrer">
              <ExternalLink />
              Inviter le bot sur un serveur
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function GuildsCard({ online }: { online: boolean }) {
  const guilds = useQuery({ ...botDiscoveryQuery, enabled: online });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Serveurs</CardTitle>
        <CardDescription>
          Salons et rôles visibles par le bot, mis à jour en direct.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {!online ? (
          <p className="text-muted-foreground text-sm">Démarrez le bot pour voir ses serveurs.</p>
        ) : guilds.isError ? (
          <p className="text-destructive text-sm">{guilds.error.message}</p>
        ) : guilds.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Le bot n'a rejoint aucun serveur : utilisez le bouton « Inviter le bot ».
          </p>
        ) : (
          guilds.data?.map((guild) => <GuildDetails key={guild.id} guild={guild} />)
        )}
      </CardContent>
    </Card>
  );
}

function GuildDetails({ guild }: { guild: DiscoveredGuild }) {
  return (
    <details className="rounded-md border">
      <summary className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-3 py-2">
        {guild.iconUrl ? (
          <img src={guild.iconUrl} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="bg-secondary flex size-6 items-center justify-center rounded-full text-xs">
            {guild.name.charAt(0)}
          </span>
        )}
        <span className="font-medium">{guild.name}</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {guild.channels.length} salons, {guild.roles.length} rôles
        </span>
      </summary>
      <div className="grid gap-4 border-t p-3 text-sm sm:grid-cols-2">
        <section>
          <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">Salons</h3>
          <ul className="grid gap-0.5">
            {guild.channels.map((channel, index) => {
              const Icon = CHANNEL_ICONS[channel.kind];
              const newCategory = channel.category !== guild.channels[index - 1]?.category;
              return (
                <li key={channel.id}>
                  {newCategory && channel.category && (
                    <p className="text-muted-foreground mt-2 text-xs">{channel.category}</p>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Icon className="text-muted-foreground size-3.5" aria-hidden />
                    {channel.name}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3 className="text-muted-foreground mb-1 text-xs font-medium uppercase">Rôles</h3>
          <div className="flex flex-wrap gap-1">
            {guild.roles.map((role) => (
              <Badge key={role.id} variant="outline">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: role.color ?? 'var(--muted-foreground)' }}
                />
                {role.name}
              </Badge>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}
