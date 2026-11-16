Tu es un architecte logiciel senior et développeur full-stack. Je te confie la reprise et la refonte complète d'un projet de **Bot Discord propulsé par l'IA, piloté par une interface graphique web de personnalisation et de monitoring**.

## Contexte de la reprise
- L'application actuelle fonctionne mais doit être entièrement refondue pour être développée proprement sous VS Code et hébergée de manière flexible (VPS, Docker, PaaS type Railway/Render/Fly.io, ou séparation backend/bot et frontend).
- Je ne t'impose aucune architecture ni stack technique particulière : je veux que tu me proposes l'architecture la plus propre, modulaire, sécurisée et simple à héberger pour répondre au cahier des charges ci-dessous.
- Point critique de la refonte : toutes les configurations, commandes, règles d'événements et états ne doivent plus dépendre d'un stockage navigateur fragile, mais être persistés côté serveur de façon fiable (avec redémarrage automatique possible du bot en production et protection d'accès au dashboard web).

---

## Cahier des Charges Technique & Fonctionnel (Bot Discord + Interface Graphique)

### 1. Pilotage & Cycle de vie du Bot Discord
- **Configuration d'accès** : Saisie/gestion sécurisée du Token Discord, de l'ID Client (Application ID) et de la clé API du fournisseur IA.
- **Contrôle à chaud** : Démarrer, arrêter et appliquer les modifications de configuration (commandes, persona, règles, salons, limites) en direct sans redémarrer brutalement le processus quand le token ne change pas.
- **Statut temps réel** : Affichage dans l'interface de l'état (Hors ligne / Connexion / En ligne), nom et avatar du bot, nombre de serveurs rejoints, latence WebSocket (ping), et erreurs de connexion éventuelles.
- **Auto-découverte Discord** : Récupération dynamique de la liste des serveurs, salons textuels et rôles accessibles par le bot pour les proposer en sélecteurs cliquables dans l'interface.
- **Lien d'invitation OAuth2** : Génération automatique du lien d'invitation Discord avec les permissions nécessaires.
- **Console de logs en direct** : Journalisation typée et horodatée visible dans l'interface (système, discord, ia, succès, erreur, cooldown, commande, retranscription MP, événement) avec possibilité de vider la console.

### 2. Modes de déclenchement & Filtrage des messages
- **Modes d'activation sur serveur (zéro réponse intrusive non sollicitée)** :
  - `Mention OU Préfixe`
  - `Mention uniquement` (doit aussi se déclencher lorsqu'un membre utilise la fonction Discord « Répondre / Reply » directement sur un message du bot)
  - `Préfixe uniquement`
- **Préfixe personnalisable** (ex. `!`, `?`, `.`).
- **Restriction par salons** :
  - Mode *Tous les salons*
  - Mode *Liste blanche (Whitelist)* : sélection parmi les salons détectés ou ajout manuel par nom ou ID.
- **Messages Privés (MP / DMs)** : Activation ou désactivation globale de la prise en charge des MP.
- **Retranscription des MP (DM Relay)** : Option permettant de transférer en temps réel dans un salon Discord dédié (ex. salon staff/logs) tous les MP reçus par le bot ainsi que les réponses envoyées par le bot.
- **Contraintes Discord** : Indicateur de saisie (`typing`), déduplication stricte des messages entrants, découpage automatique des réponses dépassant 2000 caractères, et résolution des mentions Discord (`<@userId>`, `<#channelId>`, `<@&roleId>`) en noms lisibles avant envoi à l'IA.

### 3. Moteur IA, Personnalité & Capacités Multimodales
- **Choix du modèle IA** : Sélecteur permettant de choisir le modèle selon le compromis vitesse / capacité de raisonnement.
- **Consignes système (Persona)** :
  - Éditeur libre de la consigne système globale.
  - Bibliothèque de préréglages applicables en un clic (ex. Assistant polyvalent, Sarcastique, Tuteur Code/Dev, Maître du Donjon RPG, Coach motivationnel).
- **Contexte Dynamique (Mémoire conversationnelle court-terme)** :
  - Interrupteur activer/désactiver.
  - Sessions isolées par contexte : en MP (par utilisateur), sur serveur (par couple salon + utilisateur), et dans le simulateur web.
  - Reconnaissance de l'interlocuteur (pseudo / nom affiché / tag Discord).
  - Durée de rétention configurable (ex. de 5 min à 24h) avec purge automatique après inactivité.
  - Nombre maximal d'échanges récents conservés configurable (ex. 4 à 20 messages).
  - Moniteur temps réel dans l'interface listant les sessions actives (type, salon/utilisateur, nombre de messages, temps restant avant expiration) avec purge individuelle ou globale.
- **Contexte de message cité (Reply)** : Lorsqu'un utilisateur répond à un autre message en sollicitant le bot, l'auteur et le contenu du message cité sont automatiquement fournis à l'IA.
- **Vision multimodale** : Analyse des images envoyées en pièce jointe ou via URL d'image (y compris dans un message cité).
- **Consultation de liens Web** : Détection des URLs présentes dans les messages, récupération et extraction du contenu textuel/métadonnées de la page (titre, description, texte) afin que l'IA puisse résumer ou répondre à partir du contenu réel du lien.

### 4. Gestionnaire de Commandes Personnalisées
- CRUD complet (créer, modifier, dupliquer, activer/désactiver, supprimer) + restauration de commandes d'exemple (`help`, `regles`, `code`, `traduis`, `resume`).
- **Deux types de commandes** (invoquées via le préfixe configuré, sur serveur ou en MP) :
  - **Statique** : renvoie un texte prédéfini instantanément.
  - **IA paramétrée** : utilise un template de prompt avec variable (ex. `{query}`) et une consigne système optionnelle propre à la commande (qui surcharge le persona global).
- **Comportement de repli** : si le préfixe est suivi d'un texte ne correspondant à aucune commande enregistrée, traiter la phrase comme une requête directe à l'IA (et si préfixe seul sans texte ni média, afficher un court message d'aide).

### 5. Moteur d'Événements & Déclencheurs IA (Modération & Automatisation)
- Analyse automatique des messages entrants par l'IA pour détecter des situations définies en langage naturel (sans avoir besoin que le bot soit mentionné).
- Exemples de règles préconfigurées modifiables : détection de toxicité/vulgarité, demande de recrutement staff, signalement de détresse/harcèlement, questions d'aide sur le serveur.
- **Paramètres par règle** :
  - Nom, description, activation/désactivation.
  - Critère de déclenchement en langage naturel (`triggerPrompt`).
  - Filtre de salons : tous les salons ou salons spécifiques.
  - Cooldown par utilisateur pour éviter les déclenchements en boucle.
  - **Types d'actions** : envoi d'un Message Privé (`dm`), envoi dans un Salon (`channel`), ou les deux (`both`).
    - *Action MP* : destinataire configurable (auteur du message, ID utilisateur précis, ou membres d'un rôle) ; contenu en mode texte personnalisé (avec variables `{user}`, `{pseudo}`, `{userId}`, `{channel}`, `{message}`, `{reason}`) OU généré par l'IA selon une consigne dédiée.
    - *Action Salon* : destination configurable (salon source du message — en évitant le doublon si le bot répond déjà directement au message — ou salon dédié type `#alertes-moderation`) ; mention optionnelle d'un rôle/staff ; contenu en mode texte personnalisé avec variables OU généré par l'IA.
- **Testeur de règles intégré** : possibilité dans l'interface de saisir un message fictif pour vérifier quelles règles se déclencheraient et avec quelle justification.

### 6. Limitation de Fréquence (Rate Limiting) & Exemptions
- Activation/désactivation globale s'appliquant à la fois sur les serveurs et en MP.
- Paramétrage du **quota de requêtes** autorisées avant déclenchement et de la **durée du cooldown** en secondes.
- Option d'avertissement ou silence envers l'utilisateur bloqué (avec affichage du temps restant).
- **Système d'exemptions (Bypass)** :
  - Exemption automatique des propriétaires de serveurs.
  - Liste de rôles exemptés (sélection via les rôles détectés ou ajout manuel nom/ID).
  - Liste d'utilisateurs exemptés (ajout par ID, pseudo ou @tag).

### 7. Simulateur Web (Playground Discord) & Guide
- **Canal de test fidèle à Discord** intégré dans l'interface pour tester les prompts, commandes, persona, mémoire dynamique, vision (upload ou collage d'image), lecture de liens web et déclenchement d'événements sans polluer un vrai serveur Discord.
- Choix du pseudo du testeur, boutons de raccourcis pour les commandes actives, réinitialisation de la mémoire du simulateur.
- **Onglet Guide** : aide pas-à-pas pour configurer l'application sur le Discord Developer Portal (token, client ID, activation des Privileged Gateway Intents requis comme `Message Content Intent`).

---

## Ce que j'attends de toi maintenant (Étape 1 uniquement)
Avant d'écrire la moindre ligne de code :
1. Pose-moi uniquement les 3 à 5 questions essentielles qui influencent l'architecture (ex. fournisseur IA souhaité ou multi-providers, mode d'hébergement visé, besoin d'authentification multi-admin ou mot de passe simple sur le dashboard, base de données préférée ou fichier local/SQLite/Postgres).
2. Propose-moi une **architecture claire et modulaire** adaptée à VS Code et à un hébergement flexible, avec l'arborescence envisagée.
3. Propose un **plan de réalisation par jalons** que nous validerons ensemble avant de coder.