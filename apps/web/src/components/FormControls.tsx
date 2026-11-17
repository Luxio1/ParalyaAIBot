import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function Field(props: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.htmlFor}>{props.label}</Label>
      {props.children}
      {props.hint && <p className="text-muted-foreground text-xs">{props.hint}</p>}
    </div>
  );
}

export function IconButton(props: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
}

/** Action destructive en deux clics : le premier demande confirmation pendant 4 s. */
export function ConfirmButton(props: {
  label: string;
  confirmLabel: string;
  icon: ReactNode;
  ariaLabel?: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <Button
      variant={armed ? 'destructive' : props.label ? 'outline' : 'ghost'}
      size={props.label || armed ? 'sm' : 'icon-sm'}
      aria-label={armed ? props.confirmLabel : (props.ariaLabel ?? props.label)}
      title={props.ariaLabel ?? props.label}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        void props.onConfirm().catch(() => undefined);
      }}
    >
      {props.icon}
      {armed ? props.confirmLabel : props.label}
    </Button>
  );
}
