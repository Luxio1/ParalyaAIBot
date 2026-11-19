import { bypassUserSchema, TRIGGER_MODE_LABELS, TRIGGER_MODES } from '@bot/shared';
import { useState } from 'react';
import { Choice } from '@/components/Choice';
import { Hint, SaveBar, Section, useConfigForm } from '@/components/ConfigForm';
import { DiscoveryPicker, RemovableBadge } from '@/components/DiscoveryPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** Quand, où et à quelle fréquence le bot répond sur les serveurs. */
export function RepliesPage() {
  const form = useConfigForm();
  if (!form) return null;
  const { draft, set } = form;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Réponses</h1>

      <Section
        title="Déclenchement"
        description="Quand le bot répond sur un serveur."
        scope="profile"
      >
        <Choice
          label="Mode de déclenchement"
          value={draft.triggerMode}
          options={TRIGGER_MODES.map((mode) => ({ value: mode, label: TRIGGER_MODE_LABELS[mode] }))}
          onChange={(triggerMode) => set({ triggerMode })}
        />
        <div className="grid gap-2">
          <Label htmlFor="prefix">Préfixe (aussi celui des commandes)</Label>
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

      <Section title="Salons" description="Où le bot répond sur un serveur." scope="profile">
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

      <Section
        title="Limitation de fréquence"
        description="Empêche une personne de monopoliser le bot ou d'épuiser le quota Gemini, sur les serveurs comme en MP."
        scope="shared"
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
            <div className="flex items-center gap-3">
              <Switch
                id="bypassOwners"
                checked={draft.bypassOwners}
                onCheckedChange={(bypassOwners) => set({ bypassOwners })}
              />
              <Label htmlFor="bypassOwners">Exempter les propriétaires de serveur</Label>
            </div>
            <div className="grid gap-2">
              <Label>Rôles exemptés</Label>
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

      <SaveBar form={form} />
    </div>
  );
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
