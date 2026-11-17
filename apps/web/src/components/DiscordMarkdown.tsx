import type { ReactNode } from 'react';

/**
 * Mise en forme Discord courante : gras, italique, souligné, barré, code, blocs de code, citations,
 * titres, listes et liens http(s). Le texte vient de l'IA : il est toujours affiché comme du texte
 * (React l'échappe), jamais interprété comme du HTML.
 */
export function DiscordMarkdown({ text }: { text: string }) {
  return <div className="grid gap-1 break-words">{renderBlocks(text)}</div>;
}

function renderBlocks(text: string): ReactNode[] {
  // Les parties impaires sont entre deux ``` (un bloc non refermé va jusqu'à la fin).
  return text.split('```').flatMap<ReactNode>((part, index) => {
    if (index % 2 === 0) return renderLines(part, `t${index}`);
    const newline = part.indexOf('\n');
    const hasLanguage = newline >= 0 && /^[\w+#-]*$/.test(part.slice(0, newline));
    const code = (hasLanguage ? part.slice(newline + 1) : part).replace(/\n$/, '');
    return [
      <pre key={`c${index}`} className="bg-muted overflow-x-auto rounded p-2 font-mono text-xs">
        <code>{code}</code>
      </pre>,
    ];
  });
}

function renderLines(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let quote: string[] = [];
  const flushQuote = () => {
    if (quote.length === 0) return;
    nodes.push(
      <blockquote
        key={`${key}q${nodes.length}`}
        className="border-muted-foreground/50 border-l-4 pl-2"
      >
        {quote.map((line, index) => (
          <p key={index}>{renderInline(line)}</p>
        ))}
      </blockquote>,
    );
    quote = [];
  };

  for (const line of text.split('\n')) {
    if (line === '>' || line.startsWith('> ')) {
      quote.push(line.slice(2));
      continue;
    }
    flushQuote();
    if (!line.trim()) continue;
    const lineKey = `${key}l${nodes.length}`;
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    const item = /^\s*[-*] (.+)$/.exec(line);
    if (heading?.[1] && heading[2]) {
      const size = ['text-lg', 'text-base', 'text-sm'][heading[1].length - 1];
      nodes.push(
        <p key={lineKey} className={`${size} font-semibold`}>
          {renderInline(heading[2])}
        </p>,
      );
    } else if (line.startsWith('-# ')) {
      nodes.push(
        <p key={lineKey} className="text-muted-foreground text-xs">
          {renderInline(line.slice(3))}
        </p>,
      );
    } else if (item?.[1]) {
      nodes.push(
        <p key={lineKey} className="pl-4 -indent-3">
          • {renderInline(item[1])}
        </p>,
      );
    } else {
      nodes.push(<p key={lineKey}>{renderInline(line)}</p>);
    }
  }
  flushQuote();
  return nodes;
}

const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>)]+)/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index;
    if (index > last) nodes.push(text.slice(last, index));
    const [token, code, bold, underline, star, under, strike, label, labelUrl, url] = match;
    const key = nodes.length;
    if (code) {
      nodes.push(
        <code key={key} className="bg-muted rounded px-1 font-mono text-xs">
          {code.slice(1, -1)}
        </code>,
      );
    } else if (bold) nodes.push(<strong key={key}>{renderInline(bold.slice(2, -2))}</strong>);
    else if (underline) nodes.push(<u key={key}>{renderInline(underline.slice(2, -2))}</u>);
    else if (star ?? under) {
      nodes.push(<em key={key}>{renderInline((star ?? under ?? '').slice(1, -1))}</em>);
    } else if (strike) nodes.push(<s key={key}>{renderInline(strike.slice(2, -2))}</s>);
    else if (label && labelUrl) nodes.push(<ExternalLink key={key} href={labelUrl} text={label} />);
    else if (url) nodes.push(<ExternalLink key={key} href={url} text={url} />);
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function ExternalLink({ href, text }: { href: string; text: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-sky-400 underline">
      {text}
    </a>
  );
}
