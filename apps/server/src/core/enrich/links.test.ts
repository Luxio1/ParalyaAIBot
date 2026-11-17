import { describe, expect, it } from 'vitest';
import { extractHtml, extractUrls, MAX_PAGE_TEXT } from './links';

describe('extractUrls', () => {
  it('repère les liens sans la ponctuation finale ni les doublons', () => {
    const text =
      'Lis https://exemple.fr/article?id=1, puis (https://exemple.fr/b). Et <https://exemple.fr/c> https://exemple.fr/b';
    expect(extractUrls(text)).toEqual([
      'https://exemple.fr/article?id=1',
      'https://exemple.fr/b',
      'https://exemple.fr/c',
    ]);
  });
});

describe('extractHtml', () => {
  it('garde le titre, la description et le texte principal, sans scripts ni menus', () => {
    const html = `<!doctype html><html><head>
      <title>Recette &amp; astuces</title>
      <meta name="description" content="Une tarte simple">
      <script>alert("x")</script><style>p{}</style></head>
      <body><nav>Accueil | Contact</nav>
      <main><h1>Tarte aux pommes</h1><p>Préchauffer   le four.</p><p>Cuire 30 min.</p></main>
      <footer>Mentions légales</footer></body></html>`;

    expect(extractHtml(html)).toEqual({
      title: 'Recette & astuces',
      description: 'Une tarte simple',
      text: 'Tarte aux pommes\nPréchauffer le four.\nCuire 30 min.',
    });
  });

  it('tronque un texte trop long', () => {
    const { text } = extractHtml(`<p>${'mot '.repeat(3000)}</p>`);
    expect(text.length).toBeLessThan(MAX_PAGE_TEXT + 20);
    expect(text.endsWith('[texte tronqué]')).toBe(true);
  });
});
