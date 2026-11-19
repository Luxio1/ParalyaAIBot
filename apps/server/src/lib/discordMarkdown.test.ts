import { describe, expect, it } from 'vitest';
import { repairDiscordMarkdown } from './discordMarkdown';

describe('repairDiscordMarkdown', () => {
  it('referme sur la même ligne un gras coupé par un saut de ligne', () => {
    expect(repairDiscordMarkdown('- **@AirDox\n\n** est un joueur constant.')).toBe(
      '- **@AirDox** est un joueur constant.',
    );
    expect(repairDiscordMarkdown('__titre \n__ suite')).toBe('__titre__ suite');
  });

  it('laisse intacts la mise en forme correcte et les blocs de code', () => {
    const text = '**Un**\n\n**Deux** et __trois__\n```py\nx = 1\n```';
    expect(repairDiscordMarkdown(text)).toBe(text);
    const code = '```\n**a\n** b\n```';
    expect(repairDiscordMarkdown(code)).toBe(code);
  });
});
