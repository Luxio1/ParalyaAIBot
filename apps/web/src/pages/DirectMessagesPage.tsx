import { Hint, SaveBar, Section, useConfigForm } from '@/components/ConfigForm';
import { DiscoverySelect } from '@/components/DiscoveryPicker';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function DirectMessagesPage() {
  const form = useConfigForm();
  if (!form) return null;
  const { draft, set } = form;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Messages privés</h1>

      <Section title="Réponses en MP" scope="shared">
        <div className="flex items-center gap-3">
          <Switch
            id="allowDMs"
            checked={draft.allowDMs}
            onCheckedChange={(allowDMs) => set({ allowDMs })}
          />
          <Label htmlFor="allowDMs">Répondre aux messages privés</Label>
        </div>
        <Hint>En MP, le bot répond à chaque message, sans mention ni préfixe.</Hint>
      </Section>

      <Section
        title="Retranscription"
        description="Recopie les MP reçus par le bot, et ses réponses, dans un salon du staff."
        scope="shared"
      >
        <div className="flex items-center gap-3">
          <Switch
            id="dmRelayEnabled"
            checked={draft.dmRelayEnabled}
            onCheckedChange={(dmRelayEnabled) => set({ dmRelayEnabled })}
          />
          <Label htmlFor="dmRelayEnabled">Retranscrire les MP</Label>
        </div>
        {draft.dmRelayEnabled && (
          <div className="grid gap-2">
            <Label htmlFor="dmRelayChannel">Salon de destination</Label>
            <DiscoverySelect
              kind="channel"
              emptyLabel="Choisir un salon"
              id="dmRelayChannel"
              value={draft.dmRelayChannelId}
              onChange={(dmRelayChannelId) => set({ dmRelayChannelId })}
            />
            <Hint>
              Les messages recopiés ne notifient personne. Les membres ne savent pas que leurs MP
              sont lus par le staff : indiquez-le, par exemple dans la description du bot.
            </Hint>
          </div>
        )}
      </Section>

      <SaveBar form={form} />
    </div>
  );
}
