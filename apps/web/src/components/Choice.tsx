import { cn } from '@/lib/utils';

/** Choix exclusif entre quelques options, affichées côte à côte. */
export function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={props.label}
      className="flex flex-wrap gap-1 rounded-md border p-1"
    >
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === props.value}
          onClick={() => props.onChange(option.value)}
          className={cn(
            'flex-1 rounded px-3 py-1.5 text-sm whitespace-nowrap',
            option.value === props.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
