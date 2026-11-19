import {
  COMMAND_TYPE_LABELS,
  COMMAND_TYPES,
  PROMPT_TEMPLATE_MAX_LENGTH,
  STATIC_RESPONSE_MAX_LENGTH,
  type Command,
  type CommandInput,
} from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Choice } from '@/components/Choice';
import { ConfirmButton, Field, IconButton } from '@/components/FormControls';
import { ActiveProfileHint } from '@/components/ProfileSwitcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiSend, commandsQuery, configQuery } from '@/lib/api';

const EMPTY: CommandInput = {
  name: '',
  description: '',
  enabled: true,
  type: 'static',
  response: '',
  promptTemplate: '',
  systemPrompt: '',
};

/** Commande en cours d'édition : `id` absent pour une création. */
type Editing = { id?: number; input: CommandInput };

export function CommandsPage() {
  const queryClient = useQueryClient();
  const commands = useQuery(commandsQuery);
  const config = useQuery(configQuery).data;
  const prefix = config?.prefix ?? '!';
  const [editing, setEditing] = useState<Editing | null>(null);

  const mutate = useMutation({
    mutationFn: (request: { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown }) =>
      apiSend(request.method, request.path, request.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commandsQuery.queryKey }),
    onError: (error) => toast.error(error.message),
  });
  const run = (method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    mutate.mutateAsync({ method, path, body });

  const save = async ({ id, input }: Editing) => {
    await run(id ? 'PUT' : 'POST', id ? `/api/commands/${id}` : '/api/commands', input);
    toast.success(`Commande « ${prefix}${input.name.trim().toLowerCase()} » enregistrée.`);
    setEditing(null);
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Commandes</h1>
        <ConfirmButton
          label="Restaurer les exemples"
          confirmLabel="Remettre les 5 exemples à zéro ?"
          icon={<RotateCcw />}
          onConfirm={() =>
            run('POST', '/api/commands/restore-examples').then(() =>
              toast.success("Commandes d'exemple restaurées."),
            )
          }
        />
        <Button size="sm" onClick={() => setEditing({ input: EMPTY })}>
          <Plus />
          Nouvelle commande
        </Button>
      </header>

      <ActiveProfileHint />

      {config?.triggerMode === 'mention' && (
        <p className="text-sm text-amber-300">
          Le bot est en mode « Mention uniquement » : les commandes, appelées par le préfixe, ne
          fonctionnent pas. Changez de mode dans{' '}
          <Link to="/reponses" className="underline">
            Réponses
          </Link>
          .
        </p>
      )}

      {editing && (
        <CommandEditor
          key={editing.id ?? 'new'}
          editing={editing}
          prefix={prefix}
          saving={mutate.isPending}
          onSave={(input) => void save({ ...editing, input }).catch(() => undefined)}
          onCancel={() => setEditing(null)}
        />
      )}

      <Card>
        <CardContent className="grid gap-2">
          {commands.isError && <p className="text-destructive text-sm">{commands.error.message}</p>}
          {commands.data?.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Aucune commande. Créez-en une ou restaurez les exemples.
            </p>
          )}
          {commands.data?.map((command) => (
            <CommandRow
              key={command.id}
              command={command}
              prefix={prefix}
              onToggle={(enabled) =>
                void run('PUT', `/api/commands/${command.id}`, { ...command, enabled })
              }
              onEdit={() => setEditing({ id: command.id, input: command })}
              onDuplicate={() => void run('POST', `/api/commands/${command.id}/duplicate`)}
              onDelete={() => run('DELETE', `/api/commands/${command.id}`)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CommandRow(props: {
  command: Command;
  prefix: string;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const { command } = props;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
      <Switch
        checked={command.enabled}
        onCheckedChange={props.onToggle}
        aria-label={`Activer ${props.prefix}${command.name}`}
      />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex items-center gap-2">
          <code className="font-medium">
            {props.prefix}
            {command.name}
          </code>
          <Badge variant={command.type === 'ai' ? 'default' : 'secondary'}>
            {COMMAND_TYPE_LABELS[command.type]}
          </Badge>
        </span>
        {command.description && (
          <span className="text-muted-foreground truncate text-xs">{command.description}</span>
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
          ariaLabel={`Supprimer ${props.prefix}${command.name}`}
          onConfirm={props.onDelete}
        />
      </div>
    </div>
  );
}

function CommandEditor(props: {
  editing: Editing;
  prefix: string;
  saving: boolean;
  onSave: (input: CommandInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState(props.editing.input);
  const set = (changes: Partial<CommandInput>) =>
    setInput((current) => ({ ...current, ...changes }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.editing.id ? 'Modifier la commande' : 'Nouvelle commande'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSave(input);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <Field label="Nom" htmlFor="command-name">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground font-mono">{props.prefix}</span>
                <Input
                  id="command-name"
                  className="font-mono"
                  maxLength={32}
                  required
                  value={input.name}
                  onChange={(event) => set({ name: event.target.value })}
                />
              </div>
            </Field>
            <Field label="Description (affichée dans l'aide)" htmlFor="command-description">
              <Input
                id="command-description"
                maxLength={200}
                value={input.description}
                onChange={(event) => set({ description: event.target.value })}
              />
            </Field>
          </div>

          <Choice
            label="Type de commande"
            value={input.type}
            options={COMMAND_TYPES.map((type) => ({
              value: type,
              label: type === 'static' ? 'Statique : texte prédéfini' : 'IA : question à Gemini',
            }))}
            onChange={(type) => set({ type })}
          />

          {input.type === 'static' ? (
            <Field
              label="Réponse"
              htmlFor="command-response"
              hint="Variables : {commands} (liste des commandes actives), {prefix}, {user} (pseudo de l'auteur)."
            >
              <Textarea
                id="command-response"
                className="min-h-32"
                maxLength={STATIC_RESPONSE_MAX_LENGTH}
                value={input.response}
                onChange={(event) => set({ response: event.target.value })}
              />
            </Field>
          ) : (
            <>
              <Field
                label="Modèle de question"
                htmlFor="command-template"
                hint={`{query} reçoit le texte écrit après ${props.prefix}${input.name || 'commande'}. Sans {query}, ce texte est ajouté à la fin.`}
              >
                <Textarea
                  id="command-template"
                  maxLength={PROMPT_TEMPLATE_MAX_LENGTH}
                  value={input.promptTemplate}
                  onChange={(event) => set({ promptTemplate: event.target.value })}
                />
              </Field>
              <Field
                label="Consigne propre à la commande (facultatif)"
                htmlFor="command-system"
                hint="Remplace le persona du bot pour cette commande uniquement."
              >
                <Textarea
                  id="command-system"
                  placeholder="Vide : le persona du bot s'applique."
                  value={input.systemPrompt}
                  onChange={(event) => set({ systemPrompt: event.target.value })}
                />
              </Field>
            </>
          )}

          <div className="flex items-center gap-3">
            <Switch
              id="command-enabled"
              checked={input.enabled}
              onCheckedChange={(enabled) => set({ enabled })}
            />
            <Label htmlFor="command-enabled">Active</Label>
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
