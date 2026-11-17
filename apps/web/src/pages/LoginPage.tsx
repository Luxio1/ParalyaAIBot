import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { AuthScreen } from '@/components/AuthScreen';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { apiSend, authStateQuery } from '@/lib/api';

export function LoginPage() {
  const queryClient = useQueryClient();
  const login = useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      apiSend('POST', '/api/auth/login', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authStateQuery.queryKey }),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({
      username: String(form.get('username')),
      password: String(form.get('password')),
    });
  };

  return (
    <AuthScreen title="Connexion" description="Accès réservé à l'administrateur du bot.">
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormField label="Identifiant" name="username" autoComplete="username" />
        <FormField
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        {login.error && (
          <p className="text-destructive text-sm" role="alert">
            {login.error.message}
          </p>
        )}
        <Button type="submit" disabled={login.isPending}>
          Se connecter
        </Button>
      </form>
    </AuthScreen>
  );
}
