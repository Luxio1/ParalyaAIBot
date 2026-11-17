import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;
const USER_AGENT =
  'Mozilla/5.0 (compatible; ParalyaAIBot/0.1; +https://github.com/Luxio1/ParalyaAIBot)';

/** Adresses jamais contactées : réseau local, boucle locale, métadonnées cloud, plages réservées. */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  // IPv4 encapsulé (NAT64, 6to4, Teredo) : refusé plutôt que décodé. Les adresses mappées
  // (::ffff:a.b.c.d) sont comparées par BlockList aux règles IPv4 ci-dessus.
  ['64:ff9b::', 96],
  ['2002::', 16],
  ['2001::', 23],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6');
}

/** Refus explicable : le message peut être affiché dans la console du dashboard. */
export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  accept: string;
  /** Taille maximale selon le type de contenu annoncé par le serveur. */
  maxBytes: (contentType: string) => number;
}

export interface SafeFetchResult {
  /** Adresse finale, après redirections. */
  url: string;
  contentType: string;
  body: Buffer;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Télécharge une ressource web fournie par un utilisateur sans exposer le réseau du serveur (SSRF) :
 * http(s) sur les ports standard uniquement, adresses publiques uniquement (vérifiées au moment de
 * la connexion, ce qui déjoue le DNS rebinding), redirections revérifiées, durée et taille bornées.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = checkUrl(rawUrl);
  for (let redirects = 0; ; redirects++) {
    const response = await request(url, options.accept, signal);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location) {
      response.resume();
      if (redirects === MAX_REDIRECTS) throw new SafeFetchError('trop de redirections');
      url = checkUrl(new URL(location, url).href);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new SafeFetchError(`le site a répondu ${status}`);
    }
    const contentType = (response.headers['content-type'] ?? '').toLowerCase();
    try {
      const body = await readBody(response, options.maxBytes(contentType));
      return { url: url.href, contentType, body };
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError(signal.aborted ? 'délai dépassé' : 'lecture interrompue');
    }
  }
}

/** Valide une URL avant toute connexion. */
export function checkUrl(rawUrl: string): URL {
  if (!URL.canParse(rawUrl)) throw new SafeFetchError('adresse invalide');
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError(`protocole ${url.protocol} refusé`);
  }
  if (url.port !== '') throw new SafeFetchError(`port ${url.port} refusé`);
  if (url.username || url.password) throw new SafeFetchError("identifiants dans l'adresse refusés");
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // Une adresse IP littérale ne passe pas par la résolution DNS : on la vérifie ici.
  if (isIP(host) && !isPublicAddress(host)) {
    throw new SafeFetchError(`adresse non publique refusée (${host})`);
  }
  return url;
}

function request(url: URL, accept: string, signal: AbortSignal): Promise<IncomingMessage> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, {
      headers: { 'user-agent': USER_AGENT, accept },
      lookup: publicOnlyLookup,
      signal,
    });
    req.on('response', resolve);
    req.on('error', (error) =>
      reject(
        error instanceof SafeFetchError
          ? error
          : new SafeFetchError(signal.aborted ? 'délai dépassé' : 'site injoignable'),
      ),
    );
  });
}

/** Résolution DNS qui échoue si l'une des adresses du nom n'est pas publique. */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    const blocked = addresses.find((entry) => !isPublicAddress(entry.address));
    if (blocked || addresses.length === 0) {
      const reason = blocked ? `adresse non publique refusée (${blocked.address})` : 'nom inconnu';
      return callback(new SafeFetchError(reason), '', 0);
    }
    if (options.all) return callback(null, addresses);
    const [first] = addresses as [LookupAddress];
    callback(null, first.address, first.family);
  });
};

async function readBody(response: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers['content-length']);
  if (declared > maxBytes) {
    response.destroy();
    throw new SafeFetchError(`contenu trop volumineux (${formatSize(declared)})`);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) {
      response.destroy();
      throw new SafeFetchError(`contenu trop volumineux (plus de ${formatSize(maxBytes)})`);
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
