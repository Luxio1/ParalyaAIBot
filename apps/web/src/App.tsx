import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { RealtimeProvider } from '@/hooks/useRealtime';
import { authStateQuery } from '@/lib/api';
import { BehaviorPage } from '@/pages/BehaviorPage';
import { BotPage } from '@/pages/BotPage';
import { ConsolePage } from '@/pages/ConsolePage';
import { LoginPage } from '@/pages/LoginPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SetupPage } from '@/pages/SetupPage';

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/bot" replace /> },
      { path: 'bot', element: <BotPage /> },
      { path: 'comportement', element: <BehaviorPage /> },
      { path: 'console', element: <ConsolePage /> },
      { path: 'parametres', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/bot" replace /> },
    ],
  },
]);

export function App() {
  const auth = useQuery(authStateQuery);

  if (auth.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle
          className="text-muted-foreground size-6 animate-spin"
          aria-label="Chargement"
        />
      </div>
    );
  }
  if (auth.isError) {
    return (
      <AuthScreen title="Serveur injoignable" description={auth.error.message}>
        <Button className="w-full" onClick={() => void auth.refetch()}>
          Réessayer
        </Button>
      </AuthScreen>
    );
  }
  if (auth.data.needsSetup) return <SetupPage />;
  if (!auth.data.user) return <LoginPage />;
  return (
    <RealtimeProvider>
      <RouterProvider router={router} />
    </RealtimeProvider>
  );
}
