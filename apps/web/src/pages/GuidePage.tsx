import { secretStatusSchema } from '@bot/shared';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleDashed, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { useRealtime } from '@/hooks/useRealtime';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';

const PORTAL_URL = 'https://discord.com/developers/applications';
const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

export function GuidePage() {
  const bot = useRealtime().bot;
  const secrets = useQuery({
    queryKey: ['secrets'],
    queryFn: () => apiGet('/api/secrets', secretStatusSchema.array()),
  }).data;
  const isSet = (name: string) => secrets?.some((secret) => secret.name === name && secret.isSet);
  const online = bot?.state === 'online';

  const steps: { title: string; done: boolean; body: ReactNode }[] = [
    {
      title: "Créer l'application Discord",
      done: Boolean(isSet('discordToken')),
      body: (
        <>
          Sur le <External href={PORTAL_URL}>Developer Portal</External>, cliquez sur « New
          Application », donnez-lui un nom, puis acceptez les conditions. Le nom et l'icône
          deviennent ceux du bot.
        </>
      ),
    },
    {
      title: 'Récupérer le token du bot',
      done: Boolean(isSet('discordToken')),
      body: (
        <>
          Onglet <b>Bot</b>, bouton <b>Reset Token</b>, puis copiez le token (il n'est affiché
          qu'une fois) et collez-le dans <InApp to="/parametres">Paramètres</InApp>. Ne le partagez
          jamais : il donne le contrôle total du bot.
        </>
      ),
    },
    {
      title: 'Activer les accès privilégiés (intents)',
      done: online,
      body: (
        <>
          Toujours dans l'onglet <b>Bot</b>, section « Privileged Gateway Intents », activez{' '}
          <b>Message Content Intent</b> (indispensable pour lire les messages), puis enregistrez.
          Activez aussi <b>Server Members Intent</b> si une règle d'événement écrit aux membres d'un
          rôle.
        </>
      ),
    },
    {
      title: 'Créer la clé Gemini',
      done: Boolean(isSet('geminiApiKey')),
      body: (
        <>
          Sur <External href={AI_STUDIO_URL}>Google AI Studio</External>, cliquez sur « Create API
          key », puis collez la clé dans <InApp to="/parametres">Paramètres</InApp>.
        </>
      ),
    },
    {
      title: 'Démarrer et inviter le bot',
      done: online && (bot?.guildCount ?? 0) > 0,
      body: (
        <>
          Sur la page <InApp to="/bot">Bot</InApp>, cliquez sur <b>Démarrer</b>, puis sur{' '}
          <b>Inviter le bot sur un serveur</b> : le lien demande déjà les bonnes permissions.
          {online && bot?.guildCount === 0 && ' Le bot est en ligne mais sur aucun serveur.'}
        </>
      ),
    },
    {
      title: 'Régler et tester',
      done: false,
      body: (
        <>
          Réglez le déclenchement, les salons et le persona dans{' '}
          <InApp to="/comportement">Comportement</InApp>, essayez-les dans le{' '}
          <InApp to="/simulateur">Simulateur</InApp>, puis sur Discord. La{' '}
          <InApp to="/console">Console</InApp> affiche chaque question, réponse ou erreur.
        </>
      ),
    },
  ];
  const remaining = steps.slice(0, -1).filter((step) => !step.done).length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Guide de mise en route</h1>
      <p className="text-muted-foreground text-sm">
        {remaining === 0
          ? 'Configuration terminée : le bot est en ligne et invité sur un serveur.'
          : `Encore ${remaining} étape(s) avant que le bot fonctionne. Les étapes se cochent toutes seules.`}
      </p>
      <ol className="grid gap-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card className={cn(step.done && 'opacity-70')}>
              <CardContent className="flex gap-3">
                {step.done ? (
                  <CircleCheck className="size-5 shrink-0 text-emerald-400" aria-label="Fait" />
                ) : (
                  <CircleDashed
                    className="text-muted-foreground size-5 shrink-0"
                    aria-label="À faire"
                  />
                )}
                <div className="grid gap-1">
                  <h2 className="font-medium">
                    {index + 1}. {step.title}
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-foreground inline-flex items-center gap-0.5 underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}

function InApp({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-foreground underline">
      {children}
    </Link>
  );
}
