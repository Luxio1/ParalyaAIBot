import { SafeFetchError, safeFetch } from '../../lib/safeFetch';
import type { AiImage } from '../ai/aiProvider';

/** Formats acceptés par Gemini. */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function isSupportedImageType(contentType: string | null): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType(contentType ?? ''));
}

export async function fetchImage(url: string): Promise<AiImage> {
  const { contentType, body } = await safeFetch(url, {
    accept: SUPPORTED_IMAGE_TYPES.join(','),
    maxBytes: () => MAX_IMAGE_BYTES,
  });
  if (!isSupportedImageType(contentType)) {
    throw new SafeFetchError(`format non pris en charge (${mimeType(contentType) || 'inconnu'})`);
  }
  return { mimeType: mimeType(contentType), data: body.toString('base64') };
}

/** `image/png; charset=...` donne `image/png`. */
export function mimeType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}
