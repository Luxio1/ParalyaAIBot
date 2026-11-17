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

### Premier lancement

Tant qu'aucun compte administrateur n'existe, le serveur affiche dans ses logs une ligne
`Aucun compte administrateur. [...] code d'installation : XXXXXXXXXXXX`. Ouvrez le dashboard, saisissez ce
code, puis choisissez un identifiant et un mot de passe (12 caractères minimum). Le code change à
chaque redémarrage et ne sert plus une fois le compte créé.

Le token Discord et la clé Gemini se saisissent ensuite dans **Paramètres**. Ils sont chiffrés en base
avec `APP_SECRET` : si cette clé change, il faut les saisir à nouveau.

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
  `/data` et les variables `APP_SECRET` et `TRUST_PROXY=true`.

Derrière un hébergeur ou un reverse proxy (Caddy, Nginx), `TRUST_PROXY=true` est nécessaire pour que
l'anti-bruteforce voie la vraie IP des clients. Servez le dashboard en HTTPS dès que possible : le cookie
de session devient alors `Secure`.

Le guide de déploiement détaillé arrive au jalon J9.

## Structure

```
apps/server      API Fastify, bot Discord, base SQLite (Drizzle)
apps/web         Dashboard React + Vite + Tailwind
packages/shared  Schémas Zod et types partagés (source unique)
docker/          Dockerfile
legacy/          Ancienne application (lecture seule)
```
