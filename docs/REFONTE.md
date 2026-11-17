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
- [x] **J1 Sécurité & config** — auth, secrets chiffrés, API secrets, WebSocket, LogBus + console live. *Validation : dashboard protégé, config persistée après redémarrage, aucun secret dans les réponses API.*
- [x] **J2 Cycle de vie du bot** — `BotManager` start/stop, reconnexion au changement de token, statut temps réel, découverte serveurs/salons/rôles, lien OAuth2, autostart. *Validation : bot piloté depuis l'UI ; « config modifiée sans reconnexion » se vérifie en J3, premier jalon avec des réglages.*
- [ ] **J3 Pipeline & IA** — modes Mention/Préfixe (+ Reply sur le bot), préfixe, whitelist, MP, dédup, typing, découpage 2000, mentions, providers, modèle, persona + presets. *Validation : réponses correctes dans chaque mode.*
- [ ] **J4 Mémoire & enrichissements** — SessionStore, moniteur + purge, message cité, vision, liens, `safeFetch`. *Validation : conversation suivie, image et lien analysés.*
- [ ] **J5 Commandes** — CRUD + dupliquer, statique / IA, repli IA, aide préfixe seul, restauration des exemples.
- [ ] **J6 Rate limit & relais MP** — quota/cooldown, avertissement/silence, exemptions, DM relay.
- [ ] **J7 Moteur d'événements** — règles, évaluation groupée (modèle rapide configurable), filtres, cooldowns, actions, variables, anti-doublon, testeur.
- [ ] **J8 Playground & Guide** — simulateur sur le pipeline commun, onglet Guide Developer Portal.
- [ ] **J9 Durcissement & déploiement** — tests, import legacy, sauvegarde DB, README déploiement VPS/Railway/Fly, revue sécurité.

## 5. Journal des décisions
### J0 Fondations (2026-11-16)
- **Décisions §2 confirmées** par l'utilisateur. Modèle IA par défaut : Gemini 3.1 Flash-Lite (`DEFAULT_AI_MODEL` dans `packages/shared`, modifiable dans le dashboard à partir de J3).
- **TypeScript 6.0** (et non 7) : `typescript-eslint` 8 n'accepte pas encore TS 7.
- **`packages/shared` n'est pas buildé** : ses `exports` pointent vers `src/index.ts`. Vite le consomme directement ; `tsup` l'intègre au bundle serveur (`noExternal`). Il est donc en `devDependencies` des apps.
- **Pilote SQLite : `better-sqlite3`** (binaires précompilés, fonctionne sous Node 22 à 26, Windows et Linux). Base dans `DATA_DIR/bot.db`, mode WAL, migrations appliquées automatiquement au démarrage (`dist/migrations` copié au build).
- **Configuration** : `.env` à la racine, chargé par `process.loadEnvFile` (pas de dépendance dotenv), validé par Zod (`apps/server/src/env.ts`). `APP_SECRET` ≥ 32 caractères obligatoire, sinon arrêt avec message explicite. Les chemins relatifs sont résolus depuis la racine du monorepo.
- **Ports** : API 3000 (`PORT`), Vite 5173 en dev avec proxy `/api`, `/healthz`, `/ws`. En production un seul port sert l'API et le dashboard (`WEB_DIST_DIR`, repli SPA).
- **Règle d'architecture n°1 outillée** : ESLint `no-restricted-imports` interdit `discord.js`, Fastify, `adapters/` et `http/` dans `apps/server/src/core/**`.
- **pnpm 12** : les scripts d'installation autorisés sont listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- **Docker** : image `node:22-slim` multi-étapes, utilisateur non-root, `HEALTHCHECK` sur `/healthz`. L'étape `pnpm deploy --prod --legacy` a été vérifiée localement ; **le build de l'image lui-même n'a pas pu être testé** (Docker non installé). À faire dès que Docker est disponible, au plus tard en J9.
- **Reporté à J1** : en-têtes de sécurité (`@fastify/helmet`, CSP), auth, tables de configuration et de secrets.

### J1 Sécurité & config (2026-11-16)
- **`safeFetch` déplacé en J4**, avec la lecture de liens et d'images qui en est le premier appelant. La règle de sécurité du CLAUDE.md reste inchangée.
- **Pas de table de configuration générique** : seuls les secrets sont persistés en J1. Chaque groupe de réglages du bot aura sa table au jalon qui l'utilise (J2, J3...).
- **Premier compte** : tant qu'aucun admin n'existe, le serveur écrit dans ses logs un code d'installation à usage unique (12 caractères, régénéré à chaque démarrage), exigé par `POST /api/auth/setup`. Sans lui, la première personne qui atteint un serveur fraîchement déployé pourrait s'approprier le dashboard.
- **Mots de passe** : argon2id via `@node-rs/argon2` (binaire précompilé, paramètres par défaut conformes à l'OWASP), 12 caractères minimum. Un identifiant inconnu coûte un hash comme un vrai pour ne pas révéler les comptes par le temps de réponse.
- **Sessions** : jeton aléatoire de 256 bits dans un cookie `HttpOnly`, `SameSite=Strict`, `Secure` seulement si la requête arrive en HTTPS (sinon le dashboard serait inutilisable sur un VPS sans certificat). Seul le SHA-256 du jeton est stocké. Expiration après 7 jours d'inactivité, 30 jours au maximum. Changer le mot de passe ferme les autres sessions ; le WebSocket revérifie sa session chaque minute.
- **Anti-CSRF** : `SameSite=Strict` plus refus (403) de toute requête modifiante ou connexion WebSocket dont l'en-tête `Origin` ne correspond pas à l'hôte. Sans `Origin` (curl, scripts), la requête passe.
- **Anti-bruteforce** : 5 tentatives par minute et par IP sur `setup`, `login` et `password` (`@fastify/rate-limit`). Derrière un reverse proxy, `TRUST_PROXY=true` est nécessaire pour voir la vraie IP.
- **Secrets** : AES-256-GCM, clé dérivée d'`APP_SECRET` par HKDF-SHA256, IV aléatoire, nom du secret en donnée authentifiée (un chiffré copié vers une autre ligne ne se déchiffre pas). Déchiffrés une fois au démarrage et gardés en mémoire ; un secret illisible (APP_SECRET changé) est signalé dans la console et considéré comme absent. L'API n'expose que `{ isSet, last4, source }`. `GEMINI_API_KEY` du `.env` sert de repli (`source: "env"`).
- **Helmet** : CSP par défaut sans `upgrade-insecure-requests` (même raison que `Secure`).
- **Logs de la console** : en mémoire uniquement (500 entrées), perdus au redémarrage. Le client reçoit `logs:snapshot` à la connexion puis chaque `log` ; pas de route `GET /api/logs`.
- **Validation Zod en français** (`zod/locales`), configurée dans `packages/shared` pour le serveur et le dashboard.
- **Dashboard** : React Router 8, composants shadcn/ui réduits aux modules Radix utilisés (`@radix-ui/react-slot`, `@radix-ui/react-label`) ; le paquet `radix-ui` complet tirait une dépendance manquante (`tslib`). Thème sombre unique.

### J2 Cycle de vie du bot (2026-11-17)
- **discord.js 14.28** (la v15 est encore en développement). Intents `Guilds`, `GuildMessages`, `MessageContent` (seul intent privilégié) et `DirectMessages`, avec le partial `Channel` sans lequel les MP n'arrivent pas.
- **Pas de saisie de l'ID d'application** : il est lu sur le client connecté (`client.application.id`) pour construire le lien d'invitation. Le champ prévu par le cahier des charges est supprimé.
- **Démarrage automatique** : `bot_settings.auto_start` vaut vrai après « Démarrer », faux après « Arrêter ». Au démarrage du serveur, le bot se reconnecte s'il était censé tourner. Pas d'interrupteur séparé.
- **Changement de token** : si le bot est censé tourner, il se reconnecte avec le nouveau token. Un bot en erreur faute de token démarre donc dès que le token est enregistré.
- **File d'opérations** dans `BotManager` : démarrage, arrêt, reconnexion et fermeture définitive s'exécutent l'un après l'autre, sans état intermédiaire incohérent.
- **Erreurs traduites** : token refusé (`TokenInvalid` ou code 4004) et intent non activé (code 4014) donnent une consigne précise ; les autres erreurs sont affichées telles quelles. Les reconnexions automatiques de discord.js passent l'état à « Connexion ».
- **Permissions d'invitation** : voir les salons, envoyer des messages (y compris dans les fils), lire l'historique (`274877975552`). La mention des rôles non mentionnables sera évaluée en J7.
- **Temps réel** : le statut est poussé sur le WebSocket (`bot:status`, envoyé à la connexion, à chaque changement et quand la latence change, vérifiée toutes les 30 s). La découverte reste une route (`GET /api/bot/discovery`) que le client relit sur `bot:discovery-changed` (serveur rejoint ou quitté, salon ou rôle modifié).
- **Tests** : un faux client (`fakeDiscordClient.ts`) remplace discord.js, sans réseau. Testé à la main contre Discord avec un token invalide.
- **CSP** : `img-src` autorise `https://cdn.discordapp.com` pour les avatars et icônes de serveurs.
