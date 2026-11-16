# Refonte — Audit, architecture et plan

## 1. Audit de l'existant (`legacy/`)

Export Google AI Studio : Express + discord.js v14 + Gemini (`@google/genai`), front React 19 + Vite + Tailwind 4.
~6 700 lignes concentrées dans `server.ts` (2 253), `src/App.tsx` (2 562), `EventManager.tsx`, `CustomCommandsManager.tsx`, `types.ts`.

### Failles critiques
1. **Token exposé** : `GET /api/bot/status` renvoie `currentConfig` complet (token inclus) ; aucune authentification sur l'API.
2. **SSRF** : la lecture de liens/images (`inspectAndFetchUrl`, `fetchImageAsBase64`) fetch n'importe quelle URL postée par un membre Discord (localhost, 169.254.169.254…).

### Problèmes structurels
3. Config stockée uniquement dans le `localStorage` ; renvoyée au serveur à chaque `/api/bot/start`. Après redémarrage serveur → bot hors ligne jusqu'à réouverture du dashboard.
4. Simulateur (`/api/bot/test-message`) = réimplémentation parallèle des commandes/mémoire/règles → divergences.
5. `resolveMessageMediaAndLinks` est appelé sur **tous** les messages de tous les salons avant de savoir si le bot répond.
6. Gemini seul ; clé uniquement via env ; modèles codés en dur (`getValidGeminiModel`).
7. Temps réel par polling 1,5 s (status + logs + sessions).
8. Divers : `bypassRoles` comparés aussi aux pseudos ; propriétaire de *n'importe quel* serveur commun = exempté partout ; port 3000 figé ; body JSON 50 Mo ; `cleanAiReply` à base de regex.

### À réutiliser (porter dans `core/`)
`resolveDiscordMentions`, `splitDiscordMessage`, `extractHtmlText`, `extractUrlsFromText`, prompt d'évaluation groupée des règles (un appel JSON par message), prompts d'interlocuteur/vision/liens, `PERSONA_PRESETS` (App.tsx), commandes et règles d'exemple (`server.ts` `currentConfig`), types de `src/types.ts`.

## 2. Décisions retenues
| Sujet | Défaut retenu | Statut |
|---|---|---|
| IA | Abstraction `AiProvider`, Gemini en premier ; 2ᵉ provider ultérieurement ; clé saisie dans le dashboard (chiffrée) avec repli sur `.env` | ☑ confirmé (2026-11-16) |
| Hébergement | Image Docker unique (API + bot + front buildé), volume `/data` | ☑ confirmé (2026-11-16) |
| Auth dashboard | Un compte admin (argon2, cookie httpOnly, anti-bruteforce) ; table `users` prête pour multi-admin | ☑ confirmé (2026-11-16) |
| Base | SQLite + Drizzle (schéma compatible Postgres) | ☑ confirmé (2026-11-16) |
| Migration | Script `scripts/export-legacy-config.js` + écran d'import | ☑ confirmé (2026-11-16) |

## 3. Architecture cible

**Stack** : TypeScript monorepo pnpm · discord.js v14 · Fastify + `@fastify/websocket` · Zod · Drizzle + SQLite · React 19 + Vite + TanStack Query + Tailwind 4 (+ shadcn/ui) · Vitest.

**Principe** : un `MessagePipeline` pur reçoit un `IncomingMessage` normalisé et répond via un `Transport` abstrait (`reply`, `sendDM`, `sendToChannel`, `typing`). Deux implémentations : `DiscordTransport` et `PlaygroundTransport`.

```
Discord ─▶ DiscordTransport ─┐
Web     ─▶ PlaygroundTransport ─▶ MessagePipeline ◀── ConfigService (snapshot RAM ⇄ SQLite)
                                   ├ dedup → triggers → whitelist/MP
                                   ├ RateLimiter (+ exemptions)
                                   ├ CommandRouter (statique / IA / repli)
                                   ├ Enrichers (mentions, reply, vision, liens via safeFetch)
                                   ├ SessionStore (TTL, max messages)
                                   ├ AiService → providers/*
                                   └ RuleEngine (évaluation groupée → actions dm/channel/both)
                                 LogBus ─▶ WebSocket ─▶ console live
```

```
ParalyaAIBot/
├─ apps/
│  ├─ server/src/
│  │  ├─ index.ts            # bootstrap : env → DB → services → HTTP → bot (autostart)
│  │  ├─ env.ts
│  │  ├─ db/                 # schema.ts, client.ts, migrations/, seed.ts
│  │  ├─ services/           # ConfigService, SecretsService, AuthService
│  │  ├─ core/               # aucune dépendance discord.js / Fastify
│  │  │  ├─ pipeline/  commands/  events/  ratelimit/  memory/
│  │  │  ├─ ai/              # AiService, providers/, presets.ts
│  │  │  ├─ enrich/          # mentions, replyContext, vision, linkReader
│  │  │  └─ logs/            # LogBus + buffer circulaire
│  │  ├─ adapters/discord/   # BotManager, DiscordTransport, discovery, dmRelay
│  │  ├─ adapters/playground/
│  │  ├─ http/               # app.ts, routes/, ws.ts
│  │  └─ lib/                # crypto, safeFetch, chunkText
│  └─ web/src/               # pages/, components/, api/, hooks/useRealtime.ts
├─ packages/shared/          # schémas Zod, types, constantes
├─ docker/Dockerfile · docker-compose.yml
├─ .vscode/                  # launch.json, extensions.json, settings.json
├─ legacy/                   # ancienne app (référence)
└─ .env.example · pnpm-workspace.yaml · README.md
```

## 4. Jalons
- [x] **J0 Fondations** *(terminé le 2026-11-16 ; `docker compose up` reste à vérifier, Docker absent du poste de dev)* — monorepo, TS strict, ESLint/Prettier, `packages/shared`, Drizzle + migrations, env validé, Dockerfile, debug VS Code. *Validation : `pnpm dev` et `docker compose up` démarrent.*
- [ ] **J1 Sécurité & config** — auth, secrets chiffrés, `ConfigService` + API CRUD, WebSocket, LogBus + console live, `safeFetch`. *Validation : dashboard protégé, config persistée après redémarrage, aucun secret dans les réponses API.*
- [ ] **J2 Cycle de vie du bot** — `BotManager` start/stop/hot-apply, statut temps réel, découverte serveurs/salons/rôles, lien OAuth2, autostart. *Validation : bot piloté depuis l'UI, config modifiée sans reconnexion.*
- [ ] **J3 Pipeline & IA** — modes Mention/Préfixe (+ Reply sur le bot), préfixe, whitelist, MP, dédup, typing, découpage 2000, mentions, providers, modèle, persona + presets. *Validation : réponses correctes dans chaque mode.*
- [ ] **J4 Mémoire & enrichissements** — SessionStore, moniteur + purge, message cité, vision, liens. *Validation : conversation suivie, image et lien analysés.*
- [ ] **J5 Commandes** — CRUD + dupliquer, statique / IA, repli IA, aide préfixe seul, restauration des exemples.
- [ ] **J6 Rate limit & relais MP** — quota/cooldown, avertissement/silence, exemptions, DM relay.
- [ ] **J7 Moteur d'événements** — règles, évaluation groupée (modèle rapide configurable), filtres, cooldowns, actions, variables, anti-doublon, testeur.
- [ ] **J8 Playground & Guide** — simulateur sur le pipeline commun, onglet Guide Developer Portal.
- [ ] **J9 Durcissement & déploiement** — tests, import legacy, sauvegarde DB, README déploiement VPS/Railway/Fly, revue sécurité.

## 5. Journal des décisions
### J0 — Fondations (2026-11-16)
- **Décisions §2 confirmées** par l'utilisateur. Modèle IA par défaut : Gemini 3.1 Flash-Lite (`DEFAULT_AI_MODEL` dans `packages/shared`, modifiable dans le dashboard à partir de J3).
- **TypeScript 6.0** (et non 7) : `typescript-eslint` 8 n'accepte pas encore TS 7.
- **`packages/shared` n'est pas buildé** : ses `exports` pointent vers `src/index.ts`. Vite le consomme directement ; `tsup` l'intègre au bundle serveur (`noExternal`). Il est donc en `devDependencies` des apps.
- **Pilote SQLite : `better-sqlite3`** (binaires précompilés, fonctionne sous Node 22 à 26, Windows et Linux). Base dans `DATA_DIR/bot.db`, mode WAL, migrations appliquées automatiquement au démarrage (`dist/migrations` copié au build).
- **Configuration** : `.env` à la racine, chargé par `process.loadEnvFile` (pas de dépendance dotenv), validé par Zod (`apps/server/src/env.ts`). `APP_SECRET` ≥ 32 caractères obligatoire, sinon arrêt avec message explicite. Les chemins relatifs sont résolus depuis la racine du monorepo.
- **Ports** : API 3000 (`PORT`), Vite 5173 en dev avec proxy `/api`, `/healthz`, `/ws`. En production un seul port sert l'API et le dashboard (`WEB_DIST_DIR`, repli SPA).
- **Règle d'architecture n°1 outillée** : ESLint `no-restricted-imports` interdit `discord.js`, Fastify, `adapters/` et `http/` dans `apps/server/src/core/**`.
- **pnpm 12** : les scripts d'installation autorisés sont listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- **Docker** : image `node:22-slim` multi-étapes, utilisateur non-root, `HEALTHCHECK` sur `/healthz`. L'étape `pnpm deploy --prod --legacy` a été vérifiée localement ; **le build de l'image lui-même n'a pas pu être testé** (Docker non installé) → à faire dès que Docker est disponible, au plus tard en J9.
- **Reporté à J1** : en-têtes de sécurité (`@fastify/helmet`, CSP), auth, tables de configuration et de secrets.
