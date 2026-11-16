# CLAUDE.md : refonte « Paralya AI Bot »

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
- Formatage : Prettier du dépôt (2 espaces, guillemets simples). Il prime sur toute préférence personnelle d'indentation.

## Style de code

### Écrire pour le prochain lecteur
Celui qui lira ce code n'a pas ton contexte et ouvre le fichier pour une seule réponse. Quand aucune règle ne tranche, choisir la version qui lui coûte le moins :
1. Peut-il répondre sans quitter le fichier ? Les noms, les types et la structure portent l'information.
2. Qu'est-ce qui est impossible à deviner ? Seulement cela mérite un commentaire.
3. Que doit-il garder en tête ? Chaque branche, variable mutable, indirection ou booléen anonyme occupe sa mémoire de travail (5 à 7 éléments).

Interdits :
- **Paraphraser le code** dans un commentaire ou une JSDoc.
- **Code défensif inutile** : pas de vérification que les types garantissent déjà, pas de `try/catch` sans récupération, pas de valeur par défaut pour un état impossible. Faire confiance à TypeScript strict et aux schémas Zod (la validation se fait aux frontières : env, HTTP, Discord, réponses IA).
- **Abstraire pour un appelant qui n'existe pas** : wrapper, registre, flag, interface à une seule implémentation. Exception assumée : `Transport` et `AiProvider`, qui ont chacun deux implémentations prévues.

En cas de doute sur un commentaire, un helper ou un paramètre : ne pas l'ajouter.

Écrire en deux passes : d'abord le code sans commentaires, puis le relire comme le prochain développeur et n'annoter que ce qui surprend.

### Pas de sur-ingénierie
- Retours anticipés plutôt que `if/else` imbriqués.
- Pas de helper, classe ou convertisseur appelé une seule fois : code direct et linéaire d'abord.
- Préférer `map`, `filter`, `some`, `every`, `Object.fromEntries` et les ternaires aux boucles avec accumulateur, sauf si l'expression devient illisible.
- `readonly`, `as const` et `const` par défaut ; un objet de configuration n'est jamais muté.
- Pas de booléen anonyme en argument : un objet nommé (`{ includeArchived: true }`) ou une union de chaînes.
- Une fonction s'écrit en paragraphes (ligne vide quand la question du lecteur change). Une fonction qui aurait besoin de cinq commentaires de section est cinq fonctions.
- Dans une classe ou un module, ordre descendant : le point d'entrée public d'abord, puis ce qu'il appelle.

### Chaque changement a un budget de lignes
- **Chercher avant d'écrire** : dans le dépôt, `packages/shared`, les dépendances et la bibliothèque standard de Node.
- **Remplacer, jamais en parallèle** : le code supplanté est supprimé avec ses appels, ses tests, sa config et sa doc dans le même changement. Pas d'alias déprécié ni de flag `useNewX`.
- **Un paramètre ou une option de config doit avoir un appelant aujourd'hui.**
- **Rester dans la tâche** : les améliorations remarquées vont dans le rapport, pas dans le diff.
- **Relire `git diff` pour le réduire** avant de rendre la main, et terminer par les totaux ajoutés/supprimés de `git diff --stat` (une ligne d'explication si le solde est positif).

### Commentaires et documentation
- Un commentaire explique un pourquoi que le code ne peut pas dire. Test : nommer ce que le lecteur comprendrait de travers sans lui.
- Une ligne par commentaire, deux au maximum. Les vraies explications vont dans une JSDoc (`/** */`) au-dessus de la déclaration, courte (1 à 10 lignes).
- **Décrire le présent, jamais le passé** : pas de « avant », « ne ... plus », « remplace », « l'ancien X », « extrait de ». Git garde l'historique.
- Ne jamais créer de fichier Markdown sans demande explicite. Quand un comportement documenté change, modifier le fichier existant et supprimer ce qui est devenu faux. Le README dit comment installer, lancer et utiliser.

### Typographie (code, commentaires, UI, docs, commits, réponses)
- Caractères interdits : tiret long ou demi-cadratin, points de suspension en un seul caractère, signe de multiplication, flèches, guillemets courbes anglais, bannières en caractères de dessin. Utiliser `-`, `...`, `x`, `->` et des guillemets droits. Les guillemets français « » restent autorisés dans les textes en français.
- Remplacer le caractère ne suffit pas : reformuler la phrase (point, virgule ou parenthèse).
- Éviter les tournures « Ce n'est pas X, c'est Y », les énumérations en trois temps systématiques et le gras à outrance.

### Tests
- Tester le comportement par l'API publique avec de vrais objets (Fastify `inject`, SQLite `:memory:`). Ne jamais mocker le code du projet ; mocker seulement les E/S en bordure (Discord, Gemini, réseau).
- Un test par comportement qui peut plausiblement casser. Pas de test de constante, de getter trivial ou de « a bien été appelé ».
- Modifier ou supprimer du code implique de modifier ou supprimer ses tests dans le même diff.

## Git
- **Ne jamais commiter de sa propre initiative.** Terminer, faire le rapport, puis proposer un message de commit court. Quand l'utilisateur demande un commit, pousser juste après.
- Format : commit conventionnel avec gitmoji après les deux-points, sujet court et au plus une ou deux phrases. Exemple : `feat(server): ✨ Ajoute la route /healthz`.
- Gitmojis : 🐛 fix, ✨ feature, 📝 docs, ♻️ refactor, 🔥 suppression, 🚀 build, 🎨 style, ✅ tests, 🔧 chore, 🚧 WIP, ⚡️ perf, 👷 CI.
- Jamais de ligne `Claude-Session:` ni de lien de session dans un commit ou une pull request.

## Style des échanges
- Direct, concis, technique. Pas de formules de politesse, d'annonces ni d'avertissements de principe. Ne pas s'excuser : corriger.
- Contester une idée mal fondée avec des arguments ; vérifier les sources (documentation officielle, littérature) avant une décision d'architecture et les citer.
- Proactif dans les suggestions, conservateur dans les diffs. Montrer seulement les extraits modifiés.
- En fin de tâche, expliquer simplement ce qui a changé, compréhensible par un non-technicien.

## Commandes
- `pnpm dev` : server (:3000, `tsx watch`) + web (:5173, Vite avec proxy vers l'API) en mode watch
- `pnpm build` (web puis server) / `pnpm start` (un seul port : API + dashboard buildé)
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (un fichier : `pnpm vitest run chemin/du/fichier.test.ts`)
- `pnpm format` / `pnpm format:check` (Prettier ; `docs/`, `legacy/`, `scripts/` sont ignorés)
- `pnpm db:generate` (après modification de `apps/server/src/db/schema.ts`), `pnpm db:migrate` (les migrations sont aussi appliquées au démarrage)
- `docker compose up --build`
- Ajouter une dépendance : `pnpm --filter @bot/server add <paquet>` (ou `@bot/web`, `@bot/shared`)

## Notes d'environnement
- `.env` à la racine (modèle : `.env.example`) ; `APP_SECRET` obligatoire. Packages : `@bot/server`, `@bot/web`, `@bot/shared`.
- TypeScript 6.0 tant que `typescript-eslint` ne supporte pas TS 7.
- Poste de dev Windows : écrire les fichiers avec les outils d'édition plutôt qu'avec de longs heredocs shell.
