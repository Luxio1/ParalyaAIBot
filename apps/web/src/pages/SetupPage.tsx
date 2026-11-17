import { PASSWORD_MIN_LENGTH } from '@bot/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { apiSend, authStateQuery } from '@/lib/api';

export function SetupPage() {
  const queryClient = useQueryClient();
  const [mismatch, setMismatch] = useState(false);
  const setup = useMutation({
    mutationFn: (body: { setupCode: string; username: string; password: string }) =>
      apiSend('POST', '/api/auth/setup', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authStateQuery.queryKey }),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    setMismatch(password !== form.get('confirm'));
    if (password !== form.get('confirm')) return;
    setup.mutate({
      setupCode: String(form.get('setupCode')),
      username: String(form.get('username')),
      password,
    });
  };

  return (
    <AuthScreen
      title="Installation"
      description={
        <>
          Créez le compte administrateur du dashboard. Le code d'installation est affiché dans les
          logs du serveur (terminal de <code>pnpm dev</code> ou logs de l'hébergeur).
        </>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormField label="Code d'installation" name="setupCode" autoComplete="off" />
        <FormField label="Identifiant" name="username" autoComplete="username" />
        <FormField
          label="Mot de passe"
          name="password"
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
        {(mismatch || setup.error) && (
          <p className="text-destructive text-sm" role="alert">
            {mismatch ? 'Les deux mots de passe ne correspondent pas.' : setup.error?.message}
          </p>
        )}
        <Button type="submit" disabled={setup.isPending}>
          Créer le compte
        </Button>
      </form>
    </AuthScreen>
  );
}
