import { aiModelSchema } from '@bot/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Label } from '@/components/ui/label';
import { apiGet } from '@/lib/api';

/** Modèles Gemini disponibles avec la clé enregistrée ; le modèle courant reste choisi s'il n'y figure pas. */
export function ModelSelect(props: {
  id: string;
  label: string;
  value: string;
  onChange: (model: string) => void;
}) {
  const models = useQuery({
    queryKey: ['ai', 'models'],
    queryFn: () => apiGet('/api/ai/models', aiModelSchema.array()),
    staleTime: 5 * 60_000,
  });
  const options = models.data ?? [];
  const listed = options.some((model) => model.id === props.value);

  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <select
        id={props.id}
        className="border-input dark:bg-input/30 [&>option]:bg-popover h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {!listed && <option value={props.value}>{props.value}</option>}
        {options.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label} ({model.id})
          </option>
        ))}
      </select>
      {models.isError ? (
        <p className="text-destructive text-xs">
          {models.error.message}{' '}
          <Link to="/parametres" className="underline">
            Ouvrir Paramètres
          </Link>
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Les modèles « Flash-Lite » sont les plus rapides et les moins chers.
        </p>
      )}
    </div>
  );
}
