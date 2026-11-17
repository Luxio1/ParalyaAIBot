const FENCE = '```';
const FENCE_CLOSE = `\n${FENCE}`;

/**
 * Découpe un texte en morceaux d'au plus `limit` caractères, de préférence sur un saut de ligne,
 * sinon sur une espace. Un bloc de code coupé est refermé puis rouvert avec son langage.
 */
export function chunkText(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  let reopen = '';

  while (rest) {
    if (reopen.length + rest.length <= limit) {
      chunks.push(reopen + rest);
      break;
    }
    let piece = cut(rest, limit - reopen.length, reopen);
    // Refermer le bloc de code demande de la place : couper un peu plus tôt.
    if (piece.openFence !== null && piece.chunk.length + FENCE_CLOSE.length > limit) {
      piece = cut(rest, limit - reopen.length - FENCE_CLOSE.length, reopen);
    }
    chunks.push(piece.openFence === null ? piece.chunk : piece.chunk + FENCE_CLOSE);
    rest = rest.slice(piece.at).replace(/^[ \n]/, '');
    reopen = piece.openFence === null ? '' : `${piece.openFence}\n`;
  }
  return chunks;
}

function cut(rest: string, budget: number, reopen: string) {
  let at = rest.lastIndexOf('\n', budget);
  if (at < budget / 2) at = rest.lastIndexOf(' ', budget);
  if (at <= 0) at = budget;
  // Ne pas séparer les deux moitiés d'un emoji.
  if (isHighSurrogate(rest.charCodeAt(at - 1))) at--;
  const chunk = reopen + rest.slice(0, at).trimEnd();
  return { at, chunk, openFence: unclosedFence(chunk) };
}

/** Ligne d'ouverture (ex. ```ts) du bloc de code resté ouvert à la fin du texte, sinon `null`. */
function unclosedFence(text: string): string | null {
  let open: string | null = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith(FENCE)) open = open === null ? trimmed : null;
  }
  return open;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}
