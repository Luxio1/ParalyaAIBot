import { LOG_TYPE_LABELS, LOG_TYPES, type LogType } from '@bot/shared';
import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRealtime } from '@/hooks/useRealtime';
import { apiSend } from '@/lib/api';
import { cn } from '@/lib/utils';

const TYPE_COLORS: Record<LogType, string> = {
  system: 'text-slate-300',
  discord: 'text-indigo-300',
  ai: 'text-fuchsia-300',
  success: 'text-emerald-300',
  error: 'text-red-300',
  cooldown: 'text-amber-300',
  command: 'text-sky-300',
  dm: 'text-teal-300',
  event: 'text-orange-300',
};

const timeFormat = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium' });

export function ConsolePage() {
  const { logs, connected } = useRealtime();
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<LogType>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const clear = useMutation({
    mutationFn: () => apiSend('DELETE', '/api/logs'),
    onError: (error) => toast.error(error.message),
  });

  const visibleLogs = logs.filter((entry) => !hiddenTypes.has(entry.type));

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [visibleLogs.length]);

  const toggleType = (type: LogType) =>
    setHiddenTypes((previous) => {
      const next = new Set(previous);
      if (!next.delete(type)) next.add(type);
      return next;
    });

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Console</h1>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? 'En direct' : 'Reconnexion...'}
        </Badge>
        <Button
          className="ml-auto"
          variant="outline"
          size="sm"
          disabled={clear.isPending || logs.length === 0}
          onClick={() => clear.mutate()}
        >
          <Trash2 />
          Vider
        </Button>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Types affichés">
        {LOG_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={!hiddenTypes.has(type)}
            onClick={() => toggleType(type)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs',
              hiddenTypes.has(type) ? 'text-muted-foreground opacity-50' : TYPE_COLORS[type],
            )}
          >
            {LOG_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        onScroll={(event) => {
          const list = event.currentTarget;
          stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
        }}
        className="bg-card min-h-64 flex-1 overflow-y-auto rounded-lg border p-3 font-mono text-xs leading-relaxed"
      >
        {visibleLogs.length === 0 ? (
          <p className="text-muted-foreground">Aucun log pour le moment.</p>
        ) : (
          visibleLogs.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <time className="text-muted-foreground shrink-0" dateTime={entry.timestamp}>
                {timeFormat.format(new Date(entry.timestamp))}
              </time>
              <span className={cn('w-20 shrink-0 truncate', TYPE_COLORS[entry.type])}>
                {LOG_TYPE_LABELS[entry.type]}
              </span>
              <span className="break-words whitespace-pre-wrap">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
