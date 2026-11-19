import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmButton, IconButton } from '@/components/FormControls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiSend, profilesQuery } from '@/lib/api';
import { cn } from '@/lib/utils';

type Request = { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown };

function useProfiles() {
  const queryClient = useQueryClient();
  const profiles = useQuery(profilesQuery).data;
  const mutation = useMutation({
    mutationFn: ({ method, path, body }: Request) => apiSend(method, path, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profilesQuery.queryKey }),
    onError: (error) => toast.error(error.message),
  });
  const activate = (id: number, name: string) =>
    mutation.mutate(
      { method: 'POST', path: `/api/profiles/${id}/activate` },
      {
        onSuccess: () =>
          toast.success(`Profil « ${name} » activé : mémoire des conversations effacée.`),
      },
    );
  return { profiles, mutation, activate };
}

/** Sélecteur compact du profil actif (page Bot). */
export function ProfileSelect() {
  const { profiles, activate } = useProfiles();
  if (!profiles) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Label htmlFor="active-profile">Profil</Label>
      <select
        id="active-profile"
        className="border-input dark:bg-input/30 [&>option]:bg-popover h-8 rounded-md border bg-transparent px-2 text-sm"
        value={profiles.activeId}
        onChange={(event) => {
          const id = Number(event.target.value);
          const name = profiles.profiles.find((profile) => profile.id === id)?.name ?? '';
          activate(id, name);
        }}
      >
        {profiles.profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Gestion des profils de comportement (page Comportement). */
export function ProfileManager() {
  const { profiles, mutation, activate } = useProfiles();
  const [editing, setEditing] = useState<{ mode: 'create' | 'rename'; name: string } | null>(null);
  if (!profiles) return null;
  const active = profiles.profiles.find((profile) => profile.id === profiles.activeId);

  const submit = () => {
    if (!editing?.name.trim()) return;
    const request: Request =
      editing.mode === 'create'
        ? { method: 'POST', path: '/api/profiles', body: { name: editing.name } }
        : {
            method: 'PUT',
            path: `/api/profiles/${profiles.activeId}`,
            body: { name: editing.name },
          };
    mutation.mutate(request, { onSuccess: () => setEditing(null) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil de comportement</CardTitle>
        <CardDescription>
          Le persona, le modèle, le déclenchement, les salons, la mémoire et les commandes et règles
          actives dépendent du profil. Changer de profil s'applique au message suivant et efface la
          mémoire des conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div
          className="flex flex-wrap items-center gap-2"
          role="radiogroup"
          aria-label="Profil actif"
        >
          {profiles.profiles.map((profile) => {
            const isActive = profile.id === profiles.activeId;
            return (
              <div
                key={profile.id}
                className={cn(
                  'flex items-center rounded-md border',
                  isActive && 'border-primary bg-primary/10',
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={cn(
                    'px-3 py-1.5 text-sm',
                    isActive ? 'font-medium' : 'text-muted-foreground',
                  )}
                  disabled={mutation.isPending}
                  onClick={() => !isActive && activate(profile.id, profile.name)}
                >
                  {profile.name}
                </button>
                {!isActive && (
                  <ConfirmButton
                    label=""
                    confirmLabel="Supprimer ?"
                    icon={<Trash2 />}
                    ariaLabel={`Supprimer le profil ${profile.name}`}
                    onConfirm={() =>
                      mutation.mutateAsync({
                        method: 'DELETE',
                        path: `/api/profiles/${profile.id}`,
                      })
                    }
                  />
                )}
              </div>
            );
          })}
          {!editing && (
            <>
              <IconButton
                label="Renommer le profil actif"
                onClick={() => setEditing({ mode: 'rename', name: active?.name ?? '' })}
              >
                <Pencil />
              </IconButton>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing({ mode: 'create', name: '' })}
              >
                <Plus />
                Nouveau profil
              </Button>
            </>
          )}
        </div>

        {editing && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input
              aria-label={editing.mode === 'create' ? 'Nom du nouveau profil' : 'Nouveau nom'}
              className="h-8 w-56"
              maxLength={50}
              autoFocus
              placeholder={editing.mode === 'create' ? 'Animation, Soirée jeux...' : undefined}
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
            <Button type="submit" size="sm" disabled={!editing.name.trim() || mutation.isPending}>
              <Check />
              {editing.mode === 'create' ? `Créer (copie de « ${active?.name} »)` : 'Renommer'}
            </Button>
            <IconButton label="Annuler" onClick={() => setEditing(null)}>
              <X />
            </IconButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

/** Rappel, sur les pages Commandes et Événements, que les interrupteurs suivent le profil actif. */
export function ActiveProfileHint() {
  const profiles = useQuery(profilesQuery).data;
  const active = profiles?.profiles.find((profile) => profile.id === profiles.activeId);
  if (!active || (profiles?.profiles.length ?? 0) < 2) return null;
  return (
    <p className="text-muted-foreground text-xs">
      Les interrupteurs s'appliquent au profil actif « {active.name} ».
    </p>
  );
}
