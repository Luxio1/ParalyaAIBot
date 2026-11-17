import { APP_NAME } from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Brain, LogOut, Settings, SlidersHorizontal, SquareTerminal } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { BotStateDot } from '@/components/BotStateDot';
import { Button } from '@/components/ui/button';
import { useRealtime } from '@/hooks/useRealtime';
import { apiSend, authStateQuery } from '@/lib/api';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/bot', label: 'Bot', icon: Bot },
  { to: '/comportement', label: 'Comportement', icon: SlidersHorizontal },
  { to: '/memoire', label: 'Mémoire', icon: Brain },
  { to: '/console', label: 'Console', icon: SquareTerminal },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
];

export function AppLayout() {
  const queryClient = useQueryClient();
  const botState = useRealtime().bot?.state;
  const username = useQuery(authStateQuery).data?.user?.username;
  const logout = useMutation({
    mutationFn: () => apiSend('POST', '/api/auth/logout'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authStateQuery.queryKey }),
  });

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="bg-sidebar flex shrink-0 flex-col gap-4 border-b p-3 md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="bg-primary flex size-8 items-center justify-center rounded-lg">
            <Bot className="size-4" aria-hidden />
          </span>
          <span className="font-semibold">{APP_NAME}</span>
        </div>

        <nav className="flex gap-1 md:flex-col">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  isActive && 'bg-accent text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {to === '/bot' && botState && <BotStateDot state={botState} className="ml-auto" />}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden items-center justify-between gap-2 px-2 md:flex">
          <span className="text-muted-foreground truncate text-sm">{username}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Se déconnecter"
            aria-label="Se déconnecter"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut />
          </Button>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
