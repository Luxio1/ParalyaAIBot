import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 12;

const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[a-zA-Z0-9_.-]{3,32}$/,
    'Identifiant : 3 à 32 caractères parmi lettres, chiffres, « _ », « . » et « - ».',
  );

/** Le plafond évite de faire hasher des mégaoctets à argon2. */
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mot de passe : ${PASSWORD_MIN_LENGTH} caractères minimum.`)
  .max(256, 'Mot de passe : 256 caractères maximum.');

export const setupRequestSchema = z.object({
  setupCode: z.string().trim().min(1, "Code d'installation requis.").max(64),
  username: usernameSchema,
  password: passwordSchema,
});
export type SetupRequest = z.infer<typeof setupRequestSchema>;

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(32),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const authStateSchema = z.object({
  needsSetup: z.boolean(),
  user: z.object({ username: z.string() }).nullable(),
});
export type AuthState = z.infer<typeof authStateSchema>;
