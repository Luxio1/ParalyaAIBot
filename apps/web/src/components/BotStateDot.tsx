import { BOT_STATE_LABELS, type BotState } from '@bot/shared';
import { cn } from '@/lib/utils';

const DOT_COLORS: Record<BotState, string> = {
  offline: 'bg-muted-foreground',
  connecting: 'bg-amber-400 animate-pulse',
  online: 'bg-emerald-400',
  error: 'bg-red-400',
};

export function BotStateDot({ state, className }: { state: BotState; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', DOT_COLORS[state], className)}
      title={BOT_STATE_LABELS[state]}
      aria-label={BOT_STATE_LABELS[state]}
      role="img"
    />
  );
}
