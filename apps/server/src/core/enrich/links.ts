import { parse } from 'node-html-parser';
import { safeFetch } from '../../lib/safeFetch';
import type { AiImage } from '../ai/aiProvider';
import { isSupportedImageType, MAX_IMAGE_BYTES, mimeType, SUPPORTED_IMAGE_TYPES } from './images';

const MAX_PAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PAGE_TEXT = 4000;
const READABLE_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain', 'application/json'];
const NOISE = 'script, style, noscript, svg, iframe, template, nav, footer, form';

export interface PageContent {
  url: string;
  title: string;
  description: string;
  text: string;
}

export type LinkContent = { kind: 'page'; page: PageContent } | { kind: 'image'; image: AiImage };

/** URL http(s) d'un texte, sans la ponctuation finale ni les doublons. */
export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"'`]+/gi) ?? [];
  return [...new Set(found.map((url) => url.replace(/[.,;:!?)\]}*_~]+$/, '')))];
}

/** Lit une page (titre, description, texte) ou une image désignée par un lien. */
export async function readLink(url: string): Promise<LinkContent> {
  const response = await safeFetch(url, {
    accept: `text/html,application/xhtml+xml,text/plain;q=0.9,${SUPPORTED_IMAGE_TYPES.join(',')};q=0.8`,
    maxBytes: (contentType) =>
      isSupportedImageType(contentType) ? MAX_IMAGE_BYTES : MAX_PAGE_BYTES,
  });
  const type = mimeType(response.contentType);
  if (isSupportedImageType(type)) {
    return { kind: 'image', image: { mimeType: type, data: response.body.toString('base64') } };
  }
  if (type && !READABLE_TYPES.includes(type)) {
    throw new Error(`contenu non lisible (${type})`);
  }
  const raw = decode(response.body, response.contentType);
  const page =
    type === 'text/plain' || type === 'application/json'
      ? { title: '', description: '', text: truncate(raw.trim()) }
      : extractHtml(raw);
  return { kind: 'page', page: { url: response.url, ...page } };
}

export function extractHtml(html: string): Omit<PageContent, 'url'> {
  const root = parse(html);
  const title = root.querySelector('title')?.text.trim() ?? '';
  const description =
    root
      .querySelector('meta[name="description"], meta[property="og:description"]')
      ?.getAttribute('content')
      ?.trim() ?? '';
  for (const node of root.querySelectorAll(NOISE)) node.remove();
  const body = root.querySelector('main, article') ?? root.querySelector('body') ?? root;
  const text = body.structuredText
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return { title, description, text: truncate(text) };
}

function decode(body: Buffer, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder().decode(body);
  }
}

function truncate(text: string): string {
  return text.length > MAX_PAGE_TEXT ? `${text.slice(0, MAX_PAGE_TEXT)} [texte tronqué]` : text;
}
