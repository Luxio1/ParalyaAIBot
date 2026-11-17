import {
  bypassUserSchema,
  PERSONA_PRESETS,
  SYSTEM_PROMPT_MAX_LENGTH,
  TRIGGER_MODE_LABELS,
  TRIGGER_MODES,
  type BotConfig,
} from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Choice } from '@/components/Choice';
import { ModelSelect } from '@/components/ModelSelect';
import { DiscoverySelect, DiscoveryPicker, RemovableBadge } from '@/components/DiscoveryPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiSend, configQuery } from '@/lib/api';
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
          <>
            <DiscoveryPicker
              kind="channel"
              selected={draft.allowedChannelIds}
              onChange={(allowedChannelIds) => set({ allowedChannelIds })}
            />
            {draft.allowedChannelIds.length === 0 && (
              <p className="text-sm text-amber-300">
                Aucun salon sélectionné : le bot ne répondra sur aucun serveur.
              </p>
            )}
          </>
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

      <Section
        title="Limitation de fréquence"
        description="Empêche une personne de monopoliser le bot ou d'épuiser le quota Gemini."
      >
        <div className="flex items-center gap-3">
          <Switch
            id="rateLimitEnabled"
            checked={draft.rateLimitEnabled}
            onCheckedChange={(rateLimitEnabled) => set({ rateLimitEnabled })}
          />
          <Label htmlFor="rateLimitEnabled">Limiter le nombre de questions par personne</Label>
        </div>
        {draft.rateLimitEnabled && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Input
                aria-label="Questions autorisées"
                type="number"
                className="w-20"
                min={1}
                max={50}
                value={draft.rateLimitMaxRequests}
                onChange={(event) => set({ rateLimitMaxRequests: Number(event.target.value) })}
              />
              question(s) au plus par période de
              <Input
                aria-label="Durée de la période en secondes"
                type="number"
                className="w-24"
                min={5}
                max={3600}
                value={draft.rateLimitWindowSeconds}
                onChange={(event) => set({ rateLimitWindowSeconds: Number(event.target.value) })}
              />
              secondes.
            </div>
            <Choice
              label="Au-delà du quota"
              value={draft.rateLimitNotify ? 'notify' : 'silent'}
              options={[
                { value: 'notify', label: 'Prévenir une fois (temps restant)' },
                { value: 'silent', label: 'Ignorer en silence' },
              ]}
              onChange={(choice) => set({ rateLimitNotify: choice === 'notify' })}
            />
            <div className="grid gap-2">
              <Label>Rôles exemptés</Label>
              <Hint>Les propriétaires de serveur sont toujours exemptés.</Hint>
              <DiscoveryPicker
                kind="role"
                selected={draft.bypassRoleIds}
                onChange={(bypassRoleIds) => set({ bypassRoleIds })}
              />
            </div>
            <UserList value={draft.bypassUsers} onChange={(bypassUsers) => set({ bypassUsers })} />
          </>
        )}
      </Section>

      <Section
        title="Retranscription des MP"
        description="Recopie les MP reçus par le bot, et ses réponses, dans un salon du staff."
      >
        <div className="flex items-center gap-3">
          <Switch
            id="dmRelayEnabled"
            checked={draft.dmRelayEnabled}
            onCheckedChange={(dmRelayEnabled) => set({ dmRelayEnabled })}
          />
          <Label htmlFor="dmRelayEnabled">Retranscrire les MP</Label>
        </div>
        {draft.dmRelayEnabled && (
          <div className="grid gap-2">
            <Label htmlFor="dmRelayChannel">Salon de destination</Label>
            <DiscoverySelect
              kind="channel"
              emptyLabel="Choisir un salon"
              id="dmRelayChannel"
              value={draft.dmRelayChannelId}
              onChange={(dmRelayChannelId) => set({ dmRelayChannelId })}
            />
            <Hint>
              Les messages recopiés ne notifient personne. Les membres ne savent pas que leurs MP
              sont lus par le staff : indiquez-le, par exemple dans la description du bot.
            </Hint>
          </div>
        )}
      </Section>

      <Section title="Intelligence artificielle">
        <ModelSelect
          id="model"
          label="Modèle"
          value={draft.model}
          onChange={(model) => set({ model })}
        />
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

function UserList(props: { value: string[]; onChange: (users: string[]) => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const parsed = bypassUserSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Valeur invalide.');
    setError(null);
    setInput('');
    if (!props.value.includes(parsed.data)) props.onChange([...props.value, parsed.data]);
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="bypassUser">Utilisateurs exemptés</Label>
      <Hint>
        Par ID ou nom d'utilisateur Discord (@pseudo unique), jamais par pseudo d'affichage, que
        chacun peut modifier.
      </Hint>
      {props.value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {props.value.map((user) => (
            <RemovableBadge
              key={user}
              label={user}
              onRemove={() => props.onChange(props.value.filter((u) => u !== user))}
            />
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <Input
          id="bypassUser"
          placeholder="ID ou @pseudo"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!input.trim()}>
          Ajouter
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
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
