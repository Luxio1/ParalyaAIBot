export interface DiscordRoleInfo {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
  color: string;
}

export interface DiscordChannelInfo {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
}

export interface CustomCommand {
  id: string;
  name: string; // Command name without prefix, e.g. "help", "regles", "code"
  description?: string;
  enabled: boolean;
  type: 'static' | 'ai'; // 'static' = fixed predefined response, 'ai' = AI generation with custom template
  staticResponse?: string; // Text to reply with if type is 'static'
  aiPromptTemplate?: string; // Template for AI prompt, e.g. "Tu es un expert en code. Réponds à la question : {query}"
  systemInstruction?: string; // Optional system instruction override
}

export interface BotEventRule {
  id: string;
  name: string; // Ex: "Alerte comportement toxique / vulgarité"
  description?: string;
  enabled: boolean;
  
  // Critère / Prompt de détection
  // Ex: "Quand quelqu'un se comporte de façon agressive ou est vulgaire / insultant"
  triggerPrompt: string;
  
  // Filtre de canaux
  channelFilter?: 'all' | 'specific';
  targetChannels?: string[]; // IDs ou noms des salons surveillés
  
  // Actions à déclencher
  actionType: 'dm' | 'channel' | 'both'; // MP, Salon, ou les deux
  
  // 1. Action Message Privé (MP / DM)
  dmTarget: 'author' | 'user' | 'role'; // 'author' = Le joueur qui a parlé, 'user' = ID utilisateur précis, 'role' = membres d'un rôle
  dmTargetId?: string; // ID utilisateur ou ID rôle
  dmMessageMode: 'custom' | 'ai'; // Texte personnalisé ou rédigé par IA
  dmCustomMessage?: string; // Ex: "Bonjour {user}, nous avons détecté des propos inappropriés dans #{channel}. Merci de respecter les règles."
  dmAiPrompt?: string; // Ex: "Rédige un message privé d'avertissement courtois rappelant la courtoisie sans être agressif."
  
  // 2. Action Salon (Channel)
  channelTargetType: 'specific_channel' | 'source_channel'; // Dans un salon dédié ou dans le salon où le message a eu lieu
  channelId?: string; // ID ou nom du salon ciblé (ex: #alertes-moderation)
  channelMessageMode: 'custom' | 'ai';
  channelCustomMessage?: string; // Ex: "⚠️ **Alerte Comportement** : {user} dans #{channel} a déclenché un événement : _{message}_"
  channelAiPrompt?: string; // Ex: "Rédige une alerte claire pour l'équipe de modération avec analyse du message."
  channelMentionRole?: string; // Mention optionnelle d'un rôle ou utilisateur (ex: @Staff, @Modérateur)
  
  // Délai d'attente (cooldown) par utilisateur pour cet événement en secondes
  cooldownSeconds?: number;
}

export interface BotConfig {
  token: string;
  clientId: string;
  prefix: string;
  responseMode: 'both' | 'mention' | 'prefix'; // 'both' = Mention @Bot OR Prefix command, 'mention' = Only mention, 'prefix' = Only prefix
  systemInstruction: string;
  model: string;
  // Contexte Dynamique & Mémoire conversationnelle
  dynamicContextEnabled?: boolean;
  dynamicContextRetentionMinutes?: number; // Durée de rétention en minutes avant purge automatique
  dynamicContextMaxTurns?: number; // Nombre d'échanges max conservés
  channelRestrictionMode: 'all' | 'whitelist';
  allowedChannels: string[];
  allowDMs: boolean;
  // Limite de fréquence & Rôles Bypass (S'applique aussi en MP)
  rateLimitEnabled: boolean;
  cooldownSeconds: number;
  maxRequestsBeforeCooldown?: number; // Nombre de requêtes autorisées avant d'enclencher le cooldown
  bypassRoles: string[];
  bypassUsers?: string[];
  notifyOnRateLimit: boolean;
  // Commandes personnalisées
  customCommands: CustomCommand[];
  // Événements & Déclencheurs IA / Surveillance
  events?: BotEventRule[];
  // Retranscription des Messages Privés (MP)
  dmRelayEnabled: boolean;
  dmRelayChannelId: string;
}

export interface DynamicSessionInfo {
  key: string;
  scope: 'dm' | 'guild' | 'simulator';
  type?: 'dm' | 'sim' | 'guild';
  userTag: string;
  userName?: string;
  displayName?: string;
  channelName: string;
  messageCount: number;
  lastActiveFormatted: string;
  expiresInMinutes: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'system' | 'discord' | 'gemini' | 'error' | 'success' | 'cooldown' | 'command' | 'dm_relay' | 'event';
  message: string;
}

export interface BotStatus {
  status: 'offline' | 'connecting' | 'online';
  username: string | null;
  avatarUrl: string | null;
  guildsCount: number;
  ping: number | null;
  error: string | null;
  channels?: DiscordChannelInfo[];
  roles?: DiscordRoleInfo[];
}
