# Paralya AI Bot

Dépôt : https://github.com/Luxio1/ParalyaAIBot

Bot Discord propulsé par l'IA (Gemini), piloté par un tableau de bord web : configuration, commandes
personnalisées, règles d'événements, console en direct et simulateur.

> Refonte en cours, jalon par jalon : voir [docs/REFONTE.md](docs/REFONTE.md).
> L'ancienne application est conservée dans `legacy/` à titre de référence uniquement.

## Prérequis

- Node.js 22 ou plus récent
- pnpm (`npm install -g pnpm`)
- Docker (optionnel, pour le déploiement)

## Démarrage en développement

```bash
pnpm install
cp .env.example .env        # puis renseigner APP_SECRET (voir le fichier)
pnpm dev
```

- Dashboard : http://localhost:5173
- API : http://localhost:3000 (sonde : `/healthz`)

La base SQLite est créée automatiquement dans `./data/bot.db` et les migrations sont appliquées au
démarrage.

## Commandes

| Commande                    | Rôle                                                    |
| --------------------------- | ------------------------------------------------------- |
| `pnpm dev`                  | Serveur + dashboard en mode watch                       |
| `pnpm build`                | Build de production (dashboard puis serveur)            |
| `pnpm start`                | Lance le build : API + bot + dashboard sur un seul port |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                       |
| `pnpm typecheck`            | Vérification TypeScript                                 |
| `pnpm test`                 | Tests Vitest                                            |
| `pnpm db:generate`          | Génère une migration après modification du schéma       |
| `pnpm db:migrate`           | Applique les migrations sans démarrer le serveur        |
| `docker compose up --build` | Build et lancement de l'image Docker                    |

## Hébergement

Une seule image (ou un seul processus Node) contient l'API, le bot et le dashboard. Les données
vivent dans un dossier unique (`DATA_DIR`, `/data` en Docker) qu'il suffit de sauvegarder.

- **Docker / VPS** : `docker compose up --build -d`
- **Sans Docker** : `pnpm install && pnpm build && NODE_ENV=production HOST=0.0.0.0 pnpm start`
- **PaaS (Railway, Fly.io, Render)** : déployer `docker/Dockerfile` avec un volume monté sur
  `/data` et la variable `APP_SECRET`.

Le guide de déploiement détaillé arrive au jalon J9.

## Structure

```
apps/server      API Fastify, bot Discord, base SQLite (Drizzle)
apps/web         Dashboard React + Vite + Tailwind
packages/shared  Schémas Zod et types partagés (source unique)
docker/          Dockerfile
legacy/          Ancienne application (lecture seule)
```
