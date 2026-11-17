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
- [x] **J3 Pipeline & IA** — modes Mention/Préfixe (+ Reply sur le bot), préfixe, whitelist, MP, dédup, typing, découpage 2000, mentions, providers, modèle, persona + presets. *Validation : réponses correctes dans chaque mode.*
- [x] **J4 Mémoire & enrichissements** — SessionStore, moniteur + purge, message cité, vision, liens, `safeFetch`. *Validation : conversation suivie, image et lien analysés.*
- [x] **J5 Commandes** — CRUD + dupliquer, statique / IA, repli IA, aide préfixe seul, restauration des exemples.
- [x] **J6 Rate limit & relais MP** — quota/cooldown, avertissement/silence, exemptions, DM relay.
- [x] **J7 Moteur d'événements** — règles, évaluation groupée (modèle rapide configurable), filtres, cooldowns, actions, variables, anti-doublon, testeur.
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

### J3 Pipeline & IA (2026-11-17)
- **`@google/genai` 2.32** et non 3.4 : la 3.4 avait moins d'un jour et pnpm refuse les versions trop récentes (`minimumReleaseAge`), une protection contre les paquets compromis qu'on garde active. Ses scripts d'installation (`@google/genai`, `protobufjs`) sont refusés dans `allowBuilds`, ils ne servent pas à l'exécution.
- **Réglages en JSON** dans `bot_settings.config`, validés par `botConfigSchema` et complétés par `DEFAULT_BOT_CONFIG` à la lecture : un réglage ajouté plus tard ne demande pas de migration. `ConfigService` les garde en mémoire ; le pipeline les relit à chaque message (application à chaud).
- **Pipeline indépendant de Discord** : `core/pipeline` reçoit un `IncomingMessage` et répond par un `Transport`. L'adaptateur Discord retire la mention du bot, résout les autres mentions avec `cleanContent` de discord.js, et ramène un fil à son salon parent pour la liste blanche.
- **Déclenchement** : la mention couvre aussi « Répondre » sur un message du bot (`mentions.repliedUser`) et la mention du rôle automatique du bot. Le préfixe est retiré de la question, y compris en MP. Déclencheur seul : message d'aide, sans appel à l'IA.
- **Aucune mention dans les réponses** (`allowedMentions: { parse: [] }`) : l'IA ne peut pas notifier `@everyone`, un rôle ou un membre. Seul l'auteur de la question est notifié par la réponse.
- **Erreurs de l'IA** : les utilisateurs Discord voient une phrase neutre ; la cause traduite (clé absente ou refusée, quota, modèle inconnu, indisponibilité, réponse vide) va dans la console.
- **Pas de nettoyage des réponses par expressions régulières** (contrairement à l'ancien `cleanAiReply`) : la consigne « sans préambule » est ajoutée au persona.
- **Modèles** : liste lue chez Google (`models.list`, modèles `gemini*` qui acceptent `generateContent`), en cache 10 min et vidée quand la clé change. Pas de liste figée dans le code.
- **Découpage à 2000 caractères** (`lib/chunkText.ts`) : saut de ligne, sinon espace ; un bloc de code coupé est refermé puis rouvert avec son langage ; un emoji n'est jamais coupé en deux.
- **Indicateur d'écriture** renvoyé toutes les 8 s pendant la génération (Discord l'efface après 10 s).
- **Pas de mémoire** : chaque message est traité seul jusqu'au J4. Le nom de l'interlocuteur et le salon sont déjà donnés à l'IA.

### J4 Mémoire & enrichissements (2026-11-17)
- **Mémoire en RAM** (`core/memory/sessionStore.ts`), jamais écrite sur le disque, vidée au redémarrage. Une conversation par personne en MP (`dm:<utilisateur>`) et par couple salon parent et personne sur un serveur (`guild:<salon>:<utilisateur>`). Réglages `memoryEnabled`, `memoryRetentionMinutes` (5 à 1440, 30 par défaut) et `memoryMaxMessages` (4 à 20, 10 par défaut). L'historique commence toujours par un message de l'utilisateur. Seul le texte est gardé : les images et pages sont seulement mentionnées. Désactiver la mémoire la vide.
- **Moniteur** : `GET /api/memory/sessions` ne renvoie que des métadonnées (personne, salon, nombre de messages, expiration), jamais le contenu. Événement `memory:changed` sur le WebSocket ; nettoyage des conversations expirées toutes les 30 s.
- **`safeFetch`** (`lib/safeFetch.ts`, `node:http(s)` sans dépendance) : http(s) sur les ports par défaut, pas d'identifiants dans l'URL, `BlockList` des plages privées, locales et réservées (IPv4, IPv6, IPv4 encapsulé) vérifiée dans le `lookup` de la connexion (pas de DNS rebinding) et sur les IP littérales, 3 redirections revérifiées, 8 s, taille lue en flux (2 Mo pour une page, 8 Mo pour une image). Vérifié sur de vrais sites : redirection suivie, `localtest.me` (public, pointe vers ::1) refusé.
- **Enrichissements après la décision de répondre** (`core/enrich/context.ts`) : l'ancienne version téléchargeait images et liens pour chaque message reçu. Au plus 4 images et 3 liens ; le message cité ne fournit images et liens que si la question n'en a pas.
- **Vision** : PNG, JPEG, WebP, HEIC et HEIF (formats acceptés par Gemini), 8 Mo au plus ; GIF et SVG ignorés avec la raison dans la console et dans le prompt.
- **Pages web** : `node-html-parser` 9.0.6 (la 9.0.7 avait moins de deux semaines) plutôt que les expressions régulières de l'ancienne version. Titre, description, texte de `main`/`article` sinon `body`, sans scripts, menus ni pied de page, limité à 4 000 caractères. User-Agent honnête (`compatible; ParalyaAIBot`).
- **Injection de consignes** : message cité et pages sont placés dans des blocs `<donnees source="...">` que leur contenu ne peut pas refermer, et le prompt système interdit d'obéir aux instructions qu'ils contiennent.
- **Interlocuteur** : pseudo et identifiant (`@username`) donnés à l'IA. Une image ou une réponse à un message sans texte obtient une réponse au lieu du message d'aide.

### J5 Commandes (2026-11-17)
- **Table `commands`** (et non un tableau dans le JSON des réglages) : chaque commande a un identifiant pour l'édition, et le nom est unique en base. `CommandService` les garde en mémoire ; une modification s'applique au message suivant.
- **Exemples installés une seule fois** (`bot_settings.commands_seeded`) : supprimés, ils ne reviennent pas au redémarrage. « Restaurer les exemples » recrée les manquants et remet à zéro ceux qui portent le même nom, sans toucher aux autres commandes.
- **Noms** : 1 à 32 lettres (accents compris), chiffres, `_` ou `-`, rangés en minuscules (`!Regles` fonctionne). 100 commandes au plus.
- **Appel par le préfixe uniquement**, sur serveur comme en MP. Une commande inconnue ou désactivée, ou un nom écrit après une mention, part à l'IA comme une question. Une commande IA sans texte s'applique au message cité, sinon le bot rappelle son usage.
- **Variables des réponses statiques** : `{commands}` (liste générée des commandes actives, que l'ancien `!help` écrivait à la main), `{prefix}`, `{user}`. Le préfixe seul affiche aussi cette liste.
- **Modèle IA sans `{query}`** : le texte de l'utilisateur est ajouté à la fin au lieu d'être perdu. La consigne de la commande remplace le persona ; mémoire, images, liens et message cité s'appliquent comme pour une question libre. La mémoire garde l'appel tel qu'écrit (`!traduis bonjour`).
- **Duplication** : la copie (`nom-copie`, `nom-copie-2`...) est désactivée, pour ne pas répondre deux fois avant d'avoir été modifiée.

### J6 Rate limit & relais MP (2026-11-17)
- **Quota en fenêtre glissante** (`core/ratelimit/rateLimiter.ts`) : N questions par période de X secondes et par personne (3 par 60 s par défaut, 1 à 50 et 5 à 3 600 s), serveurs et MP confondus. L'ancien compteur ne se réinitialisait qu'après un blocage : trois questions espacées sur une journée suffisaient. Les messages refusés ne prolongent pas le blocage.
- **Tout ce à quoi le bot répond compte**, commandes statiques comprises ; le message d'aide (préfixe seul) ne compte pas.
- **Avertissement unique** par période de blocage, avec le temps restant, ou silence (`rateLimitNotify`). L'ancien bot répondait à chaque message bloqué, ce qui amplifiait le spam. La console note le premier refus.
- **Exemptions** : propriétaires de serveur (toujours, sans réglage), rôles par ID (`bypassRoleIds`, renommer un rôle ne casse rien), utilisateurs par ID ou nom d'utilisateur Discord unique (`bypassUsers`, `@Pseudo` rangé en `pseudo`). Plus d'exemption par pseudo d'affichage, que chacun peut changer. En MP, les rôles sont demandés à Discord (`members.fetch`, sans intent privilégié) et gardés 5 minutes.
- **Retranscription des MP** (`adapters/discord/dmRelay.ts`) : tous les MP reçus, même quand le bot n'y répond pas, et chaque réponse du bot en MP (y compris avertissements et commandes). Citations Markdown, pièces jointes en liens, découpage à 2 000 caractères, `allowedMentions: { parse: [] }` : un MP contenant `@everyone` ne notifie plus tout le salon du staff. Salon obligatoire quand le relais est activé ; un salon inaccessible est signalé dans la console.
- **`MessagePipeline`** reçoit ses dépendances dans un objet (`PipelineDeps`) ; `Transport.isExempt(roleIds)` laisse l'adaptateur vérifier propriétaires et rôles.

### J7 Moteur d'événements (2026-11-17)
- **Coût borné** (`core/events/eventEngine.ts`) : un seul appel par message pour toutes les règles, et seulement après tri (moteur actif, message de serveur, au moins 3 lettres hors liens, règle active qui surveille le salon, personne hors délai de la règle). Budget d'analyses par minute (`eventsMaxPerMinute`, 30 par défaut) en fenêtre fixe, dépassement signalé une fois. Modèle d'analyse séparé (`eventsModel`, Flash-Lite par défaut). Textes rédigés par l'IA seulement au déclenchement.
- **Rien d'actif par défaut** : `eventsEnabled` faux, les 4 exemples installés une fois (`bot_settings.events_seeded`) et désactivés, leur salon d'alerte restant à choisir.
- **Réponse structurée** : `responseJsonSchema` de Gemini (`AiRequest.jsonSchema`), puis validation Zod ; une règle absente de la réponse ne se déclenche pas. L'ancien code nettoyait le JSON à la main et échouait en silence.
- **Règles** : table `event_rules` avec une colonne `definition` (`EventRuleInput` en JSON, validé à la lecture, une règle illisible est signalée et ignorée). Actions MP et salon indépendantes (l'ancien `actionType` dm/channel/both). Validation : au moins une action, destinataire, salon d'alerte et texte requis selon les choix. 50 règles au plus.
- **Mentions** : seul `channel.mentionRoleId` peut notifier (`allowedMentions.roles`) ; les variables (`{user}` est du texte) et `{message}` ne notifient personne. L'ancien `channelMentionRole` était du texte qui ne notifiait pas, et `{message}` pouvait relayer `@everyone`.
- **MP aux membres d'un rôle** : intent privilégié « Server Members » (`membersIntent`), interrupteur placé dans les réglages du moteur (page Événements) plutôt que dans Paramètres, plus proche de son usage. Le changer reconnecte le bot (`ConfigService.onChange`). Liste des membres rechargée au plus toutes les 10 minutes, 10 destinataires au plus par alerte, un refus de MP n'arrête pas les autres envois.
- **Serveurs uniquement** : les MP ne sont pas analysés (la retranscription du J6 les couvre). Texte seulement, pas d'images.
- **Anti-doublon** : l'action dans le salon d'origine est sautée quand le bot répond déjà au message (`extractTrigger`).
- **Testeur** (`POST /api/events/test`) : toutes les règles, actives ou non, sans filtre ni délai ; aperçu des textes écrits à l'avance, les textes IA ne sont pas générés.
- **`container.ts`** assemble les services pour `index.ts` et les tests (`createTestApp`), qui dupliquaient le câblage ; `dataBlock` et sa consigne sont partagés (`core/ai/promptData.ts`).
