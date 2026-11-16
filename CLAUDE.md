# CLAUDE.md — Refonte « Discord AI Bot Studio »

## Contexte
Refonte complète d'un bot Discord propulsé par l'IA, piloté par un dashboard web.
- `legacy/` = ancienne app (export Google AI Studio). **Lecture seule, référence uniquement.** Ne jamais la modifier ni l'importer.
- `docs/CAHIER_DES_CHARGES.md` = exigences fonctionnelles (source de vérité).
- `docs/REFONTE.md` = audit de l'existant, architecture cible, jalons, décisions. À lire avant toute tâche.
- La langue de l'UI, des logs et des messages du bot est le **français**.

## Méthode de travail
- On avance **jalon par jalon** (voir `docs/REFONTE.md` §4). Ne pas commencer un jalon sans validation explicite de l'utilisateur.
- Au début d'un jalon : proposer un plan court (fichiers à créer/modifier) et attendre l'accord.
- À la fin d'un jalon : `pnpm lint && pnpm typecheck && pnpm test` doivent passer ; cocher le jalon dans `docs/REFONTE.md` et noter les décisions prises dans §5.
- Réutiliser la logique éprouvée de `legacy/server.ts` (résolution de mentions, découpage 2000 caractères, extraction HTML, prompts, presets, commandes/règles d'exemple) en la portant proprement dans `apps/server/src/core/`.

## Règles d'architecture (non négociables)
1. `apps/server/src/core/**` ne dépend **jamais** de `discord.js` ni de Fastify. Il parle à une interface `Transport`.
2. Le simulateur web passe par **le même `MessagePipeline`** que Discord (via `PlaygroundTransport`). Aucune logique dupliquée.
3. Toute config est persistée en base côté serveur. Aucun état métier dans le `localStorage` (seules des préférences d'affichage sont tolérées).
4. Les schémas Zod de `packages/shared` sont la source unique des types (front, API, DB).
5. Un changement de config s'applique à chaud ; le client Discord ne se reconnecte que si le token change.

## Règles de sécurité (non négociables)
- Les secrets (token Discord, clés IA) sont chiffrés en base (AES-256-GCM, clé `APP_SECRET`) et **ne sont jamais renvoyés au front** (uniquement un masque `••••1234`).
- Toutes les routes `/api/**` et le WebSocket exigent une session authentifiée (sauf `/api/auth/*` et `/healthz`).
- Toute requête sortante vers une URL fournie par un utilisateur passe par `lib/safeFetch` (blocage IP privées/loopback/link-local, y compris après résolution DNS et redirections ; timeout ; taille max ; MIME filtrés).
- Les médias et liens ne sont téléchargés **qu'après** avoir décidé que le bot prend en charge le message.
- Ne jamais logger un secret.

## Conventions
- TypeScript strict, ESM, Node 22+, pnpm workspaces.
- Nommage : fichiers `camelCase.ts`, composants React `PascalCase.tsx`.
- Tests Vitest à côté du code du cœur (`*.test.ts`).
- Commits conventionnels (`feat:`, `fix:`, `refactor:`…), un commit par étape cohérente.

## Commandes (à compléter au jalon J0)
- `pnpm dev` — server + web en mode watch
- `pnpm build` / `pnpm start`
- `pnpm lint`, `pnpm typecheck`, `pnpm test`
- `pnpm db:migrate`, `pnpm db:generate`
- `docker compose up --build`
