import { describe, expect, it } from 'vitest';
import { chunkText } from './chunkText';

describe('chunkText', () => {
  it('laisse intact un texte court', () => {
    expect(chunkText('  Bonjour  ', 20)).toEqual(['Bonjour']);
  });

  it('coupe de préférence sur un saut de ligne, sinon sur une espace', () => {
    expect(chunkText('ligne une\nligne deux', 12)).toEqual(['ligne une', 'ligne deux']);
    expect(chunkText('un deux trois quatre', 12)).toEqual(['un deux', 'trois quatre']);
  });

  it('coupe un mot trop long sans dépasser la limite', () => {
    const chunks = chunkText('a'.repeat(25), 10);
    expect(chunks.join('')).toBe('a'.repeat(25));
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
  });

  it('referme puis rouvre un bloc de code coupé', () => {
    const code = ['```ts', ...Array.from({ length: 6 }, (_, i) => `const v${i} = ${i};`), '```'];
    const chunks = chunkText(['Exemple :', ...code].join('\n'), 60);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(60);
      expect(chunk.match(/```/g)?.length ?? 0).toSatisfy((count: number) => count % 2 === 0);
    }
    expect(chunks[1]).toMatch(/^```ts\n/);
  });

  it('ne coupe pas un emoji en deux', () => {
    const chunks = chunkText(`${'a'.repeat(9)}😀`, 10);
    expect(chunks).toEqual(['a'.repeat(9), '😀']);
  });
});
