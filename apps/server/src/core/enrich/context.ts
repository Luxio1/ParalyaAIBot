import type { AiImage } from '../ai/aiProvider';
import type {
  Attachment,
  IncomingMessage,
  QuotedMessage,
  Transport,
} from '../pipeline/messagePipeline';
import { fetchImage, isSupportedImageType, MAX_IMAGE_BYTES, mimeType } from './images';
import { extractUrls, readLink, type PageContent } from './links';

const MAX_IMAGES = 4;
const MAX_LINKS = 3;

export interface MessageContext {
  quoted: QuotedMessage | null;
  images: AiImage[];
  pages: PageContent[];
  /** Raisons lisibles des contenus ignorés, pour la console et pour l'IA. */
  failures: string[];
}

/**
 * Message cité, images et pages web liés à une question. Appelé seulement quand le bot a décidé
 * de répondre : aucun téléchargement n'est déclenché par un message qui ne le concerne pas.
 * Le message cité ne complète que ce que la question n'apporte pas elle-même (images, liens).
 */
export async function gatherContext(
  message: IncomingMessage,
  query: string,
  transport: Transport,
): Promise<MessageContext> {
  const quoted = message.isReply ? await transport.fetchQuoted().catch(() => null) : null;
  const failures: string[] = [];

  let attachments = message.attachments.filter((attachment) => isImage(attachment));
  if (attachments.length === 0 && quoted) attachments = quoted.attachments.filter(isImage);
  const usable = attachments.filter((attachment) => {
    const problem = attachmentProblem(attachment);
    if (problem) failures.push(`pièce jointe ${attachment.name} (${problem})`);
    return !problem;
  });

  let urls = extractUrls(query);
  if (urls.length === 0 && quoted) urls = extractUrls(quoted.text);

  const [imageResults, linkResults] = await Promise.all([
    Promise.allSettled(usable.slice(0, MAX_IMAGES).map((attachment) => fetchImage(attachment.url))),
    Promise.allSettled(urls.slice(0, MAX_LINKS).map((url) => readLink(url))),
  ]);

  // Images fournies directement (simulateur), sans téléchargement.
  const images: AiImage[] = message.inlineImages.slice(0, MAX_IMAGES);
  const pages: PageContent[] = [];
  imageResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (images.length < MAX_IMAGES) images.push(result.value);
    } else failures.push(`pièce jointe ${usable[index]?.name} (${reason(result.reason)})`);
  });
  linkResults.forEach((result, index) => {
    if (result.status === 'rejected')
      failures.push(`lien ${urls[index]} (${reason(result.reason)})`);
    else if (result.value.kind === 'page') pages.push(result.value.page);
    else if (images.length < MAX_IMAGES) images.push(result.value.image);
  });
  return { quoted, images, pages, failures };
}

function isImage(attachment: Attachment): boolean {
  return attachment.contentType?.startsWith('image/') ?? false;
}

function attachmentProblem(attachment: Attachment): string | null {
  if (!isSupportedImageType(attachment.contentType)) {
    return `format ${mimeType(attachment.contentType ?? '')} non pris en charge`;
  }
  if (attachment.size > MAX_IMAGE_BYTES) return 'image de plus de 8 Mo';
  return null;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
