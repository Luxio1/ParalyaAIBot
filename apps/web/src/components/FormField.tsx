import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Champ libellé dont la valeur est lue par `FormData` à l'envoi du formulaire (attribut `name`). */
export function FormField({
  label,
  hint,
  ...inputProps
}: { label: string; hint?: string; name: string } & ComponentProps<typeof Input>) {
  const id = `field-${inputProps.name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required {...inputProps} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
