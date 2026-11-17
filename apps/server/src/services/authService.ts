import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ChangePasswordRequest, LoginRequest, SetupRequest } from '@bot/shared';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, gt, lt, ne } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';
import { AppError } from '../lib/appError';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const IDLE_TTL_MS = 7 * DAY_MS;
/** Durée de vie maximale d'une session, même utilisée en continu. Sert aussi de durée au cookie. */
export const SESSION_MAX_AGE_MS = 30 * DAY_MS;
/** Prolonger à chaque requête écrirait en base à chaque appel. */
const RENEW_STEP_MS = HOUR_MS;

export interface Session {
  token: string;
  expiresAt: Date;
}

export interface AuthenticatedUser {
  sessionId: string;
  userId: number;
  username: string;
}

export class AuthService {
  #setupCode: string | null = null;
  #dummyHash: Promise<string> | undefined;

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
  ) {}

  needsSetup(): boolean {
    return this.db.select({ id: users.id }).from(users).limit(1).get() === undefined;
  }

  /** Code à usage unique exigé pour créer le premier compte ; `null` si un compte existe déjà. */
  createSetupCode(): string | null {
    if (!this.needsSetup()) return null;
    this.#setupCode = randomBytes(9).toString('base64url');
    return this.#setupCode;
  }

  async setup({ setupCode, username, password }: SetupRequest): Promise<Session> {
    if (!this.needsSetup()) {
      throw new AppError(409, 'already_setup', 'Un compte administrateur existe déjà.');
    }
    if (this.#setupCode === null || !safeEqual(setupCode, this.#setupCode)) {
      throw new AppError(
        403,
        'invalid_setup_code',
        "Code d'installation invalide. Il est affiché dans les logs du serveur au démarrage.",
      );
    }

    const passwordHash = await hash(password);
    // Revérifié après l'attente : deux installations simultanées ne doivent pas créer deux comptes.
    if (this.#setupCode === null || !this.needsSetup()) {
      throw new AppError(409, 'already_setup', 'Un compte administrateur existe déjà.');
    }
    const user = this.db
      .insert(users)
      .values({ username, passwordHash })
      .returning({ id: users.id })
      .get();
    this.#setupCode = null;
    this.logBus.push('success', `Compte administrateur « ${username} » créé.`);
    return this.#createSession(user.id);
  }

  /** `null` si l'identifiant ou le mot de passe est faux, sans dire lequel. */
  async login({ username, password }: LoginRequest): Promise<Session | null> {
    const user = this.db.select().from(users).where(eq(users.username, username)).get();
    // Un identifiant inconnu coûte un hash comme un vrai : le temps de réponse ne révèle pas les comptes.
    const passwordOk = await verify(user?.passwordHash ?? (await this.#getDummyHash()), password);
    if (!user || !passwordOk) {
      this.logBus.push('error', `Échec de connexion au dashboard (identifiant « ${username} »).`);
      return null;
    }

    this.db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
    this.logBus.push('system', `Connexion de « ${username} » au dashboard.`);
    return this.#createSession(user.id);
  }

  /** Prolonge la session à l'usage, dans la limite de `SESSION_MAX_AGE_MS`. */
  authenticate(token: string | undefined): AuthenticatedUser | null {
    if (!token) return null;
    const sessionId = sha256(token);
    const row = this.db
      .select({
        userId: sessions.userId,
        username: users.username,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
      .get();
    if (!row) return null;

    const renewedExpiry = Math.min(
      Date.now() + IDLE_TTL_MS,
      row.createdAt.getTime() + SESSION_MAX_AGE_MS,
    );
    if (renewedExpiry - row.expiresAt.getTime() > RENEW_STEP_MS) {
      this.db
        .update(sessions)
        .set({ expiresAt: new Date(renewedExpiry) })
        .where(eq(sessions.id, sessionId))
        .run();
    }
    return { sessionId, userId: row.userId, username: row.username };
  }

  logout(token: string): void {
    this.db
      .delete(sessions)
      .where(eq(sessions.id, sha256(token)))
      .run();
  }

  /** Ferme toutes les autres sessions de l'utilisateur. */
  async changePassword(
    user: AuthenticatedUser,
    { currentPassword, newPassword }: ChangePasswordRequest,
  ): Promise<void> {
    const row = this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.userId))
      .get();
    if (!row || !(await verify(row.passwordHash, currentPassword))) {
      throw new AppError(403, 'invalid_password', 'Mot de passe actuel incorrect.');
    }

    const passwordHash = await hash(newPassword);
    this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.userId))
      .run();
    this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, user.userId), ne(sessions.id, user.sessionId)))
      .run();
    this.logBus.push('system', `Mot de passe de « ${user.username} » modifié.`);
  }

  #createSession(userId: number): Session {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + IDLE_TTL_MS);
    this.db
      .insert(sessions)
      .values({ id: sha256(token), userId, expiresAt })
      .run();
    return { token, expiresAt };
  }

  #getDummyHash(): Promise<string> {
    this.#dummyHash ??= hash(randomBytes(16).toString('hex'));
    return this.#dummyHash;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
