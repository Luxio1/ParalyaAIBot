import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().trim().min(1).default('./data'),
  APP_SECRET: z
    .string({ error: 'APP_SECRET est obligatoire' })
    .min(32, 'APP_SECRET doit contenir au moins 32 caractères'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  GEMINI_API_KEY: optionalString,
  WEB_DIST_DIR: optionalString,
});

export interface Env {
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  host: string;
  port: number;
  /** Dossier absolu des données persistantes. */
  dataDir: string;
  /** Chemin absolu du fichier SQLite. */
  databaseFile: string;
  /** Clé maîtresse de chiffrement des secrets. Ne jamais logger. */
  appSecret: string;
  logLevel: string;
  /** Clé Gemini de repli (si aucune clé n'est enregistrée dans le dashboard). */
  geminiApiKey: string | undefined;
  /** Dossier absolu du dashboard buildé (servi en production). */
  webDistDir: string;
}

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      [
        'Configuration invalide (variables d’environnement) :',
        ...issues.map((issue) => `  - ${issue}`),
        'Copiez « .env.example » en « .env » et complétez les valeurs.',
      ].join('\n'),
    );
    this.name = 'EnvError';
  }
}

/** Remonte l'arborescence jusqu'à la racine du monorepo (repli : dossier courant). */
export function findRootDir(from: string = process.cwd()): string {
  let current = resolve(from);
  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(from);
    current = parent;
  }
}

/** Charge le fichier `.env` de la racine s'il existe (sans écraser l'environnement réel). */
export function loadDotEnv(rootDir: string): void {
  const file = join(rootDir, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function parseEnv(
  source: Record<string, string | undefined>,
  rootDir: string = findRootDir(),
): Env {
  // Une variable vide (« PORT= ») est traitée comme absente.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvError(
      result.error.issues.map((issue) => {
        const name = issue.path.join('.');
        return issue.message.includes(name) ? issue.message : `${name} : ${issue.message}`;
      }),
    );
  }
  const raw = result.data;
  const toAbsolute = (path: string) => (isAbsolute(path) ? path : resolve(rootDir, path));
  const dataDir = toAbsolute(raw.DATA_DIR);
  return {
    nodeEnv: raw.NODE_ENV,
    isProduction: raw.NODE_ENV === 'production',
    host: raw.HOST,
    port: raw.PORT,
    dataDir,
    databaseFile: join(dataDir, 'bot.db'),
    appSecret: raw.APP_SECRET,
    logLevel: raw.LOG_LEVEL,
    geminiApiKey: raw.GEMINI_API_KEY,
    webDistDir: toAbsolute(raw.WEB_DIST_DIR ?? 'apps/web/dist'),
  };
}
