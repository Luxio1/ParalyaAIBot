import { APP_NAME } from '@bot/shared';
import { useQuery } from '@tanstack/react-query';
import { Bot, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { fetchHealth } from '@/api/health';
import { cn } from '@/lib/utils';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}

export function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 10_000,
  });

  const databaseOk = health.data?.database === 'ok';

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <section className="border-border bg-panel w-full max-w-md rounded-2xl border p-8 shadow-xl">
        <header className="flex items-center gap-3">
          <span className="bg-brand flex size-11 items-center justify-center rounded-xl">
            <Bot className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold">{APP_NAME}</h1>
            <p className="text-sm text-slate-400">Fondations (jalon J0)</p>
          </div>
        </header>

        <ul className="mt-6 space-y-3 text-sm">
          <StatusRow
            label="Serveur"
            state={health.isPending ? 'pending' : health.isSuccess ? 'ok' : 'error'}
            detail={
              health.isPending
                ? 'Connexion…'
                : health.isSuccess
                  ? `En ligne · v${health.data.version} · depuis ${formatUptime(health.data.uptime)}`
                  : 'Injoignable — lancez « pnpm dev »'
            }
          />
          <StatusRow
            label="Base de données"
            state={health.isPending ? 'pending' : databaseOk ? 'ok' : 'error'}
            detail={
              health.isPending ? 'Connexion…' : databaseOk ? 'Opérationnelle' : 'Indisponible'
            }
          />
        </ul>

        <p className="mt-6 text-xs leading-relaxed text-slate-400">
          Le tableau de bord (connexion, configuration du bot, console en direct) arrive au jalon
          J1.
        </p>
      </section>
    </main>
  );
}

type State = 'pending' | 'ok' | 'error';

function StatusRow({ label, state, detail }: { label: string; state: State; detail: string }) {
  const Icon = state === 'pending' ? LoaderCircle : state === 'ok' ? CircleCheck : CircleAlert;
  return (
    <li className="border-border flex items-center gap-3 rounded-lg border bg-black/20 px-4 py-3">
      <Icon
        aria-hidden
        className={cn(
          'size-5 shrink-0',
          state === 'pending' && 'animate-spin text-slate-400',
          state === 'ok' && 'text-emerald-400',
          state === 'error' && 'text-red-400',
        )}
      />
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="truncate text-slate-400">{detail}</p>
      </div>
    </li>
  );
}
