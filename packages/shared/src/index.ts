import { z } from 'zod';
import { fr } from 'zod/locales';

/** Messages de validation Zod en français, côté serveur comme côté dashboard. */
z.config(fr());

export * from './constants';
export * from './schemas/api';
export * from './schemas/auth';
export * from './schemas/bot';
export * from './schemas/health';
export * from './schemas/logs';
export * from './schemas/realtime';
export * from './schemas/secrets';
