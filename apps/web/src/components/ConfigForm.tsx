import type { BotConfig } from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiSend, configQuery, profilesQuery } from '@/lib/api';

export interface ConfigForm {
  /** Réglages enregistrés, modifications en cours appliquées. */
  draft: BotConfig;
  set: (changes: Partial<BotConfig>) => void;
  dirty: boolean;
  saving: boolean;
  save: () => void;
  reset: () => void;
}

/**
 * Formulaire sur une partie des réglages : seules les modifications de la page sont gardées, le
 * reste suit les réglages enregistrés. Elles sont abandonnées si le profil actif change.
 */
export function useConfigForm(): ConfigForm | null {
  const queryClient = useQueryClient();
  const saved = useQuery(configQuery).data;
  const activeProfile = useQuery(profilesQuery).data?.activeId;
  const [changes, setChanges] = useState<Partial<BotConfig>>({});
  useEffect(() => setChanges({}), [activeProfile]);

  const draft = saved && { ...saved, ...changes };
  const save = useMutation({
    mutationFn: (config: BotConfig) => apiSend('PUT', '/api/config', config),
    onSuccess: (_result, config) => {
      queryClient.setQueryData(configQuery.queryKey, config);
      setChanges({});
      toast.success("Réglages enregistrés : ils s'appliquent dès le prochain message.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (!saved || !draft) return null;

  return {
    draft,
    set: (next) => setChanges((current) => ({ ...current, ...next })),
    dirty: JSON.stringify(draft) !== JSON.stringify(saved),
    saving: save.isPending,
    save: () => save.mutate(draft),
    reset: () => setChanges({}),
  };
}

/** Barre collée en bas de page, visible seulement quand il y a des modifications à enregistrer. */
export function SaveBar({ form }: { form: ConfigForm }) {
  if (!form.dirty) return null;
  return (
    <div className="bg-background/90 sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <span className="text-muted-foreground mr-auto text-sm">Modifications non enregistrées</span>
      <Button variant="outline" disabled={form.saving} onClick={form.reset}>
        Annuler
      </Button>
      <Button disabled={form.saving} onClick={form.save}>
        Enregistrer
      </Button>
    </div>
  );
}

/**
 * Bloc de réglages ; `scope` indique s'ils dépendent du profil actif ou sont communs à tous les
 * profils.
 */
export function Section(props: {
  title: string;
  description?: string;
  scope?: 'profile' | 'shared';
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{props.title}</CardTitle>
          {props.scope && <ScopeBadge scope={props.scope} />}
        </div>
        {props.description && <CardDescription>{props.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4">{props.children}</CardContent>
    </Card>
  );
}

function ScopeBadge({ scope }: { scope: 'profile' | 'shared' }) {
  const profiles = useQuery(profilesQuery).data;
  if (scope === 'shared') return <Badge variant="outline">Tous les profils</Badge>;
  const active = profiles?.profiles.find((profile) => profile.id === profiles.activeId);
  return <Badge variant="secondary">Profil « {active?.name ?? '...'} »</Badge>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}
