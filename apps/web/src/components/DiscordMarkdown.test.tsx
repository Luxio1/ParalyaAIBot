import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiscordMarkdown } from './DiscordMarkdown';

const render = (text: string) => renderToStaticMarkup(<DiscordMarkdown text={text} />);

describe('DiscordMarkdown', () => {
  it('met en forme gras, italique, souligné, barré et code', () => {
    const html = render('**gras** *italique* __souligné__ ~~barré~~ `code`');
    expect(html).toContain('<strong>gras</strong>');
    expect(html).toContain('<em>italique</em>');
    expect(html).toContain('<u>souligné</u>');
    expect(html).toContain('<s>barré</s>');
    expect(html).toMatch(/<code[^>]*>code<\/code>/);
  });

  it('affiche un bloc de code sans son langage, et une citation', () => {
    const html = render('Voici :\n```ts\nconst a = 1;\n```\n> cité');
    expect(html).toMatch(/<pre[^>]*><code>const a = 1;<\/code><\/pre>/);
    expect(html).toMatch(/<blockquote[^>]*><p>cité<\/p><\/blockquote>/);
  });

  it('ne rend cliquables que les liens http(s)', () => {
    const html = render(
      '[site](https://exemple.fr) et https://exemple.fr/b et javascript:alert(1)',
    );
    expect(html).toContain('href="https://exemple.fr"');
    expect(html).toContain('href="https://exemple.fr/b"');
    expect(html).not.toContain('href="javascript');
  });

  it("n'interprète jamais le HTML du texte", () => {
    const html = render('<img src=x onerror=alert(1)> **<b>gras</b>**');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<strong>&lt;b&gt;gras&lt;/b&gt;</strong>');
  });
});
