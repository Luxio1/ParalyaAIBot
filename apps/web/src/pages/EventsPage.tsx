import {
  EVENT_TEXT_MAX_LENGTH,
  MAX_ROLE_DM_RECIPIENTS,
  eventTestResultSchema,
  type BotConfig,
  type EventRule,
  type EventRuleInput,
  type EventTestResult,
} from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FlaskConical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Choice } from '@/components/Choice';
import { DiscoveryPicker, DiscoverySelect } from '@/components/DiscoveryPicker';
import { ConfirmButton, Field, IconButton } from '@/components/FormControls';
import { ModelSelect } from '@/components/ModelSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiPost, apiSend, configQuery, eventRulesQuery } from '@/lib/api';

const VARIABLES_HINT =
  "Variables : {user} (@nom), {pseudo}, {userId}, {channel}, {message}, {reason} (justification de l'IA).";

const EMPTY_RULE: EventRuleInput = {
  name: '',
  description: '',
  enabled: true,
  triggerPrompt: '',
  channelMode: 'all',
  channelIds: [],
  cooldownSeconds: 60,
  dm: { enabled: false, target: 'author', targetId: null, mode: 'custom', text: '' },
  channel: {
    enabled: true,
    target: 'specific',
    channelId: null,
    mode: 'custom',
    text: '',
    mentionRoleId: null,
  },
};

type Editing = { id?: number; input: EventRuleInput };

export function EventsPage() {
  const queryClient = useQueryClient();
  const rules = useQuery(eventRulesQuery);
  const config = useQuery(configQuery).data;
  const [editing, setEditing] = useState<Editing | null>(null);

  const mutate = useMutation({
    mutationFn: (request: { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }) =>
      apiSend(request.method, request.path, request.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventRulesQuery.queryKey }),
    onError: (error) => toast.error(error.message),
  });
  const run = (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    mutate.mutateAsync({ method, path, body });

  const save = async ({ id, input }: Editing) => {
    await run(id ? 'PUT' : 'POST', id ? `/api/events/rules/${id}` : '/api/events/rules', input);
    toast.success(`Règle « ${input.name} » enregistrée.`);
    setEditing(null);
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Événements</h1>
        <ConfirmButton
          label="Restaurer les exemples"
          confirmLabel="Remettre les 4 exemples à zéro ?"
          icon={<RotateCcw />}
          onConfirm={() =>
            run('POST', '/api/events/rules/restore-examples').then(() =>
              toast.success("Règles d'exemple restaurées, désactivées."),
            )
          }
        />
        <Button size="sm" onClick={() => setEditing({ input: EMPTY_RULE })}>
          <Plus />
          Nouvelle règle
        </Button>
      </header>
      <p className="text-muted-foreground text-sm">
        L'IA lit les messages des serveurs, même sans être mentionnée, et déclenche des actions
        quand une règle correspond. Un seul appel à l'IA par message, et seulement si une règle
        active est concernée.
      </p>

      {config && !config.eventsEnabled && rules.data?.some((rule) => rule.enabled) && (
        <p className="rounded-md border border-amber-300/40 px-3 py-2 text-sm text-amber-300">
          Le moteur est désactivé : aucune règle ne s'applique. Activez « Analyser les messages des
          serveurs » ci-dessous, puis cliquez sur Enregistrer dans la carte Moteur.
        </p>
      )}

      {config && <EngineSettings key={JSON.stringify(config)} config={config} />}

      {editing && (
        <RuleEditor
          key={editing.id ?? 'new'}
          editing={editing}
          membersIntent={config?.membersIntent ?? false}
          saving={mutate.isPending}
          onSave={(input) => void save({ ...editing, input }).catch(() => undefined)}
          onCancel={() => setEditing(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Règles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {rules.isError && <p className="text-destructive text-sm">{rules.error.message}</p>}
          {rules.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucune règle.</p>
          )}
          {rules.data?.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onToggle={(enabled) =>
                void run('PUT', `/api/events/rules/${rule.id}`, { ...rule, enabled }).catch(
                  () => undefined,
                )
              }
              onEdit={() => setEditing({ id: rule.id, input: rule })}
              onDuplicate={() => void run('POST', `/api/events/rules/${rule.id}/duplicate`)}
              onDelete={() => run('DELETE', `/api/events/rules/${rule.id}`)}
            />
          ))}
        </CardContent>
      </Card>

      <Tester />
    </div>
  );
}

function EngineSettings({ config }: { config: BotConfig }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(config);
  const set = (changes: Partial<BotConfig>) => setDraft((current) => ({ ...current, ...changes }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(config);
  const save = useMutation({
    mutationFn: () => apiSend('PUT', '/api/config', draft),
    onSuccess: () => {
      toast.success('Réglages du moteur enregistrés.');
      queryClient.setQueryData(configQuery.queryKey, draft);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moteur</CardTitle>
        <CardDescription>Désactivé, aucun message n'est analysé.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-3">
          <Switch
            id="eventsEnabled"
            checked={draft.eventsEnabled}
            onCheckedChange={(eventsEnabled) => set({ eventsEnabled })}
          />
          <Label htmlFor="eventsEnabled">Analyser les messages des serveurs</Label>
        </div>
        <ModelSelect
          id="eventsModel"
          label="Modèle d'analyse"
          value={draft.eventsModel}
          onChange={(eventsModel) => set({ eventsModel })}
        />
        <Field
          label="Analyses par minute au maximum"
          htmlFor="eventsMaxPerMinute"
          hint="Au-delà, les messages ne sont plus analysés jusqu'à la minute suivante : le coût reste borné."
        >
          <Input
            id="eventsMaxPerMinute"
            type="number"
            className="w-28"
            min={1}
            max={600}
            value={draft.eventsMaxPerMinute}
            onChange={(event) => set({ eventsMaxPerMinute: Number(event.target.value) })}
          />
        </Field>
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <Switch
              id="membersIntent"
              checked={draft.membersIntent}
              onCheckedChange={(membersIntent) => set({ membersIntent })}
            />
            <Label htmlFor="membersIntent">Accès à la liste des membres</Label>
          </div>
          <p className="text-muted-foreground text-xs">
            Nécessaire pour écrire aux membres d'un rôle. Activez aussi « Server Members Intent »
            dans le Developer Portal (onglet Bot) ; le bot se reconnecte à l'enregistrement.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!dirty} onClick={() => setDraft(config)}>
            Annuler
          </Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleRow(props: {
  rule: EventRule;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const { rule } = props;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
      <Switch
        checked={rule.enabled}
        onCheckedChange={props.onToggle}
        aria-label={`Activer ${rule.name}`}
      />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{rule.name}</span>
          {rule.dm.enabled && <Badge variant="secondary">MP</Badge>}
          {rule.channel.enabled && <Badge variant="secondary">Salon</Badge>}
        </span>
        {rule.description && (
          <span className="text-muted-foreground truncate text-xs">{rule.description}</span>
        )}
      </div>
      <div className="flex gap-1">
        <IconButton label="Modifier" onClick={props.onEdit}>
          <Pencil />
        </IconButton>
        <IconButton label="Dupliquer" onClick={props.onDuplicate}>
          <Copy />
        </IconButton>
        <ConfirmButton
          label=""
          confirmLabel="Supprimer ?"
          icon={<Trash2 />}
          ariaLabel={`Supprimer ${rule.name}`}
          onConfirm={props.onDelete}
        />
      </div>
    </div>
  );
}

function RuleEditor(props: {
  editing: Editing;
  membersIntent: boolean;
  saving: boolean;
  onSave: (input: EventRuleInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState(props.editing.input);
  const set = (changes: Partial<EventRuleInput>) =>
    setInput((current) => ({ ...current, ...changes }));
  const setDm = (changes: Partial<EventRuleInput['dm']>) =>
    setInput((current) => ({ ...current, dm: { ...current.dm, ...changes } }));
  const setAlert = (changes: Partial<EventRuleInput['channel']>) =>
    setInput((current) => ({ ...current, channel: { ...current.channel, ...changes } }));
  const { dm, channel } = input;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.editing.id ? 'Modifier la règle' : 'Nouvelle règle'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSave(input);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" htmlFor="rule-name">
              <Input
                id="rule-name"
                maxLength={100}
                required
                value={input.name}
                onChange={(event) => set({ name: event.target.value })}
              />
            </Field>
            <Field label="Description" htmlFor="rule-description">
              <Input
                id="rule-description"
                maxLength={300}
                value={input.description}
                onChange={(event) => set({ description: event.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Critère de déclenchement"
            htmlFor="rule-trigger"
            hint="Décrivez la situation en langage courant. L'IA est stricte : en cas de doute, la règle ne se déclenche pas."
          >
            <Textarea
              id="rule-trigger"
              maxLength={1000}
              placeholder="Quand quelqu'un insulte ou menace un autre membre."
              value={input.triggerPrompt}
              onChange={(event) => set({ triggerPrompt: event.target.value })}
            />
          </Field>

          <div className="grid gap-2">
            <Label>Salons surveillés</Label>
            <Choice
              label="Salons surveillés"
              value={input.channelMode}
              options={[
                { value: 'all', label: 'Tous les salons' },
                { value: 'specific', label: 'Salons choisis' },
              ]}
              onChange={(channelMode) => set({ channelMode })}
            />
            {input.channelMode === 'specific' && (
              <DiscoveryPicker
                kind="channel"
                selected={input.channelIds}
                onChange={(channelIds) => set({ channelIds })}
              />
            )}
          </div>

          <Field
            label="Délai entre deux déclenchements pour une même personne (secondes)"
            htmlFor="rule-cooldown"
          >
            <Input
              id="rule-cooldown"
              type="number"
              className="w-32"
              min={0}
              max={86_400}
              value={input.cooldownSeconds}
              onChange={(event) => set({ cooldownSeconds: Number(event.target.value) })}
            />
          </Field>

          <ActionBox
            title="Envoyer un MP"
            id="rule-dm"
            enabled={dm.enabled}
            onEnabledChange={(enabled) => setDm({ enabled })}
          >
            <Choice
              label="Destinataire du MP"
              value={dm.target}
              options={[
                { value: 'author', label: "L'auteur du message" },
                { value: 'user', label: 'Un utilisateur' },
                { value: 'role', label: "Les membres d'un rôle" },
              ]}
              onChange={(target) => setDm({ target, targetId: null })}
            />
            {dm.target === 'user' && (
              <Field label="ID de l'utilisateur" htmlFor="rule-dm-user">
                <Input
                  id="rule-dm-user"
                  inputMode="numeric"
                  placeholder="Clic droit sur le membre, « Copier l'identifiant »"
                  value={dm.targetId ?? ''}
                  onChange={(event) => setDm({ targetId: event.target.value.trim() || null })}
                />
              </Field>
            )}
            {dm.target === 'role' && (
              <>
                <DiscoverySelect
                  kind="role"
                  id="rule-dm-role"
                  emptyLabel="Choisir un rôle"
                  value={dm.targetId}
                  onChange={(targetId) => setDm({ targetId })}
                />
                <p
                  className={
                    props.membersIntent ? 'text-muted-foreground text-xs' : 'text-xs text-amber-300'
                  }
                >
                  {props.membersIntent
                    ? `Au plus ${MAX_ROLE_DM_RECIPIENTS} membres contactés par alerte.`
                    : 'Activez « Accès à la liste des membres » dans les réglages du moteur, sinon ce MP ne partira pas.'}
                </p>
              </>
            )}
            <ActionText
              id="rule-dm-text"
              mode={dm.mode}
              text={dm.text}
              onChange={(changes) => setDm(changes)}
            />
          </ActionBox>

          <ActionBox
            title="Envoyer un message dans un salon"
            id="rule-channel"
            enabled={channel.enabled}
            onEnabledChange={(enabled) => setAlert({ enabled })}
          >
            <Choice
              label="Salon de destination"
              value={channel.target}
              options={[
                { value: 'specific', label: 'Un salon dédié' },
                { value: 'source', label: "Le salon d'origine" },
              ]}
              onChange={(target) => setAlert({ target })}
            />
            {channel.target === 'specific' ? (
              <DiscoverySelect
                kind="channel"
                id="rule-channel-target"
                emptyLabel="Choisir le salon d'alerte"
                value={channel.channelId}
                onChange={(channelId) => setAlert({ channelId })}
              />
            ) : (
              <p className="text-muted-foreground text-xs">
                Sauté si le bot répond déjà à ce message, pour ne pas répondre deux fois.
              </p>
            )}
            <Field
              label="Rôle à mentionner (facultatif)"
              htmlFor="rule-mention"
              hint="Seul ce rôle est notifié. S'il n'est pas « mentionnable » dans Discord, le bot doit avoir la permission de mentionner tous les rôles."
            >
              <DiscoverySelect
                kind="role"
                id="rule-mention"
                emptyLabel="Aucune mention"
                value={channel.mentionRoleId}
                onChange={(mentionRoleId) => setAlert({ mentionRoleId })}
              />
            </Field>
            <ActionText
              id="rule-channel-text"
              mode={channel.mode}
              text={channel.text}
              onChange={(changes) => setAlert(changes)}
            />
          </ActionBox>

          <div className="flex items-center gap-3">
            <Switch
              id="rule-enabled"
              checked={input.enabled}
              onCheckedChange={(enabled) => set({ enabled })}
            />
            <Label htmlFor="rule-enabled">Active</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={props.onCancel}>
              Annuler
            </Button>
            <Button type="submit" disabled={props.saving}>
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ActionBox(props: {
  title: string;
  id: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-3 rounded-md border p-3">
      <div className="flex items-center gap-3">
        <Switch id={props.id} checked={props.enabled} onCheckedChange={props.onEnabledChange} />
        <Label htmlFor={props.id} className="font-medium">
          {props.title}
        </Label>
      </div>
      {props.enabled && props.children}
    </fieldset>
  );
}

function ActionText(props: {
  id: string;
  mode: 'custom' | 'ai';
  text: string;
  onChange: (changes: { mode?: 'custom' | 'ai'; text?: string }) => void;
}) {
  return (
    <div className="grid gap-2">
      <Choice
        label="Contenu du message"
        value={props.mode}
        options={[
          { value: 'custom', label: "Texte écrit à l'avance" },
          { value: 'ai', label: "Rédigé par l'IA" },
        ]}
        onChange={(mode) => props.onChange({ mode })}
      />
      <Textarea
        id={props.id}
        aria-label={props.mode === 'ai' ? "Consigne pour l'IA" : 'Texte du message'}
        maxLength={EVENT_TEXT_MAX_LENGTH}
        placeholder={
          props.mode === 'ai'
            ? "Consigne, par exemple : rédige une alerte factuelle pour l'équipe."
            : 'Texte, par exemple : Bonjour {pseudo}, merci de rester courtois.'
        }
        value={props.text}
        onChange={(event) => props.onChange({ text: event.target.value })}
      />
      <p className="text-muted-foreground text-xs">
        {props.mode === 'ai'
          ? "L'IA reçoit le message, la règle et sa justification. Un appel à l'IA de plus, seulement quand la règle se déclenche."
          : VARIABLES_HINT}
      </p>
    </div>
  );
}

function Tester() {
  const [message, setMessage] = useState('');
  const test = useMutation({
    mutationFn: () => apiPost('/api/events/test', { message }, eventTestResultSchema.array()),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testeur</CardTitle>
        <CardDescription>
          Toutes les règles, actives ou non, sans filtre de salon ni délai. Rien n'est envoyé.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Textarea
          aria-label="Message à tester"
          placeholder="Écrivez un message fictif, par exemple : vous êtes tous des nuls"
          maxLength={2000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <Button
          className="justify-self-start"
          disabled={!message.trim() || test.isPending}
          onClick={() => test.mutate()}
        >
          <FlaskConical />
          {test.isPending ? 'Analyse...' : 'Tester'}
        </Button>
        {test.data?.map((result) => (
          <TestResult key={result.ruleId} result={result} />
        ))}
      </CardContent>
    </Card>
  );
}

function TestResult({ result }: { result: EventTestResult }) {
  return (
    <div className="grid gap-1 rounded-md border px-3 py-2 text-sm">
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant={result.matched ? 'default' : 'outline'}>
          {result.matched ? 'Déclenchée' : 'Non déclenchée'}
        </Badge>
        <span className="font-medium">{result.name}</span>
        {!result.enabled && <span className="text-muted-foreground text-xs">(désactivée)</span>}
      </span>
      <span className="text-muted-foreground">{result.reason}</span>
      {result.matched && result.dmPreview && <Preview label="MP" text={result.dmPreview} />}
      {result.matched && result.channelPreview && (
        <Preview label="Salon" text={result.channelPreview} />
      )}
    </div>
  );
}

function Preview({ label, text }: { label: string; text: string }) {
  return (
    <p className="bg-muted/40 rounded px-2 py-1 text-xs whitespace-pre-wrap">
      <span className="font-medium">{label} : </span>
      {text}
    </p>
  );
}
