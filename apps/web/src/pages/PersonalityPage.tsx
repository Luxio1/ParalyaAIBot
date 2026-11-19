import { PERSONA_PRESETS } from '@bot/shared';
import { Hint, SaveBar, Section, useConfigForm } from '@/components/ConfigForm';
import { ModelSelect } from '@/components/ModelSelect';
import { ProfileManager } from '@/components/ProfileSwitcher';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function PersonalityPage() {
  const form = useConfigForm();
  if (!form) return null;
  const { draft, set } = form;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Personnalité</h1>
      <ProfileManager />

      <Section
        title="Intelligence artificielle"
        description="Le modèle Gemini et la personnalité du bot."
        scope="profile"
      >
        <ModelSelect
          id="model"
          label="Modèle"
          value={draft.model}
          onChange={(model) => set({ model })}
        />
        <div className="grid gap-2">
          <Label htmlFor="persona">Persona</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {PERSONA_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => set({ systemPrompt: preset.prompt })}
                className={cn(
                  'hover:bg-accent rounded-md border p-2 text-left',
                  draft.systemPrompt === preset.prompt && 'border-primary bg-accent',
                )}
              >
                <span className="block text-sm font-medium">{preset.name}</span>
                <span className="text-muted-foreground text-xs">{preset.description}</span>
              </button>
            ))}
          </div>
          <Textarea
            id="persona"
            className="min-h-40"
            value={draft.systemPrompt}
            onChange={(event) => set({ systemPrompt: event.target.value })}
          />
          <Hint>
            {draft.systemPrompt.length} caractères, envoyés avec chaque question. Décrit la
            personnalité et le ton du bot.
          </Hint>
        </div>
      </Section>

      <SaveBar form={form} />
    </div>
  );
}
