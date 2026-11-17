import { SECRET_LABELS, SECRET_NAMES, type SecretName, type SecretStatus } from '@bot/shared';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { Db } from '../db/client';
import { secrets } from '../db/schema';
import { decryptSecret, deriveSecretsKey, encryptSecret } from '../lib/crypto';

/** Les valeurs déchiffrées restent en mémoire du serveur ; vers l'extérieur ne sort que `SecretStatus`. */
export class SecretsService {
  readonly #key: Buffer;
  readonly #values = new Map<SecretName, string>();
  readonly #listeners = new Set<(name: SecretName) => void>();

  constructor(
    private readonly db: Db,
    appSecret: string,
    /** Valeurs du `.env`, utilisées faute de valeur saisie dans le dashboard. */
    private readonly envFallbacks: Partial<Record<SecretName, string>>,
    private readonly logBus: LogBus,
  ) {
    this.#key = deriveSecretsKey(appSecret);
    for (const row of db.select().from(secrets).all()) {
      try {
        this.#values.set(row.name, decryptSecret(row.ciphertext, this.#key, row.name));
      } catch {
        logBus.push(
          'error',
          `${SECRET_LABELS[row.name]} illisible : APP_SECRET a probablement changé. Saisissez-le à nouveau.`,
        );
      }
    }
  }

  /** Valeur en clair, pour le serveur uniquement : ne jamais la renvoyer dans une réponse. */
  get(name: SecretName): string | undefined {
    return this.#values.get(name) ?? this.envFallbacks[name];
  }

  /** Renvoie la fonction de désabonnement. */
  onChange(listener: (name: SecretName) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  list(): SecretStatus[] {
    return SECRET_NAMES.map((name) => {
      const fromDashboard = this.#values.get(name);
      const value = this.get(name);
      return {
        name,
        isSet: value !== undefined,
        last4: value?.slice(-4) ?? null,
        source: fromDashboard ? 'dashboard' : value ? 'env' : null,
      };
    });
  }

  set(name: SecretName, value: string): void {
    const ciphertext = encryptSecret(value, this.#key, name);
    this.db
      .insert(secrets)
      .values({ name, ciphertext })
      .onConflictDoUpdate({ target: secrets.name, set: { ciphertext, updatedAt: new Date() } })
      .run();
    this.#values.set(name, value);
    this.logBus.push('system', `${SECRET_LABELS[name]} enregistré.`);
    this.#notify(name);
  }

  remove(name: SecretName): void {
    this.db.delete(secrets).where(eq(secrets.name, name)).run();
    this.#values.delete(name);
    this.logBus.push('system', `${SECRET_LABELS[name]} supprimé.`);
    this.#notify(name);
  }

  #notify(name: SecretName): void {
    for (const listener of this.#listeners) listener(name);
  }
}
