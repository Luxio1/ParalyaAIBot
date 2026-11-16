# Démarrer la refonte dans VS Code avec Claude Code

1. Prérequis : VS Code, Node.js 22+, pnpm (`npm i -g pnpm`), Git, (optionnel) Docker Desktop.
2. Installer l'extension **Claude Code** (éditeur : Anthropic) : `Ctrl+Shift+X`, chercher « Claude Code », cliquer sur Install, puis se connecter avec son compte Claude.
3. Ouvrir CE dossier dans VS Code (`Fichier > Ouvrir le dossier...`).
4. Initialiser Git : `git init && git add -A && git commit -m "chore: kit de refonte + legacy"`.
5. Ouvrir le panneau Claude Code (icône Claude en haut à droite) et coller le premier message ci-dessous.

## Premier message à envoyer à Claude Code
```
Lis CLAUDE.md, docs/REFONTE.md et docs/CAHIER_DES_CHARGES.md.
Je confirme les décisions par défaut de docs/REFONTE.md §2 [ou : voici mes changements : ...].
Propose-moi le plan détaillé du jalon J0 (fichiers à créer, dépendances), puis attends ma validation.
```

## Ensuite, pour chaque jalon
- « Démarre le jalon Jn », relire le plan proposé, valider, puis laisser Claude Code coder.
- Vérifier : `pnpm dev`, tester dans le navigateur, puis demander le commit.

## Migration de l'ancienne config (au jalon J9)
Ouvrir l'ancien dashboard, F12, onglet Console, coller `scripts/export-legacy-config.js`.
Le fichier `legacy-config.json` téléchargé contient le token en clair : à importer puis supprimer.
