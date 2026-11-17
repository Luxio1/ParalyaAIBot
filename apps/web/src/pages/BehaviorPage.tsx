import {
  aiModelSchema,
  discordIdSchema,
  PERSONA_PRESETS,
  SYSTEM_PROMPT_MAX_LENGTH,
  TRIGGER_MODE_LABELS,
  TRIGGER_MODES,
  type BotConfig,
  type DiscoveredGuild,
} from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Choice } from '@/components/Choice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useRealtime } from '@/hooks/useRealtime';
import { apiGet, apiSend, botDiscoveryQuery, configQuery } from '@/lib/api';
import { cn } from '@/lib/utils';

const RETENTION_CHOICES = [
  [5, '5 minutes'],
  [15, '15 minutes'],
  [30, '30 minutes'],
  [60, '1 heure'],
  [180, '3 heures'],
  [720, '12 heures'],
  [1440, '24 heures'],
] as const;

export function BehaviorPage() {
  const saved = useQuery(configQuery);
  if (saved.isError) return <p className="text-destructive text-sm">{saved.error.message}</p>;
  if (!saved.data) return null;
  // La clé remet le formulaire à zéro quand la version enregistrée change.
  return <BehaviorForm key={JSON.stringify(saved.data)} saved={saved.data} />;
}

function BehaviorForm({ saved }: { saved: BotConfig }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(saved);
  const set = (changes: Partial<BotConfig>) => setDraft((current) => ({ ...current, ...changes }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const save = useMutation({
    mutationFn: () => apiSend('PUT', '/api/config', draft),
    onSuccess: () => {
      toast.success("Réglages enregistrés : ils s'appliquent dès le prochain message.");
      queryClient.setQueryData(configQuery.queryKey, draft);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Comportement</h1>

      <Section title="Déclenchement" description="Quand le bot répond sur un serveur.">
        <Choice
          label="Mode de déclenchement"
          value={draft.triggerMode}
          options={TRIGGER_MODES.map((mode) => ({ value: mode, label: TRIGGER_MODE_LABELS[mode] }))}
          onChange={(triggerMode) => set({ triggerMode })}
        />
        <div className="grid gap-2">
          <Label htmlFor="prefix">Préfixe</Label>
          <Input
            id="prefix"
            className="w-24 font-mono"
            maxLength={5}
            disabled={draft.triggerMode === 'mention'}
            value={draft.prefix}
            onChange={(event) => set({ prefix: event.target.value })}
          />
        </div>
        <Hint>
          Faire « Répondre » sur un message du bot compte comme une mention. Exemple avec le préfixe
          : <code>{draft.prefix}Quelle est la capitale du Japon ?</code>
        </Hint>
      </Section>

      <Section title="Salons" description="Où le bot répond sur un serveur.">
        <Choice
          label="Salons autorisés"
          value={draft.channelMode}
          options={[
            { value: 'all', label: 'Tous les salons' },
            { value: 'whitelist', label: 'Liste blanche' },
          ]}
          onChange={(channelMode) => set({ channelMode })}
        />
        {draft.channelMode === 'whitelist' && (
          <ChannelPicker
            selected={draft.allowedChannelIds}
            onChange={(allowedChannelIds) => set({ allowedChannelIds })}
          />
        )}
      </Section>

      <Section title="Messages privés">
        <div className="flex items-center gap-3">
          <Switch
            id="allowDMs"
            checked={draft.allowDMs}
            onCheckedChange={(allowDMs) => set({ allowDMs })}
          />
          <Label htmlFor="allowDMs">Répondre aux messages privés</Label>
        </div>
        <Hint>En MP, le bot répond à chaque message, sans mention ni préfixe.</Hint>
      </Section>

      <Section
        title="Mémoire"
        description="Le bot se souvient des derniers échanges avec chaque personne."
      >
        <div className="flex items-center gap-3">
          <Switch
            id="memoryEnabled"
            checked={draft.memoryEnabled}
            onCheckedChange={(memoryEnabled) => set({ memoryEnabled })}
          />
          <Label htmlFor="memoryEnabled">Mémoire de conversation</Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="memoryRetention">Oublier après une inactivité de</Label>
            <select
              id="memoryRetention"
              className="border-input dark:bg-input/30 [&>option]:bg-popover h-9 rounded-md border bg-transparent px-3 text-sm"
              disabled={!draft.memoryEnabled}
              value={draft.memoryRetentionMinutes}
              onChange={(event) => set({ memoryRetentionMinutes: Number(event.target.value) })}
            >
              {RETENTION_CHOICES.map(([minutes, label]) => (
                <option key={minutes} value={minutes}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="memoryMaxMessages">Messages conservés (4 à 20)</Label>
            <Input
              id="memoryMaxMessages"
              type="number"
              min={4}
              max={20}
              disabled={!draft.memoryEnabled}
              value={draft.memoryMaxMessages}
              onChange={(event) => set({ memoryMaxMessages: Number(event.target.value) })}
            />
          </div>
        </div>
        <Hint>
          Une conversation par personne en MP, et par personne et salon sur un serveur. La mémoire
          est vidée au redémarrage du serveur.{' '}
          <Link to="/memoire" className="underline">
            Voir les conversations en cours
          </Link>
        </Hint>
      </Section>

      <Section title="Intelligence artificielle">
        <ModelSelect value={draft.model} onChange={(model) => set({ model })} />
        <PersonaEditor
          value={draft.systemPrompt}
          onChange={(systemPrompt) => set({ systemPrompt })}
        />
      </Section>

      <div className="bg-background/90 sticky bottom-0 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Button
          variant="outline"
          disabled={!dirty || save.isPending}
          onClick={() => setDraft(saved)}
        >
          Annuler les modifications
        </Button>
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

function Section(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        {props.description && <CardDescription>{props.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">{props.children}</CardContent>
    </Card>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

function ChannelPicker(props: { selected: string[]; onChange: (ids: string[]) => void }) {
  const online = useRealtime().bot?.state === 'online';
  const guilds = useQuery({ ...botDiscoveryQuery, enabled: online }).data ?? [];
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  const known = new Set(guilds.flatMap((guild) => guild.channels.map((channel) => channel.id)));
  const unknown = props.selected.filter((id) => !known.has(id));
  const toggle = (id: string, checked: boolean) =>
    props.onChange(checked ? [...props.selected, id] : props.selected.filter((s) => s !== id));

  const addManual = () => {
    const result = resolveChannel(manual, guilds);
    setError(result.error ?? null);
    if (result.id && !props.selected.includes(result.id))
      props.onChange([...props.selected, result.id]);
    if (result.id) setManual('');
  };

  return (
    <div className="grid gap-4">
      {!online && (
        <Hint>Démarrez le bot pour choisir parmi ses salons, ou ajoutez-les par leur ID.</Hint>
      )}
      {guilds.map((guild) => (
        <fieldset key={guild.id} className="grid gap-1">
          <legend className="mb-1 text-sm font-medium">{guild.name}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {guild.channels.map((channel) => (
              <label key={channel.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={props.selected.includes(channel.id)}
                  onChange={(event) => toggle(channel.id, event.target.checked)}
                />
                #{channel.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {unknown.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground text-xs">
            {online ? 'Salons introuvables :' : 'Salons sélectionnés :'}
          </span>
          {unknown.map((id) => (
            <Badge key={id} variant="outline" className="font-mono">
              {id}
              <button type="button" aria-label={`Retirer ${id}`} onClick={() => toggle(id, false)}>
                <X />
              </button>
            </Badge>
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
          aria-label="Ajouter un salon par ID ou par nom"
          placeholder="ID ou nom du salon"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!manual.trim()}>
          Ajouter
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {props.selected.length === 0 && (
        <p className="text-sm text-amber-300">
          Aucun salon sélectionné : le bot ne répondra sur aucun serveur.
        </p>
      )}
    </div>
  );
}

function resolveChannel(input: string, guilds: DiscoveredGuild[]): { id?: string; error?: string } {
  const value = input.trim().replace(/^#/, '');
  if (discordIdSchema.safeParse(value).success) return { id: value };
  const matches = guilds.flatMap((guild) =>
    guild.channels.filter((channel) => channel.name.toLowerCase() === value.toLowerCase()),
  );
  if (matches.length === 1) return { id: matches[0]?.id };
  if (matches.length > 1) {
    return { error: `Plusieurs salons s'appellent « ${value} » : cochez le bon dans la liste.` };
  }
  return { error: `Aucun salon « ${value} » parmi ceux que voit le bot.` };
}

function ModelSelect(props: { value: string; onChange: (model: string) => void }) {
  const models = useQuery({
    queryKey: ['ai', 'models'],
    queryFn: () => apiGet('/api/ai/models', aiModelSchema.array()),
    staleTime: 5 * 60_000,
  });
  const options = models.data ?? [];
  const listed = options.some((model) => model.id === props.value);

  return (
    <div className="grid gap-2">
      <Label htmlFor="model">Modèle</Label>
      <select
        id="model"
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
        <Hint>Les modèles « Flash-Lite » sont les plus rapides et les moins chers.</Hint>
      )}
    </div>
  );
}

function PersonaEditor(props: { value: string; onChange: (prompt: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="persona">Persona</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {PERSONA_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => props.onChange(preset.prompt)}
            className={cn(
              'hover:bg-accent rounded-md border p-2 text-left',
              props.value === preset.prompt && 'border-primary bg-accent',
            )}
          >
            <span className="block text-sm font-medium">{preset.name}</span>
            <span className="text-muted-foreground text-xs">{preset.description}</span>
          </button>
        ))}
      </div>
      <Textarea
        id="persona"
        className="min-h-40"
        maxLength={SYSTEM_PROMPT_MAX_LENGTH}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <Hint>
        {props.value.length} / {SYSTEM_PROMPT_MAX_LENGTH} caractères. Décrit la personnalité et le
        ton du bot.
      </Hint>
    </div>
  );
}
