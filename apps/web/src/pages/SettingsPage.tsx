import {
  PASSWORD_MIN_LENGTH,
  SECRET_LABELS,
  secretStatusSchema,
  type SecretName,
  type SecretStatus,
} from '@bot/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { FormField } from '@/components/FormField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiGet, apiSend } from '@/lib/api';

const SECRETS_QUERY_KEY = ['secrets'];

const SECRET_HELP: Record<SecretName, string> = {
  discordToken:
    'Discord Developer Portal, votre application, onglet Bot, bouton « Reset Token ». Activez aussi « Message Content Intent ».',
  geminiApiKey: 'aistudio.google.com/apikey, bouton « Create API key ».',
};

export function SettingsPage() {
  const secrets = useQuery({
    queryKey: SECRETS_QUERY_KEY,
    queryFn: () => apiGet('/api/secrets', secretStatusSchema.array()),
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="text-xl font-semibold">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle>Accès</CardTitle>
          <CardDescription>
            Stockés chiffrés sur le serveur. Une fois enregistrés, seuls les 4 derniers caractères
            restent visibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {secrets.isError && <p className="text-destructive text-sm">{secrets.error.message}</p>}
          {secrets.data?.map((status) => (
            <SecretField key={status.name} status={status} />
          ))}
        </CardContent>
      </Card>

      <PasswordCard />
    </div>
  );
}

function SecretField({ status }: { status: SecretStatus }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const label = SECRET_LABELS[status.name];
  const onSuccess = (message: string) => {
    setValue('');
    toast.success(message);
    return queryClient.invalidateQueries({ queryKey: SECRETS_QUERY_KEY });
  };
  const save = useMutation({
    mutationFn: () => apiSend('PUT', `/api/secrets/${status.name}`, { value }),
    onSuccess: () => onSuccess(`${label} enregistré.`),
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => apiSend('DELETE', `/api/secrets/${status.name}`),
    onSuccess: () => onSuccess(`${label} supprimé.`),
    onError: (error) => toast.error(error.message),
  });

  const id = `secret-${status.name}`;
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {status.isSet ? (
          <Badge variant="secondary">
            ••••{status.last4}
            {status.source === 'env' && ' (fichier .env)'}
          </Badge>
        ) : (
          <Badge variant="outline">Non défini</Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          placeholder={status.isSet ? 'Saisir une nouvelle valeur pour remplacer' : 'Coller ici'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" disabled={!value.trim() || save.isPending}>
          Enregistrer
        </Button>
        {status.source === 'dashboard' && (
          <Button
            type="button"
            variant="outline"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Supprimer
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">{SECRET_HELP[status.name]}</p>
    </form>
  );
}

function PasswordCard() {
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiSend('POST', '/api/auth/password', body),
    onSuccess: () => toast.success('Mot de passe modifié. Les autres sessions sont fermées.'),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get('newPassword'));
    setMismatch(newPassword !== form.get('confirm'));
    if (newPassword !== form.get('confirm')) return;
    change.mutate(
      { currentPassword: String(form.get('currentPassword')), newPassword },
      { onSuccess: () => formElement.reset() },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compte</CardTitle>
        <CardDescription>Changer le mot de passe du dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <FormField
            label="Mot de passe actuel"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
          />
          <FormField
            label="Nouveau mot de passe"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            hint={`${PASSWORD_MIN_LENGTH} caractères minimum.`}
          />
          <FormField
            label="Confirmation"
            name="confirm"
            type="password"
            autoComplete="new-password"
          />
          {(mismatch || change.error) && (
            <p className="text-destructive text-sm" role="alert">
              {mismatch ? 'Les deux mots de passe ne correspondent pas.' : change.error?.message}
            </p>
          )}
          <Button type="submit" className="justify-self-start" disabled={change.isPending}>
            Modifier
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
