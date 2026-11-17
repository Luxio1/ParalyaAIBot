import { discordIdSchema, type DiscoveredGuild } from '@bot/shared';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRealtime } from '@/hooks/useRealtime';
import { botDiscoveryQuery } from '@/lib/api';

type Kind = 'channel' | 'role';

interface Item {
  id: string;
  name: string;
  color?: string | null;
}

const WORDING: Record<Kind, { sign: string; plural: string; placeholder: string }> = {
  channel: { sign: '#', plural: 'salons', placeholder: 'ID ou nom du salon' },
  role: { sign: '@', plural: 'rôles', placeholder: 'ID ou nom du rôle' },
};

function itemsOf(guild: DiscoveredGuild, kind: Kind): Item[] {
  return kind === 'channel' ? guild.channels : guild.roles;
}

/** Serveurs et salons ou rôles vus par le bot ; vide tant qu'il n'est pas en ligne. */
export function useDiscoveredGuilds(): { guilds: DiscoveredGuild[]; online: boolean } {
  const online = useRealtime().bot?.state === 'online';
  const guilds = useQuery({ ...botDiscoveryQuery, enabled: online }).data ?? [];
  return { guilds, online };
}

/** Sélection multiple de salons ou de rôles : cases à cocher par serveur, ou ajout par ID ou nom. */
export function DiscoveryPicker(props: {
  kind: Kind;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { guilds, online } = useDiscoveredGuilds();
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wording = WORDING[props.kind];

  const known = new Set(
    guilds.flatMap((guild) => itemsOf(guild, props.kind).map((item) => item.id)),
  );
  const unknown = props.selected.filter((id) => !known.has(id));
  const toggle = (id: string, checked: boolean) =>
    props.onChange(checked ? [...props.selected, id] : props.selected.filter((s) => s !== id));

  const addManual = () => {
    const result = resolve(manual, guilds, props.kind);
    setError(result.error ?? null);
    if (!result.id) return;
    if (!props.selected.includes(result.id)) props.onChange([...props.selected, result.id]);
    setManual('');
  };

  return (
    <div className="grid gap-4">
      {!online && (
        <p className="text-muted-foreground text-xs">
          Démarrez le bot pour choisir parmi ses {wording.plural}, ou ajoutez-les par leur ID.
        </p>
      )}
      {guilds.map((guild) => (
        <fieldset key={guild.id} className="grid gap-1">
          <legend className="mb-1 text-sm font-medium">{guild.name}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {itemsOf(guild, props.kind).map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={props.selected.includes(item.id)}
                  onChange={(event) => toggle(item.id, event.target.checked)}
                />
                <span style={item.color ? { color: item.color } : undefined}>
                  {wording.sign}
                  {item.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {unknown.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground text-xs">
            {online ? `${capitalize(wording.plural)} introuvables :` : 'Sélectionnés :'}
          </span>
          {unknown.map((id) => (
            <RemovableBadge key={id} label={id} onRemove={() => toggle(id, false)} />
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addManual();
        }}
      >
        <Input
          aria-label={`Ajouter par ${wording.placeholder}`}
          placeholder={wording.placeholder}
          value={manual}
          onChange={(event) => setManual(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!manual.trim()}>
          Ajouter
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

/** Choix d'un seul salon, parmi ceux que voit le bot. */
export function ChannelSelect(props: {
  id: string;
  value: string | null;
  onChange: (channelId: string | null) => void;
}) {
  const { guilds } = useDiscoveredGuilds();
  const listed = guilds.some((guild) => guild.channels.some((c) => c.id === props.value));
  return (
    <select
      id={props.id}
      className="border-input dark:bg-input/30 [&_option]:bg-popover h-9 w-full rounded-md border bg-transparent px-3 text-sm"
      value={props.value ?? ''}
      onChange={(event) => props.onChange(event.target.value || null)}
    >
      <option value="">Choisir un salon</option>
      {props.value && !listed && <option value={props.value}>Salon {props.value}</option>}
      {guilds.map((guild) => (
        <optgroup key={guild.id} label={guild.name}>
          {guild.channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              #{channel.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function RemovableBadge(props: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="outline" className="font-mono">
      {props.label}
      <button type="button" aria-label={`Retirer ${props.label}`} onClick={props.onRemove}>
        <X />
      </button>
    </Badge>
  );
}

function resolve(
  input: string,
  guilds: DiscoveredGuild[],
  kind: Kind,
): { id?: string; error?: string } {
  const { sign, plural } = WORDING[kind];
  const value = input.trim().replace(new RegExp(`^${sign}`), '');
  if (discordIdSchema.safeParse(value).success) return { id: value };
  const matches = guilds.flatMap((guild) =>
    itemsOf(guild, kind).filter((item) => item.name.toLowerCase() === value.toLowerCase()),
  );
  if (matches.length === 1) return { id: matches[0]?.id };
  if (matches.length > 1) {
    return { error: `Plusieurs ${plural} s'appellent « ${value} » : cochez le bon dans la liste.` };
  }
  return { error: `Aucun élément « ${value} » parmi les ${plural} que voit le bot.` };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
