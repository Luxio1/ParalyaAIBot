import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'legacy/**',
      'scripts/**',
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'data/**',
      'apps/server/src/db/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/server/**/*.ts', '*.config.{js,ts}', 'apps/*/*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Règle d'architecture n°1 : le cœur ne dépend jamais de discord.js ni de Fastify.
    files: ['apps/server/src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['discord.js', 'discord.js/*', '@discordjs/*', 'fastify', '@fastify/*'],
              message:
                "core/ ne doit dépendre ni de discord.js ni de Fastify : passer par l'interface Transport.",
            },
            {
              group: ['**/adapters/**', '**/http/**'],
              message: 'core/ ne doit pas importer les adaptateurs ni la couche HTTP.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  prettier,
);
