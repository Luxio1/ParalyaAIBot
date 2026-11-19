import { APP_NAME } from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Bot,
  Brain,
  FlaskConical,
  LogOut,
  Mail,
  Radar,
  Settings,
  SlidersHorizontal,
  Sparkles,
  SquareSlash,
  SquareTerminal,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { BotStateDot } from '@/components/BotStateDot';
import { Button } from '@/components/ui/button';
import { useRealtime } from '@/hooks/useRealtime';
import { apiSend, authStateQuery } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Une fonction du bot se règle sur une seule page. */
const NAV_GROUPS = [
  {
    label: 'Bot',
    items: [
      { to: '/bot', label: 'Tableau de bord', icon: Bot },
      { to: '/console', label: 'Console', icon: SquareTerminal },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/personnalite', label: 'Personnalité', icon: Sparkles },
      { to: '/reponses', label: 'Réponses', icon: SlidersHorizontal },
      { to: '/messages-prives', label: 'Messages privés', icon: Mail },
      { to: '/memoire', label: 'Mémoire', icon: Brain },
      { to: '/commandes', label: 'Commandes', icon: SquareSlash },
      { to: '/evenements', label: 'Événements', icon: Radar },
    ],
  },
  {
    label: 'Outils',
    items: [
      { to: '/simulateur', label: 'Simulateur', icon: FlaskConical },
      { to: '/guide', label: 'Guide', icon: BookOpen },
      { to: '/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
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

        <nav className="flex gap-4 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex shrink-0 gap-1 md:flex-col">
              <span className="text-muted-foreground hidden px-3 text-xs font-medium tracking-wide uppercase md:block">
                {group.label}
              </span>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      'text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap',
                      isActive && 'bg-accent text-foreground',
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                  {to === '/bot' && botState && (
                    <BotStateDot state={botState} className="ml-auto" />
                  )}
                </NavLink>
              ))}
            </div>
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
