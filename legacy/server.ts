import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { Client, GatewayIntentBits, Message, ChannelType, Partials } from "discord.js";
import { BotConfig, LogEntry, BotStatus, CustomCommand, BotEventRule } from "./src/types.js";

// Initialize express app
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
const PORT = 3000;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to sanitize Gemini model name
function getValidGeminiModel(modelName?: string): string {
  if (!modelName) return "gemini-3.7-flash";
  const m = modelName.trim().toLowerCase();
  if (
    m === "gemini-3.7-flash" ||
    m === "gemini-3.1-pro-preview" ||
    m === "gemini-3.1-flash-lite" ||
    m === "gemini-2.5-flash" ||
    m === "gemini-2.5-pro"
  ) {
    return m;
  }
  if (m.includes("3.7")) return "gemini-3.7-flash";
  if (m.includes("3.1-pro") || m.includes("pro-preview")) return "gemini-3.1-pro-preview";
  if (m.includes("flash-lite") || m.includes("lite")) return "gemini-3.1-flash-lite";
  if (m.includes("2.5-pro") || m.includes("pro")) return "gemini-2.5-pro";
  if (m.includes("2.5-flash")) return "gemini-2.5-flash";
  return "gemini-3.7-flash";
}

// Server State
let discordClient: Client | null = null;
let currentConfig: BotConfig = {
  token: "",
  clientId: "",
  prefix: "!",
  responseMode: "both", // 'both' | 'mention' | 'prefix'
  systemInstruction: "Tu es un assistant utile, amical et drôle spécialisé dans le chat Discord. Réponds de manière concise.",
  model: "gemini-2.5-flash",
  dynamicContextEnabled: true,
  dynamicContextRetentionMinutes: 15,
  dynamicContextMaxTurns: 6,
  channelRestrictionMode: "all",
  allowedChannels: [],
  allowDMs: true,
  rateLimitEnabled: false,
  cooldownSeconds: 15,
  maxRequestsBeforeCooldown: 3,
  bypassRoles: [],
  bypassUsers: [],
  notifyOnRateLimit: true,
  customCommands: [
    {
      id: "cmd-help",
      name: "help",
      description: "Affiche le message d'aide et les commandes disponibles",
      enabled: true,
      type: "static",
      staticResponse: "🤖 **Commandes disponibles :**\n- `!help` : Afficher cette aide\n- `!regles` : Consulter les règles du serveur\n- `!code <votre question>` : Poser une question à l'expert IA en programmation\n- `!traduis <texte>` : Traduire un texte en anglais\n- `!resume <texte>` : Obtenir un résumé concis\n\nVous pouvez également me mentionner avec `@MonBot [votre question]` pour discuter librement !"
    },
    {
      id: "cmd-rules",
      name: "regles",
      description: "Rappel des règles et de la charte de bonne conduite du serveur",
      enabled: true,
      type: "static",
      staticResponse: "📜 **Règles du Serveur :**\n1. **Respect mutuel** : Aucune insulte, provocation ou propos discriminatoire.\n2. **Pas de spam** : Évitez les mentions inutiles et les messages répétitifs.\n3. **Salons thématiques** : Merci de poster vos messages dans les salons appropriés.\n4. **Entraide & Bonne humeur** : Partagez dans la bienveillance !"
    },
    {
      id: "cmd-code",
      name: "code",
      description: "Assistant développeur pour coder, déboguer et expliquer des algorithmes",
      enabled: true,
      type: "ai",
      aiPromptTemplate: "Tu es un expert senior en programmation informatique et développement logiciel. Réponds de façon précise, avec des exemples de code commentés et les meilleures pratiques à la requête suivante : {query}",
      systemInstruction: "Tu es un ingénieur logiciel chevronné. Sois pédagogique, précis et fournis du code propre et bien formaté en blocs markdown."
    },
    {
      id: "cmd-traduis",
      name: "traduis",
      description: "Traducteur intelligent multilingue (vers l'anglais ou la langue demandée)",
      enabled: true,
      type: "ai",
      aiPromptTemplate: "Tu es un traducteur linguistique professionnel. Traduis le texte suivant de manière naturelle et fidèle en anglais (ou dans la langue spécifiée par l'utilisateur s'il le précise) : {query}",
      systemInstruction: "Tu es un traducteur de haut niveau. Fournis uniquement la traduction élégante et fidèle, avec si nécessaire une brève note de contexte."
    },
    {
      id: "cmd-resume",
      name: "resume",
      description: "Synthétise un texte long ou un article en points clés",
      enabled: true,
      type: "ai",
      aiPromptTemplate: "Résume le texte suivant sous forme de 3 à 5 points clés clairs et percutants : {query}",
      systemInstruction: "Tu es un assistant de synthèse rapide. Sois clair, concis et structuré sous forme de puces."
    }
  ],
  events: [
    {
      id: "evt-toxicity",
      name: "Détection de toxicité & vulgarité",
      description: "Surveille les insultes, gros mots ou comportements agressifs et envoie un avertissement en MP ainsi qu'une alerte aux modérateurs.",
      enabled: true,
      triggerPrompt: "Quand quelqu'un utilise des insultes, des jurons grossiers, des menaces ou un comportement agressif et toxique envers autrui.",
      channelFilter: "all",
      actionType: "both",
      dmTarget: "author",
      dmMessageMode: "custom",
      dmCustomMessage: "Bonjour {user}, votre message dans #{channel} a été détecté comme ne respectant pas les règles de courtoisie. Merci de rester respectueux avec les autres membres.",
      channelTargetType: "specific_channel",
      channelId: "alertes-moderation",
      channelMessageMode: "custom",
      channelCustomMessage: "🚨 **Alerte Toxicité** : Propos inappropriés détectés de {user} dans #{channel} : _{message}_",
      channelMentionRole: "@Modérateur",
      cooldownSeconds: 30
    },
    {
      id: "evt-recruitment",
      name: "Demandes de recrutement / Staff",
      description: "Détecte quand un membre demande comment postuler ou rejoindre l'équipe et lui envoie le formulaire en MP.",
      enabled: true,
      triggerPrompt: "Quand quelqu'un demande comment devenir modérateur, helper, animateur, rejoindre le staff ou postuler dans l'équipe.",
      channelFilter: "all",
      actionType: "dm",
      dmTarget: "author",
      dmMessageMode: "custom",
      dmCustomMessage: "Bonjour {user} ! Vous souhaitez rejoindre l'équipe ? Les candidatures se déroulent via notre formulaire officiel : https://notre-serveur.com/recrutement. Bonne chance !",
      channelTargetType: "source_channel",
      channelMessageMode: "custom",
      cooldownSeconds: 60
    },
    {
      id: "evt-distress",
      name: "Signalement de détresse ou harcèlement",
      description: "Détecte les appels à l'aide ou signalements d'intimidation pour alerter immédiatement l'équipe dans le salon staff.",
      enabled: true,
      triggerPrompt: "Quand un membre exprime une grande détresse, dit être victime de harcèlement, de menaces graves ou demande une aide d'urgence.",
      channelFilter: "all",
      actionType: "channel",
      dmTarget: "author",
      dmMessageMode: "ai",
      dmAiPrompt: "Rédige un message réconfortant rappelant que l'équipe est là pour aider et indiquant comment ouvrir un ticket d'aide.",
      channelTargetType: "specific_channel",
      channelId: "alertes-urgentes",
      channelMessageMode: "ai",
      channelAiPrompt: "Rédige une alerte prioritaire pour l'équipe de modération avec un résumé de la situation et le contexte du message.",
      channelMentionRole: "@Staff",
      cooldownSeconds: 45
    },
    {
      id: "evt-rules-help",
      name: "Questions sur le fonctionnement du serveur",
      description: "Détecte quand un membre est perdu ou demande comment fonctionne le serveur pour lui donner une réponse bienveillante.",
      enabled: false,
      triggerPrompt: "Quand un joueur pose une question générale sur le fonctionnement du serveur, les rôles disponibles ou où trouver les informations.",
      channelFilter: "all",
      actionType: "channel",
      dmTarget: "author",
      dmMessageMode: "custom",
      channelTargetType: "source_channel",
      channelMessageMode: "ai",
      channelAiPrompt: "Fournis une réponse chaleureuse et concise guidant le membre vers les salons clés (règles, rôles, annonces).",
      cooldownSeconds: 60
    }
  ],
  dmRelayEnabled: false,
  dmRelayChannelId: ""
};

let botStatus: BotStatus = {
  status: "offline",
  username: null,
  avatarUrl: null,
  guildsCount: 0,
  ping: null,
  error: null,
  channels: [],
  roles: []
};

let logs: LogEntry[] = [];

// Rate Limit State per user: tracks request counts in active cycle and cooldown timestamp
interface UserRateLimitState {
  requestCount: number;
  cooldownUntil: number;
}
const userRateLimitMap = new Map<string, UserRateLimitState>();

// Dynamic Context / Short-Term Conversational Memory
interface DynamicMemoryTurn {
  role: 'user' | 'model';
  text: string;
  userDisplayName?: string;
  timestamp: number;
}

interface DynamicSession {
  key: string;
  scope: 'dm' | 'guild' | 'simulator';
  userId: string;
  userTag: string;
  userName?: string;
  displayName?: string;
  channelId: string;
  channelName: string;
  lastActive: number;
  history: DynamicMemoryTurn[];
}

const dynamicContextStore = new Map<string, DynamicSession>();

// Periodic cleanup of expired dynamic context memories (runs every 30s)
setInterval(() => {
  const now = Date.now();
  const retentionMs = (currentConfig.dynamicContextRetentionMinutes || 15) * 60 * 1000;
  for (const [key, session] of dynamicContextStore.entries()) {
    if (now - session.lastActive > retentionMs) {
      dynamicContextStore.delete(key);
      addLog("system", `[MÉMOIRE DYNAMIQUE] Contexte expiré purgé automatiquement pour @${session.userTag} (${session.scope === 'dm' ? 'MP' : session.scope === 'simulator' ? 'Simulateur' : '#' + session.channelName})`);
    }
  }
}, 30000);

// Helper function to push logs
function addLog(type: LogEntry['type'], message: string) {
  const entry: LogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString('fr-FR'),
    type,
    message
  };
  logs.unshift(entry);
  if (logs.length > 150) {
    logs.pop();
  }
  console.log(`[${type.toUpperCase()}] ${message}`);
}

addLog("system", "Serveur démarré. Prêt à configurer le bot Discord.");

// Helper to get connected text channels
function getConnectedChannels() {
  if (!discordClient || botStatus.status !== "online") return [];
  const list: { id: string; name: string; guildId: string; guildName: string }[] = [];
  try {
    for (const [, guild] of discordClient.guilds.cache) {
      for (const [, channel] of guild.channels.cache) {
        // ChannelType.GuildText = 0, ChannelType.GuildAnnouncement = 5
        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
          list.push({
            id: channel.id,
            name: channel.name,
            guildId: guild.id,
            guildName: guild.name
          });
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de la récupération des salons:", err);
  }
  return list;
}

// Helper to get connected server roles
function getConnectedRoles() {
  if (!discordClient || botStatus.status !== "online") return [];
  const list: { id: string; name: string; guildId: string; guildName: string; color: string }[] = [];
  try {
    for (const [, guild] of discordClient.guilds.cache) {
      for (const [, role] of guild.roles.cache) {
        if (role.name !== "@everyone") {
          list.push({
            id: role.id,
            name: role.name,
            guildId: guild.id,
            guildName: guild.name,
            color: role.hexColor
          });
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de la récupération des rôles:", err);
  }
  return list;
}

// Helper to split Discord messages exceeding 2000 chars limit
function splitDiscordMessage(text: string, limit = 1950): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = remaining.lastIndexOf("\n", limit);
    if (splitIndex === -1 || splitIndex < limit / 2) {
      splitIndex = remaining.lastIndexOf(" ", limit);
    }
    if (splitIndex === -1) {
      splitIndex = limit;
    }
    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }
  return chunks;
}

// Helper to clean unwanted meta-commentary from AI responses
function cleanAiReply(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // Remove "Voici une proposition de message..." and variants
  const metaPrefixRegex = /^(?:voici\s+(?:une\s+)?(?:proposition|suggestion|idée|ébauche)?\s*(?:de\s+message|de\s+réponse)?\s*(?:pour\s+répondre\s+à\s+[^\n:]+)?\s*:\s*|proposition\s+de\s+(?:message|réponse)\s*:\s*|message\s+suggéré\s*:\s*|voici\s+(?:le\s+)?message\s*:\s*|voici\s+(?:la\s+)?réponse\s*:\s*)/i;
  if (metaPrefixRegex.test(text)) {
    text = text.replace(metaPrefixRegex, "").trim();
  }

  // Remove standalone decoration lines or markdown asterisks at the beginning
  text = text.replace(/^[\s*\-_=~]+\n+/g, "").trim();

  return text;
}

// Helper to resolve Discord user, channel and role mentions to readable names
async function resolveDiscordMentions(rawText: string, message: Message, client: Client | null): Promise<string> {
  if (!rawText) return "";
  let text = rawText;

  // 1. Resolve User Mentions: <@123456789> or <@!123456789>
  const userRegex = /<@!?(\d+)>/g;
  const userMatches = [...text.matchAll(userRegex)];
  for (const match of userMatches) {
    const rawTag = match[0];
    const targetUserId = match[1];

    let name = "utilisateur";
    // Check if the user is in message mentions
    const mentionedUser = message.mentions.users?.get(targetUserId);
    if (mentionedUser) {
      const member = message.guild?.members.cache.get(targetUserId);
      name = member?.displayName || mentionedUser.displayName || mentionedUser.username;
    } else if (message.guild) {
      const member = message.guild.members.cache.get(targetUserId);
      if (member) {
        name = member.displayName || member.user.username;
      } else {
        try {
          const fetched = await message.guild.members.fetch(targetUserId);
          if (fetched) name = fetched.displayName || fetched.user.username;
        } catch {
          if (client) {
            try {
              const u = await client.users.fetch(targetUserId);
              if (u) name = u.displayName || u.username;
            } catch {}
          }
        }
      }
    } else if (client) {
      try {
        const u = await client.users.fetch(targetUserId);
        if (u) name = u.displayName || u.username;
      } catch {}
    }

    text = text.split(rawTag).join(`@${name}`);
  }

  // 2. Resolve Channel Mentions: <#123456789>
  const chanRegex = /<#(\d+)>/g;
  const chanMatches = [...text.matchAll(chanRegex)];
  for (const match of chanMatches) {
    const rawTag = match[0];
    const chanId = match[1];
    let chanName = "salon";

    const ch = message.guild?.channels.cache.get(chanId) || client?.channels.cache.get(chanId);
    if (ch && 'name' in ch) {
      chanName = ch.name;
    } else if (client) {
      try {
        const fetched = await client.channels.fetch(chanId);
        if (fetched && 'name' in fetched) chanName = (fetched as any).name;
      } catch {}
    }

    text = text.split(rawTag).join(`#${chanName}`);
  }

  // 3. Resolve Role Mentions: <@&123456789>
  const roleRegex = /<@&(\d+)>/g;
  const roleMatches = [...text.matchAll(roleRegex)];
  for (const match of roleMatches) {
    const rawTag = match[0];
    const roleId = match[1];
    let roleName = "role";

    const role = message.guild?.roles.cache.get(roleId);
    if (role) {
      roleName = role.name;
    }

    text = text.split(rawTag).join(`@${roleName}`);
  }

  return text;
}

// ----------------------------------------------------
// MULTIMODAL & WEB LINK INSPECTION UTILITIES
// ----------------------------------------------------

interface InspectedImage {
  mimeType: string;
  data: string; // base64
  name?: string;
  url?: string;
}

interface InspectedLink {
  url: string;
  title: string;
  description?: string;
  content: string;
}

// Extract URLs from text
function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s<>"'()\[\]{}]+)/gi;
  const matches = text.match(urlRegex) || [];
  // Clean trailing punctuation
  return matches.map(u => u.replace(/[.,;:!?)]+$/, '')).filter(u => u.startsWith('http'));
}

// Decode HTML entities
function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

// Extract human-readable text, title and description from HTML
function extractHtmlText(html: string): { title: string; description: string; text: string } {
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : "";
  title = decodeHtmlEntities(title);

  // Meta description or OpenGraph description
  const descMatch = html.match(/<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name=["']description["']|property=["']og:description["'])[^>]*>/i);
  let description = descMatch ? descMatch[1].trim() : "";
  description = decodeHtmlEntities(description);

  // Strip scripts, styles, svg, iframe, noscript
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, " ");

  // Replace block elements with line breaks
  cleanHtml = cleanHtml.replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|article|section|blockquote|main|header|footer)>/gi, "\n");
  cleanHtml = cleanHtml.replace(/<br\s*[\/]?>/gi, "\n");

  // Strip remaining HTML tags
  let text = cleanHtml.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join("\n");

  if (text.length > 4000) {
    text = text.substring(0, 4000) + "\n... [Texte tronqué pour optimiser la réponse]";
  }

  return { title, description, text };
}

// Download image and convert to Base64
async function fetchImageAsBase64(url: string, defaultName?: string): Promise<InspectedImage | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    let mimeType = res.headers.get('content-type') || '';
    if (!mimeType || mimeType.includes('text/html') || mimeType.includes('application/octet-stream')) {
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.includes('.png')) mimeType = 'image/png';
      else if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) mimeType = 'image/jpeg';
      else if (lowerUrl.includes('.webp')) mimeType = 'image/webp';
      else if (lowerUrl.includes('.gif')) mimeType = 'image/gif';
      else mimeType = 'image/jpeg';
    }

    mimeType = mimeType.split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > 12 * 1024 * 1024) {
      console.warn("Image ignorée (taille supérieure à 12Mo):", arrayBuffer.byteLength);
      return null;
    }

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return {
      mimeType,
      data: base64,
      url,
      name: defaultName || 'image'
    };
  } catch (err: any) {
    console.error(`Erreur téléchargement image (${url}):`, err?.message || err);
    return null;
  }
}

// Inspect a generic URL (determine whether it's an image or a webpage and extract content)
async function inspectAndFetchUrl(url: string): Promise<{ type: 'image' | 'webpage' | 'raw'; image?: InspectedImage; link?: InspectedLink } | null> {
  try {
    // Check if it's an explicit image URL extension
    const isImageExt = /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(url);
    if (isImageExt) {
      const img = await fetchImageAsBase64(url);
      if (img) {
        return { type: 'image', image: img };
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,application/json;q=0.5,*/*;q=0.3'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        type: 'webpage',
        link: {
          url,
          title: `Lien (${res.status})`,
          content: `Le serveur distant a retourné le code HTTP ${res.status} (${res.statusText}). Le contenu n'a pas pu être chargé directement.`
        }
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    
    // If headers indicate an image
    if (contentType.startsWith('image/')) {
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const cleanMime = contentType.split(';')[0].trim();
      return {
        type: 'image',
        image: {
          mimeType: cleanMime,
          data: base64,
          url
        }
      };
    }

    // Webpage or plain text/JSON
    const rawText = await res.text();
    if (contentType.includes('text/html') || rawText.includes('<html') || rawText.includes('<!DOCTYPE')) {
      const parsed = extractHtmlText(rawText);
      return {
        type: 'webpage',
        link: {
          url,
          title: parsed.title || 'Page web',
          description: parsed.description,
          content: parsed.text || '(Page sans texte lisible ou protégée)'
        }
      };
    } else {
      let snippet = rawText.trim();
      if (snippet.length > 4000) {
        snippet = snippet.substring(0, 4000) + '... [Tronqué]';
      }
      return {
        type: 'raw',
        link: {
          url,
          title: 'Document / Ressource',
          content: snippet || '(Contenu vide)'
        }
      };
    }
  } catch (err: any) {
    return {
      type: 'webpage',
      link: {
        url,
        title: 'Lien inaccessible',
        content: `Impossible d'accéder au lien (${err?.message || 'délai de réponse dépassé'}).`
      }
    };
  }
}

// Comprehensive helper to extract images and inspect links from Discord messages
async function resolveMessageMediaAndLinks(message: any, referencedMessageInfo?: any): Promise<{
  images: InspectedImage[];
  inspectedLinks: InspectedLink[];
}> {
  const images: InspectedImage[] = [];
  const inspectedLinks: InspectedLink[] = [];

  // 1. Process direct attachments from the message
  if (message.attachments && message.attachments.size > 0) {
    for (const [, attachment] of message.attachments) {
      const isImg = attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(attachment.name || attachment.url);
      if (isImg && attachment.url) {
        const fetchedImg = await fetchImageAsBase64(attachment.url, attachment.name);
        if (fetchedImg) {
          images.push(fetchedImg);
        }
      }
    }
  }

  // 2. Process URLs from message content
  const detectedUrls = extractUrlsFromText(message.content || "");
  for (const url of detectedUrls.slice(0, 4)) { // Limit to first 4 URLs to avoid latency
    const inspected = await inspectAndFetchUrl(url);
    if (inspected) {
      if (inspected.type === 'image' && inspected.image) {
        images.push(inspected.image);
      } else if (inspected.link) {
        inspectedLinks.push(inspected.link);
      }
    }
  }

  // 3. If no images were directly attached, check referenced/replied-to message for images & links
  if (images.length === 0 && message.reference?.messageId) {
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (refMsg) {
        if (refMsg.attachments && refMsg.attachments.size > 0) {
          for (const [, attachment] of refMsg.attachments) {
            const isImg = attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i.test(attachment.name || attachment.url);
            if (isImg && attachment.url) {
              const fetchedImg = await fetchImageAsBase64(attachment.url, attachment.name);
              if (fetchedImg) {
                images.push(fetchedImg);
              }
            }
          }
        }

        // If user didn't provide URLs in current message, extract from replied message
        if (inspectedLinks.length === 0) {
          const refUrls = extractUrlsFromText(refMsg.content || "");
          for (const url of refUrls.slice(0, 2)) {
            const inspected = await inspectAndFetchUrl(url);
            if (inspected) {
              if (inspected.type === 'image' && inspected.image && images.length === 0) {
                images.push(inspected.image);
              } else if (inspected.link) {
                inspectedLinks.push(inspected.link);
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  return { images, inspectedLinks };
}

// Helper function to call Gemini with multi-turn Dynamic Context, Vision Multimodal & Inspected Web Links
async function generateAIResponseWithContext(params: {
  model: string;
  prompt: string;
  systemInstruction: string;
  images?: InspectedImage[];
  inspectedLinks?: InspectedLink[];
  sessionContext?: {
    scope: 'dm' | 'guild' | 'simulator';
    userId: string;
    userTag: string;
    userName?: string;
    displayName?: string;
    channelId: string;
    channelName: string;
  };
}): Promise<string> {
  const { model, prompt, systemInstruction, images, inspectedLinks, sessionContext } = params;
  const isDynamicEnabled = currentConfig.dynamicContextEnabled !== false;

  // Format prompt with inspected links content
  let resolvedPrompt = prompt.trim();
  if (inspectedLinks && inspectedLinks.length > 0) {
    const linksBlock = inspectedLinks.map((link, idx) => {
      return `\n---
[LIEN WEB N°${idx + 1} CONSULTÉ PAR LE BOT]
URL : ${link.url}
Titre : ${link.title}
${link.description ? `Description : ${link.description}\n` : ''}Contenu textuel extrait :
${link.content}
---`;
    }).join("\n");

    const linkInstruction = `\n\n[INFORMATIONS OBTENUES EN CONSULTANT LES LIENS FOURNIS PAR L'UTILISATEUR :]${linksBlock}\n\n(Utilise ces informations réelles pour répondre avec précision à la demande de l'utilisateur relative au lien/site web).`;
    resolvedPrompt = resolvedPrompt ? `${resolvedPrompt}${linkInstruction}` : `Résume et analyse le contenu du lien consulté : ${linkInstruction}`;
  }

  // If prompt was empty but images were sent
  if (!resolvedPrompt && images && images.length > 0) {
    resolvedPrompt = "Analyse et décris cette image en détail, et réponds en fonction de son contenu.";
  } else if (!resolvedPrompt) {
    resolvedPrompt = "Bonjour !";
  }

  // Interlocutor recognition context
  let interlocutorInstruction = "";
  if (sessionContext) {
    const pseudo = sessionContext.displayName || sessionContext.userTag || sessionContext.userName || "Utilisateur";
    const handle = sessionContext.userName ? `@${sessionContext.userName}` : `@${sessionContext.userTag}`;
    const location = sessionContext.scope === 'dm'
      ? "en Message Privé (MP)"
      : sessionContext.scope === 'simulator'
      ? "dans le Simulateur Web"
      : `dans le salon #${sessionContext.channelName}`;

    interlocutorInstruction = `\n\n[CONTEXTE DE L'INTERLOCUTEUR (Reconnaissance de pseudo) :\nTu es en train de discuter avec l'utilisateur "${pseudo}" (identifiant Discord : ${handle}) ${location}.\n- Tu dois RECONNAÎTRE cet interlocuteur et te rappeler de ce qu'il te dit dans cette conversation.\n- Tu peux t'adresser à lui par son pseudo ("${pseudo}") quand c'est convivial, engageant et opportun.]`;
  }

  // Enhance system instruction to guarantee direct answers without meta-proposals + Multimodal Guidance
  const multimodalGuidance = images && images.length > 0 
    ? `\n[CAPACITÉ VISION ACTIVE : Tu as reçu ${images.length} image(s) jointe(s). Examine attentivement les détails visuels (textes, objets, couleurs, schémas) pour répondre à l'utilisateur.]`
    : '';

  const antiMetaInstruction = `${systemInstruction}${interlocutorInstruction}${multimodalGuidance}\n\nIMPORTANT : Rédige DIRECTEMENT la réponse sans AUCUN préambule, sans commencer par 'Voici une proposition...', sans méta-commentaire. Tu incarnes directement le bot.`;

  // Build current user turn parts (including any attached images)
  const currentUserParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (images && images.length > 0) {
    for (const img of images) {
      currentUserParts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      });
    }
  }

  if (!isDynamicEnabled || !sessionContext) {
    currentUserParts.push({ text: resolvedPrompt });
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: currentUserParts },
      config: {
        systemInstruction: antiMetaInstruction
      }
    });
    return cleanAiReply(response.text || "Désolé, je n'ai pas pu générer de réponse.");
  }

  // Session key distinguishes DMs, server channels per user, and simulator
  const sessionKey = sessionContext.scope === 'dm'
    ? `dm_${sessionContext.userId}`
    : sessionContext.scope === 'simulator'
    ? `sim_${sessionContext.userId}`
    : `guild_${sessionContext.channelId}_${sessionContext.userId}`;

  const now = Date.now();
  const retentionMs = (currentConfig.dynamicContextRetentionMinutes || 15) * 60 * 1000;
  let session = dynamicContextStore.get(sessionKey);

  if (!session || (now - session.lastActive > retentionMs)) {
    session = {
      key: sessionKey,
      scope: sessionContext.scope,
      userId: sessionContext.userId,
      userTag: sessionContext.userTag,
      userName: sessionContext.userName,
      displayName: sessionContext.displayName,
      channelId: sessionContext.channelId,
      channelName: sessionContext.channelName,
      lastActive: now,
      history: []
    };
    dynamicContextStore.set(sessionKey, session);
  }

  // Update session identity metadata
  session.userTag = sessionContext.userTag;
  if (sessionContext.userName) session.userName = sessionContext.userName;
  if (sessionContext.displayName) session.displayName = sessionContext.displayName;
  session.channelName = sessionContext.channelName;

  // Multi-turn Gemini format with user speaker identification
  const maxTurns = currentConfig.dynamicContextMaxTurns || 6;
  const recentTurns = session.history.slice(-maxTurns * 2);

  const contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [];
  for (const turn of recentTurns) {
    if (turn.role === 'user') {
      const speakerName = turn.userDisplayName || session.displayName || session.userTag || "Utilisateur";
      contents.push({
        role: 'user',
        parts: [{ text: `[Message de ${speakerName}] : ${turn.text}` }]
      });
    } else {
      contents.push({
        role: 'model',
        parts: [{ text: turn.text }]
      });
    }
  }

  const currentSpeaker = sessionContext.displayName || sessionContext.userTag || "Utilisateur";
  currentUserParts.push({ text: `[Message de ${currentSpeaker}] : ${resolvedPrompt}` });

  contents.push({
    role: 'user',
    parts: currentUserParts
  });

  const response = await ai.models.generateContent({
    model: model,
    contents: contents,
    config: {
      systemInstruction: antiMetaInstruction
    }
  });

  const replyText = cleanAiReply(response.text || "Désolé, je n'ai pas pu générer de réponse.");

  // Update session history with clean summary
  const imageTag = images && images.length > 0 ? ` [${images.length} image(s) analysée(s)]` : '';
  const linkTag = inspectedLinks && inspectedLinks.length > 0 ? ` [${inspectedLinks.length} lien(s) web consulté(s)]` : '';
  
  session.history.push({
    role: 'user',
    text: `${prompt || (images?.length ? 'Image envoyée' : 'Lien envoyé')}${imageTag}${linkTag}`,
    userDisplayName: currentSpeaker,
    timestamp: now
  });
  session.history.push({
    role: 'model',
    text: replyText,
    timestamp: Date.now()
  });

  // Cap history length
  if (session.history.length > maxTurns * 4) {
    session.history = session.history.slice(-maxTurns * 2);
  }
  session.lastActive = Date.now();

  return replyText;
}

// Helper to send message transcription to a Discord channel
async function relayToChannel(client: Client, channelId: string, text: string) {
  if (!client || !channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased() && 'send' in channel) {
      const chunks = splitDiscordMessage(text);
      for (const chunk of chunks) {
        await (channel as any).send(chunk);
      }
    }
  } catch (err: any) {
    addLog("error", `[RETRANSCRIPTION MP] Impossible d'envoyer dans le salon (ID: ${channelId}): ${err.message}`);
  }
}

// Message Deduplication Cache (avoids duplicate responses from gateway retries or concurrent events)
const processedMessageIds = new Set<string>();

// Event Rules Cooldown Map: key = `${ruleId}_${userId}`
const eventRuleCooldownMap = new Map<string, number>();

// Helper function to evaluate and execute event rules for incoming Discord messages
async function evaluateAndExecuteEvents(message: Message, isDM: boolean, isDirectlyHandled: boolean = false) {
  const activeEvents = (currentConfig.events || []).filter(e => e.enabled);
  if (activeEvents.length === 0) return;

  const content = message.content.trim();
  if (!content) return;

  const channelId = message.channel.id;
  const channelName = (message.channel as any).name || (isDM ? 'DM' : 'salon');
  const author = message.author;
  const authorMember = message.guild?.members.cache.get(author.id);
  const authorDisplayName = authorMember?.displayName || author.displayName || author.globalName || author.username;
  const now = Date.now();

  // Filter rules applicable to current channel and not in cooldown
  const candidateRules = activeEvents.filter((rule) => {
    // Check channel filter
    if (!isDM && rule.channelFilter === 'specific' && rule.targetChannels && rule.targetChannels.length > 0) {
      const match = rule.targetChannels.some(ch => ch === channelId || ch === channelName || `#${channelName}` === ch);
      if (!match) return false;
    }
    // Check cooldown
    const cooldownKey = `${rule.id}_${author.id}`;
    const cdUntil = eventRuleCooldownMap.get(cooldownKey) || 0;
    if (cdUntil > now) {
      return false; // Still in cooldown
    }
    return true;
  });

  if (candidateRules.length === 0) return;

  const modelToUse = getValidGeminiModel(currentConfig.model);

  try {
    const resolvedContentForEval = await resolveDiscordMentions(content, message, discordClient);

    const evaluationPrompt = `
Tu es un moteur d'analyse et de détection d'événements pour un serveur Discord.
Un message vient d'être posté par l'utilisateur "${authorDisplayName}" (@${author.username}, ID: ${author.id}) dans le salon "${channelName}" :
"""
${resolvedContentForEval}
"""

Voici la liste des règles d'événements configurées :
${JSON.stringify(candidateRules.map(r => ({ id: r.id, name: r.name, triggerPrompt: r.triggerPrompt })))}

Pour chaque règle, analyse si le message de l'utilisateur correspond au critère "triggerPrompt".
Sois strict : ne déclenche la règle que si le message correspond sans ambiguïté à la situation ou au comportement décrit.

Réponds UNIQUEMENT avec un JSON valide suivant ce schéma :
{
  "matches": [
    {
      "id": "id-de-la-regle",
      "matched": true,
      "reason": "Brève explication de 10-15 mots maximum"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: evaluationPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let data: { matches?: Array<{ id: string; matched: boolean; reason: string }> } = {};
    try {
      const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      data = JSON.parse(cleanJson);
    } catch (e) {
      return;
    }

    if (!data.matches || !Array.isArray(data.matches)) return;

    for (const matchResult of data.matches) {
      if (!matchResult.matched) continue;
      const rule = candidateRules.find(r => r.id === matchResult.id);
      if (!rule) continue;

      // Update cooldown
      const cooldownSec = rule.cooldownSeconds ?? 30;
      eventRuleCooldownMap.set(`${rule.id}_${author.id}`, now + (cooldownSec * 1000));

      addLog("event", `[ÉVÈNEMENT DÉCLENCHÉ : "${rule.name}"] par ${authorDisplayName} (@${author.username}) dans #${channelName} -> ${matchResult.reason}`);

      // Variables formatting helper
      const formatVariables = (template: string) => {
        return template
          .replace(/{user}/g, `@${author.username}`)
          .replace(/{pseudo}/g, authorDisplayName)
          .replace(/{displayName}/g, authorDisplayName)
          .replace(/{authorName}/g, authorDisplayName)
          .replace(/{userId}/g, author.id)
          .replace(/{channel}/g, channelName)
          .replace(/{message}/g, resolvedContentForEval)
          .replace(/{reason}/g, matchResult.reason || '');
      };

      // 1. ACTION DM (Message Privé)
      if (rule.actionType === 'dm' || rule.actionType === 'both') {
        try {
          let dmText = "";
          if (rule.dmMessageMode === 'ai' && rule.dmAiPrompt) {
            const aiDmPrompt = `
Contexte : L'utilisateur @${author.username} a posté ce message dans #${channelName} : "${resolvedContentForEval}".
Un événement a été déclenché : "${rule.name}" (Raison : ${matchResult.reason}).
Consigne pour rédiger le message privé :
${rule.dmAiPrompt}
`;
            const dmAiRes = await ai.models.generateContent({
              model: modelToUse,
              contents: aiDmPrompt,
              config: {
                systemInstruction: "Tu es un assistant Discord bienveillant et professionnel. Rédige DIRECTEMENT le message final sans préambule, sans 'Voici une proposition...', sans méta-commentaire."
              }
            });
            dmText = cleanAiReply(dmAiRes.text || "");
          } else {
            dmText = formatVariables(rule.dmCustomMessage || "Notification d'événement.");
          }

          if (dmText) {
            if (rule.dmTarget === 'author') {
              const chunks = splitDiscordMessage(dmText);
              for (const chunk of chunks) {
                await author.send(chunk);
              }
              addLog("discord", `[ACTION ÉVÈNEMENT] MP envoyé avec succès à @${author.username}`);
            } else if (rule.dmTarget === 'user' && rule.dmTargetId && discordClient) {
              try {
                const targetUser = await discordClient.users.fetch(rule.dmTargetId);
                if (targetUser) {
                  const chunks = splitDiscordMessage(dmText);
                  for (const chunk of chunks) {
                    await targetUser.send(chunk);
                  }
                  addLog("discord", `[ACTION ÉVÈNEMENT] MP envoyé à l'utilisateur ID: ${rule.dmTargetId}`);
                }
              } catch (e) {}
            } else if (rule.dmTarget === 'role' && rule.dmTargetId && message.guild) {
              const role = message.guild.roles.cache.find(r => r.id === rule.dmTargetId || r.name.toLowerCase() === rule.dmTargetId.toLowerCase().replace(/^@/, ''));
              if (role) {
                const membersWithRole = role.members.first(5);
                for (const member of membersWithRole) {
                  try {
                    await member.send(`🔔 **[Alerte Événement : ${rule.name}]**\n${dmText}`);
                  } catch (e) {}
                }
                addLog("discord", `[ACTION ÉVÈNEMENT] Alerte MP envoyée aux membres du rôle @${role.name}`);
              }
            }
          }
        } catch (err: any) {
          addLog("error", `[ACTION ÉVÈNEMENT] Erreur lors de l'envoi du MP : ${err.message}`);
        }
      }

      // 2. ACTION SALON (Channel)
      if (rule.actionType === 'channel' || rule.actionType === 'both') {
        try {
          // If the bot is already answering the user directly in this channel, skip the source_channel event broadcast to prevent double messages
          if (rule.channelTargetType === 'source_channel' && isDirectlyHandled) {
            addLog("event", `[ÉVÈNEMENT "${rule.name}"] Alerte salon source ignorée car le bot répond déjà directement au message.`);
            continue;
          }

          let channelText = "";
          if (rule.channelMessageMode === 'ai' && rule.channelAiPrompt) {
            const aiChannelPrompt = `
Contexte : L'utilisateur @${author.username} a posté ce message dans #${channelName} : "${resolvedContentForEval}".
Un événement a été déclenché : "${rule.name}" (Raison : ${matchResult.reason}).
Consigne pour rédiger le message de salon :
${rule.channelAiPrompt}
`;
            const chanAiRes = await ai.models.generateContent({
              model: modelToUse,
              contents: aiChannelPrompt,
              config: {
                systemInstruction: "Tu es un bot Discord de modération et d'animation. Rédige DIRECTEMENT le message d'alerte sans préambule, sans 'Voici une proposition...', sans méta-commentaire."
              }
            });
            channelText = cleanAiReply(chanAiRes.text || "");
          } else {
            channelText = formatVariables(rule.channelCustomMessage || "Alerte événement.");
          }

          if (rule.channelMentionRole) {
            channelText = `${rule.channelMentionRole} ${channelText}`;
          }

          if (channelText) {
            if (rule.channelTargetType === 'source_channel') {
              const chunks = splitDiscordMessage(channelText);
              for (const chunk of chunks) {
                await (message.channel as any).send(chunk);
              }
              addLog("discord", `[ACTION ÉVÈNEMENT] Message envoyé dans le salon #${channelName}`);
            } else if (rule.channelTargetType === 'specific_channel' && rule.channelId && discordClient) {
              let targetChan: any = null;
              try {
                targetChan = await discordClient.channels.fetch(rule.channelId);
              } catch (e) {
                for (const [, guild] of discordClient.guilds.cache) {
                  const found = guild.channels.cache.find(c => c.name === rule.channelId.replace(/^#/, ''));
                  if (found) {
                    targetChan = found;
                    break;
                  }
                }
              }

              if (targetChan && targetChan.isTextBased() && 'send' in targetChan) {
                const chunks = splitDiscordMessage(channelText);
                for (const chunk of chunks) {
                  await targetChan.send(chunk);
                }
                addLog("discord", `[ACTION ÉVÈNEMENT] Message d'alerte envoyé dans #${targetChan.name || rule.channelId}`);
              }
            }
          }
        } catch (err: any) {
          addLog("error", `[ACTION ÉVÈNEMENT] Erreur lors de l'envoi du message dans le salon : ${err.message}`);
        }
      }

    }
  } catch (err: any) {
    console.error("Erreur lors de l'évaluation des événements:", err);
  }
}

// Startup mutex to prevent race conditions
let isStartingBot = false;

// Function to start or hot-update the Discord Bot
async function startDiscordBot(config: BotConfig) {
  // If bot is already online with the same token, simply update configuration hot in-memory
  if (discordClient && botStatus.status === "online" && currentConfig.token === config.token) {
    currentConfig = config;
    addLog("system", "Paramètres et commandes mis à jour en direct sans interruption.");
    return;
  }

  if (isStartingBot) {
    addLog("discord", "Démarrage déjà en cours, veuillez patienter...");
    return;
  }

  isStartingBot = true;
  currentConfig = config;
  
  if (discordClient) {
    try {
      discordClient.removeAllListeners();
      await discordClient.destroy();
    } catch (e) {}
    discordClient = null;
  }

  botStatus.status = "connecting";
  botStatus.error = null;
  addLog("discord", "Tentative de connexion aux serveurs Discord...");

  try {
    // 1. Validate Token format
    if (!config.token || config.token.trim().length < 20) {
      throw new Error("Le jeton (token) Discord est invalide ou incomplet.");
    }

    // 2. Instantiate Discord.js Client
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
      ]
    });

    // 3. Register Event Listeners
    discordClient.on("ready", () => {
      if (!discordClient || !discordClient.user) return;
      botStatus.status = "online";
      botStatus.username = discordClient.user.tag;
      botStatus.avatarUrl = discordClient.user.displayAvatarURL();
      botStatus.guildsCount = discordClient.guilds.cache.size;
      botStatus.ping = discordClient.ws.ping;
      botStatus.error = null;
      botStatus.channels = getConnectedChannels();
      botStatus.roles = getConnectedRoles();

      addLog("success", `Bot connecté avec succès sous l'identifiant: @${discordClient.user.tag}`);
      addLog("discord", `Présent sur ${botStatus.guildsCount} serveur(s) Discord.`);
      if (currentConfig.dmRelayEnabled && currentConfig.dmRelayChannelId) {
        addLog("dm_relay", `Retranscription des MP activée vers le salon ID: ${currentConfig.dmRelayChannelId}`);
      }
    });

    discordClient.on("guildCreate", (guild) => {
      addLog("discord", `Nouveau serveur rejoint : "${guild.name}" (ID: ${guild.id})`);
      if (discordClient) {
        botStatus.guildsCount = discordClient.guilds.cache.size;
        botStatus.channels = getConnectedChannels();
        botStatus.roles = getConnectedRoles();
      }
    });

    discordClient.on("guildDelete", (guild) => {
      addLog("discord", `Bot retiré du serveur : "${guild.name}"`);
      if (discordClient) {
        botStatus.guildsCount = discordClient.guilds.cache.size;
        botStatus.channels = getConnectedChannels();
        botStatus.roles = getConnectedRoles();
      }
    });

    // Message creation handler
    discordClient.on("messageCreate", async (message: Message) => {
      if (!discordClient || !discordClient.user) return;
      
      // Ignore bot messages to avoid infinite loops
      if (message.author.bot) return;

      // Strict message ID deduplication: guarantee that no message is processed more than once
      if (processedMessageIds.has(message.id)) {
        return;
      }
      processedMessageIds.add(message.id);
      if (processedMessageIds.size > 2000) {
        const firstEntry = processedMessageIds.values().next().value;
        if (firstEntry) processedMessageIds.delete(firstEntry);
      }

      const isDM = message.channel.type === ChannelType.DM;
      const channelId = message.channel.id;
      const channelName = (message.channel as any).name || 'DM';
      const botId = discordClient.user.id;
      const content = message.content.trim();
      const modelToUse = getValidGeminiModel(currentConfig.model);

      // Author identity resolution (Nickname / Display name priority for personalized dynamic context)
      const authorMember = message.guild?.members.cache.get(message.author.id);
      const authorDisplayName = authorMember?.displayName || message.author.displayName || message.author.globalName || message.author.username;
      const authorUsername = message.author.username;
      const authorTag = message.author.tag || message.author.username;

      // Check for inline message reply / reference context
      let referencedMessageInfo: { authorName: string; authorId: string; content: string; isBot: boolean } | null = null;
      let isReplyToBot = false;

      if (message.reference && message.reference.messageId) {
        try {
          const refMsg = await message.channel.messages.fetch(message.reference.messageId);
          if (refMsg) {
            const refMember = message.guild?.members.cache.get(refMsg.author.id);
            const refAuthorName = refMember?.displayName || refMsg.author.displayName || refMsg.author.username;
            const resolvedRefContent = await resolveDiscordMentions(refMsg.content, refMsg, discordClient);
            const isBot = refMsg.author.id === botId;

            if (isBot) {
              isReplyToBot = true;
            }

            referencedMessageInfo = {
              authorName: refAuthorName,
              authorId: refMsg.author.id,
              content: resolvedRefContent,
              isBot
            };
          }
        } catch (e) {}
      }

      // Check mention & prefix triggers
      const isDirectMention = message.mentions.users.has(botId);
      const startsWithPrefix = content.startsWith(currentConfig.prefix);

      // In guild channels: trigger if directly mentioned OR user replies directly to one of the bot's messages
      const allowedByMention = (currentConfig.responseMode === "mention" || currentConfig.responseMode === "both") && (isDirectMention || isReplyToBot);
      const allowedByPrefix = (currentConfig.responseMode === "prefix" || currentConfig.responseMode === "both") && startsWithPrefix;
      const isDirectlyHandled = isDM || allowedByMention || allowedByPrefix;

      // Extract images and inspected web links from the message (and referenced message if applicable)
      const { images: extractedImages, inspectedLinks: extractedLinks } = await resolveMessageMediaAndLinks(message, referencedMessageInfo);

      if (extractedImages.length > 0 || extractedLinks.length > 0) {
        addLog("gemini", `[MULTIMODAL & WEB] Détection de ${extractedImages.length > 0 ? `${extractedImages.length} image(s) ` : ''}${extractedLinks.length > 0 ? `${extractedLinks.length} lien(s) web ` : ''}dans le message de @${message.author.username}`);
      }

      // Evaluate automated Event Rules (AI Behavior & Moderation Triggers) asynchronously
      evaluateAndExecuteEvents(message, isDM, isDirectlyHandled).catch(err => {
        console.error("Erreur lors de l'exécution des règles d'événements:", err);
      });

      // RATE LIMIT CHECK HELPER (Applies to both Servers AND Direct Messages)
      const checkRateLimit = async (): Promise<boolean> => {
        if (!currentConfig.rateLimitEnabled || currentConfig.cooldownSeconds <= 0) return true;

        const userId = message.author.id;
        const rawUsername = message.author.username;
        const cleanUsername = rawUsername.toLowerCase();
        const cleanUserTag = (message.author.tag || rawUsername).toLowerCase();
        const now = Date.now();
        let hasBypass = false;

        // 1. Guild owner bypass: if in guild and owner, or if user owns any mutual guild
        if (message.guild && message.guild.ownerId === userId) {
          hasBypass = true;
        } else if (discordClient) {
          for (const [, guild] of discordClient.guilds.cache) {
            if (guild.ownerId === userId) {
              hasBypass = true;
              break;
            }
          }
        }

        // 2. Explicit User Bypass (User ID, Username, or @Tag) in bypassUsers or bypassRoles
        const userBypassList = [
          ...(currentConfig.bypassUsers || []),
          ...(currentConfig.bypassRoles || [])
        ];

        if (!hasBypass && userBypassList.length > 0) {
          hasBypass = userBypassList.some((bp) => {
            const rawBp = bp.trim();
            const cleanBp = rawBp.toLowerCase().replace(/^@/, '');
            return (
              rawBp === userId ||
              cleanBp === userId ||
              cleanBp === cleanUsername ||
              cleanBp === cleanUserTag ||
              `@${cleanUsername}` === cleanBp
            );
          });
        }

        // 3. Role bypass:
        const roleBypassList = currentConfig.bypassRoles || [];
        if (!hasBypass && roleBypassList.length > 0) {
          // If in server: check member roles
          if (message.member) {
            hasBypass = message.member.roles.cache.some((role) => {
              const roleId = role.id;
              const roleName = role.name.toLowerCase();
              return roleBypassList.some((bp) => {
                const cleanBp = bp.trim().toLowerCase().replace(/^@/, '');
                return cleanBp === roleId || cleanBp === roleName;
              });
            });
          }

          // If in DM (or member roles not cached): check mutual guild memberships
          if (!hasBypass && discordClient) {
            for (const [, guild] of discordClient.guilds.cache) {
              const member = guild.members.cache.get(userId);
              if (member) {
                const memberHasRole = member.roles.cache.some((role) => {
                  const roleId = role.id;
                  const roleName = role.name.toLowerCase();
                  return roleBypassList.some((bp) => {
                    const cleanBp = bp.trim().toLowerCase().replace(/^@/, '');
                    return cleanBp === roleId || cleanBp === roleName;
                  });
                });
                if (memberHasRole) {
                  hasBypass = true;
                  break;
                }
              }
            }
          }
        }

        if (hasBypass) return true;

        const maxRequests = currentConfig.maxRequestsBeforeCooldown || 3;
        const cooldownPeriodMs = currentConfig.cooldownSeconds * 1000;
        let userState = userRateLimitMap.get(userId);

        if (!userState) {
          userState = { requestCount: 0, cooldownUntil: 0 };
          userRateLimitMap.set(userId, userState);
        }

        // Check if user is currently under active cooldown
        if (userState.cooldownUntil > now) {
          const remainingSec = Math.ceil((userState.cooldownUntil - now) / 1000);
          addLog("cooldown", `[LIMITE DE FRÉQUENCE] @${rawUsername} (MP: ${isDM ? 'OUI' : 'NON'}) est en cooldown (${remainingSec}s restantes).`);

          if (currentConfig.notifyOnRateLimit !== false) {
            try {
              await message.reply(`⏳ **Limite atteinte !** Vous avez atteint votre quota de **${maxRequests}** requête${maxRequests > 1 ? 's' : ''}. Veuillez patienter **${remainingSec}s** avant de pouvoir reposer une question.`);
            } catch (e) {}
          }
          return false;
        }

        // If cooldown has expired, reset cooldown timer and counter
        if (userState.cooldownUntil > 0 && userState.cooldownUntil <= now) {
          userState.cooldownUntil = 0;
          userState.requestCount = 0;
        }

        userState.requestCount += 1;

        if (userState.requestCount >= maxRequests) {
          // This request is processed (it's the max-th request), and triggers cooldown for subsequent requests
          userState.cooldownUntil = now + cooldownPeriodMs;
          userState.requestCount = 0;
          addLog("cooldown", `[LIMITE DE FRÉQUENCE] @${rawUsername} a atteint le quota (${maxRequests}/${maxRequests} requêtes). Cooldown de ${currentConfig.cooldownSeconds}s enclenché.`);
        }

        return true;
      };

      // ==========================================
      // CASE 1: DIRECT MESSAGES (MP / DMs)
      // ==========================================
      if (isDM) {
        if (!currentConfig.allowDMs) {
          return; // DMs are disabled in configuration
        }

        const resolvedDMContent = await resolveDiscordMentions(content, message, discordClient);

        // Retranscription du message reçu en MP dans le salon configuré
        if (currentConfig.dmRelayEnabled && currentConfig.dmRelayChannelId) {
          addLog("dm_relay", `[RETRANSCRIPTION MP] Message reçu de @${message.author.username} (${message.author.id})`);
          await relayToChannel(
            discordClient,
            currentConfig.dmRelayChannelId,
            `📩 **[MP Reçu de @${message.author.username} (ID: ${message.author.id})]** :\n${resolvedDMContent}`
          );
        }

        // Apply rate limit check to MP
        const canProceed = await checkRateLimit();
        if (!canProceed) return;

        // Check if message is a custom command in MP
        const startsWithPrefix = content.startsWith(currentConfig.prefix);
        if (startsWithPrefix) {
          const rawWithoutPrefix = content.slice(currentConfig.prefix.length).trim();
          const firstWord = rawWithoutPrefix.split(/\s+/)[0]?.toLowerCase();
          const commandArg = rawWithoutPrefix.slice(firstWord.length).trim();

          const activeCommands = (currentConfig.customCommands || []).filter(c => c.enabled);
          const matchedCommand = activeCommands.find(c => c.name.toLowerCase() === firstWord);

          if (matchedCommand) {
            addLog("command", `[COMMANDE MP] @${message.author.username} a exécuté ${currentConfig.prefix}${matchedCommand.name}`);

            if (matchedCommand.type === 'static') {
              const replyText = matchedCommand.staticResponse || "Commande sans contenu défini.";
              const chunks = splitDiscordMessage(replyText);
              for (const chunk of chunks) {
                await message.author.send(chunk);
              }
              if (currentConfig.dmRelayEnabled && currentConfig.dmRelayChannelId) {
                await relayToChannel(
                  discordClient,
                  currentConfig.dmRelayChannelId,
                  `🤖 **[Réponse Commande ${currentConfig.prefix}${matchedCommand.name} envoyée à @${message.author.username}]** :\n${replyText}`
                );
              }
              return;
            }

            if (matchedCommand.type === 'ai') {
              try {
                await (message.channel as any).sendTyping();
              } catch (e) {}

              const resolvedCommandArg = await resolveDiscordMentions(commandArg, message, discordClient);
              let promptToRun = resolvedCommandArg;
              if (matchedCommand.aiPromptTemplate) {
                promptToRun = matchedCommand.aiPromptTemplate.replace(/\{query\}|\{input\}|\{prompt\}/g, resolvedCommandArg || "Explique le fonctionnement de cette commande");
              }

              if (referencedMessageInfo) {
                promptToRun = `[Message auquel l'utilisateur répond (de @${referencedMessageInfo.authorName}) : "${referencedMessageInfo.content}"]\n\n${promptToRun}`;
              }

              try {
                const replyText = await generateAIResponseWithContext({
                  model: modelToUse,
                  prompt: promptToRun || "Bonjour",
                  systemInstruction: matchedCommand.systemInstruction || currentConfig.systemInstruction,
                  images: extractedImages,
                  inspectedLinks: extractedLinks,
                  sessionContext: {
                    scope: 'dm',
                    userId: message.author.id,
                    userTag: authorTag,
                    userName: authorUsername,
                    displayName: authorDisplayName,
                    channelId: 'dm',
                    channelName: 'MP'
                  }
                });

                const chunks = splitDiscordMessage(replyText);
                for (const chunk of chunks) {
                  await message.author.send(chunk);
                }

                if (currentConfig.dmRelayEnabled && currentConfig.dmRelayChannelId) {
                  await relayToChannel(
                    discordClient,
                    currentConfig.dmRelayChannelId,
                    `🤖 **[Réponse IA ${currentConfig.prefix}${matchedCommand.name} envoyée à ${authorDisplayName} (@${message.author.username})]** :\n${replyText}`
                  );
                }
              } catch (err: any) {
                addLog("error", `Erreur d'appel IA commande MP: ${err.message}`);
                await message.author.send("⚠️ Une erreur est survenue lors de l'exécution de la commande IA.");
              }
              return;
            }
          }
        }

        // Standard DM AI Chat conversation with dynamic conversational memory
        try {
          await (message.channel as any).sendTyping();
        } catch (e) {}

        try {
          addLog("gemini", `[MP] Message de ${authorDisplayName} (@${message.author.username}): "${resolvedDMContent.substring(0, 80)}${resolvedDMContent.length > 80 ? '...' : ''}"`);
          
          let dmPrompt = resolvedDMContent;
          if (referencedMessageInfo) {
            dmPrompt = `[Message auquel l'utilisateur répond (de @${referencedMessageInfo.authorName}) : "${referencedMessageInfo.content}"]\n\n${resolvedDMContent}`;
          }

          const reply = await generateAIResponseWithContext({
            model: modelToUse,
            prompt: dmPrompt,
            systemInstruction: currentConfig.systemInstruction,
            images: extractedImages,
            inspectedLinks: extractedLinks,
            sessionContext: {
              scope: 'dm',
              userId: message.author.id,
              userTag: authorTag,
              userName: authorUsername,
              displayName: authorDisplayName,
              channelId: 'dm',
              channelName: 'MP'
            }
          });

          addLog("success", `[MP] Réponse envoyée à ${authorDisplayName} (@${message.author.username}) (${reply.length} caract.)`);

          const chunks = splitDiscordMessage(reply);
          for (const chunk of chunks) {
            await message.author.send(chunk);
          }

          // Retranscription de la réponse IA dans le salon configuré
          if (currentConfig.dmRelayEnabled && currentConfig.dmRelayChannelId) {
            await relayToChannel(
              discordClient,
              currentConfig.dmRelayChannelId,
              `🤖 **[Réponse IA envoyée à @${message.author.username}]** :\n${reply}`
            );
          }
        } catch (error: any) {
          addLog("error", `Erreur d'appel Gemini AI en MP: ${error.message}`);
          try {
            await message.author.send("⚠️ Une erreur est survenue lors du traitement de votre message par l'IA.");
          } catch (e) {}
        }
        return;
      }

      // ==========================================
      // CASE 2: GUILD CHANNELS (Serveurs Discord)
      // ==========================================

      // 1. Channel Whitelist Restriction
      if (currentConfig.channelRestrictionMode === "whitelist") {
        const allowedList = currentConfig.allowedChannels || [];
        const isChannelAllowed = allowedList.some((allowed) => {
          const trimmed = allowed.trim().toLowerCase();
          if (!trimmed) return false;
          if (trimmed === channelId) return true;
          const targetName = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
          return channelName.toLowerCase() === targetName;
        });

        if (!isChannelAllowed) {
          return; // Ignore message silently on unallowed channels
        }
      }

      // 2. Strict Response Mode Filtering (Mention OR Prefix ONLY)
      if (!allowedByMention && !allowedByPrefix) {
        // STRICT SILENCE: The bot NEVER reacts to general conversation messages
        return;
      }

      // 3. Rate Limit Check
      const canProceed = await checkRateLimit();
      if (!canProceed) return;

      // 4. Handle Custom Commands execution (via Prefix)
      if (allowedByPrefix) {
        const rawWithoutPrefix = content.slice(currentConfig.prefix.length).trim();
        const firstWord = rawWithoutPrefix.split(/\s+/)[0]?.toLowerCase();
        const commandArg = rawWithoutPrefix.slice(firstWord.length).trim();

        const activeCommands = (currentConfig.customCommands || []).filter(c => c.enabled);
        const matchedCommand = activeCommands.find(c => c.name.toLowerCase() === firstWord);

        if (matchedCommand) {
          addLog("command", `[COMMANDE SERVEUR] @${message.author.username} dans #${channelName} : ${currentConfig.prefix}${matchedCommand.name}`);

          // A. Static Custom Command
          if (matchedCommand.type === 'static') {
            const replyText = matchedCommand.staticResponse || "Commande sans contenu défini.";
            const chunks = splitDiscordMessage(replyText);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
            return;
          }

          // B. AI Custom Command with parameter
          if (matchedCommand.type === 'ai') {
            try {
              await (message.channel as any).sendTyping();
            } catch (e) {}

            const resolvedArg = await resolveDiscordMentions(commandArg, message, discordClient);
            let promptToRun = resolvedArg;

            if (!promptToRun && referencedMessageInfo) {
              promptToRun = referencedMessageInfo.content;
            }

            if (matchedCommand.aiPromptTemplate) {
              promptToRun = matchedCommand.aiPromptTemplate.replace(/\{query\}|\{input\}|\{prompt\}/g, promptToRun || "Explique le fonctionnement de cette commande");
            }

            if (referencedMessageInfo && resolvedArg) {
              promptToRun = `[Message auquel l'utilisateur répond (de @${referencedMessageInfo.authorName}) : "${referencedMessageInfo.content}"]\n\n${promptToRun}`;
            }

            try {
              addLog("gemini", `[COMMANDE IA] Exécution de ${currentConfig.prefix}${matchedCommand.name} avec paramètre : "${promptToRun.substring(0, 60)}..."`);
              
              const replyText = await generateAIResponseWithContext({
                model: modelToUse,
                prompt: promptToRun || "Bonjour",
                systemInstruction: matchedCommand.systemInstruction || currentConfig.systemInstruction,
                images: extractedImages,
                inspectedLinks: extractedLinks,
                sessionContext: {
                  scope: 'guild',
                  userId: message.author.id,
                  userTag: authorTag,
                  userName: authorUsername,
                  displayName: authorDisplayName,
                  channelId: channelId,
                  channelName: channelName
                }
              });

              addLog("success", `Réponse envoyée pour commande ${currentConfig.prefix}${matchedCommand.name}`);
              const chunks = splitDiscordMessage(replyText);
              for (const chunk of chunks) {
                await message.reply(chunk);
              }
            } catch (err: any) {
              addLog("error", `Erreur IA commande: ${err.message}`);
              await message.reply("⚠️ Une erreur est survenue lors de l'exécution de la commande IA.");
            }
            return;
          }
        }

        // If prefix used but no matching custom command:
        // Treat the remaining text as a direct AI query (e.g. "!quelle est la capitale de l'Islande ?")
        if (!rawWithoutPrefix && extractedImages.length === 0 && extractedLinks.length === 0) {
          try {
            await message.reply(`🤖 Bonjour ! Tapez \`${currentConfig.prefix}help\` pour voir les commandes disponibles ou posez-moi votre question directement.`);
          } catch (e) {}
          return;
        }

        try {
          await (message.channel as any).sendTyping();
        } catch (e) {}

        try {
          let resolvedQuery = await resolveDiscordMentions(rawWithoutPrefix, message, discordClient);
          if (referencedMessageInfo) {
            resolvedQuery = `[Message auquel l'utilisateur répond (de @${referencedMessageInfo.authorName}) : "${referencedMessageInfo.content}"]\n\n${resolvedQuery}`;
          }

          addLog("gemini", `Message reçu avec préfixe de ${authorDisplayName} (@${message.author.username}) dans #${channelName}: "${resolvedQuery.substring(0, 80)}..."`);
          
          const reply = await generateAIResponseWithContext({
            model: modelToUse,
            prompt: resolvedQuery,
            systemInstruction: currentConfig.systemInstruction,
            images: extractedImages,
            inspectedLinks: extractedLinks,
            sessionContext: {
              scope: 'guild',
              userId: message.author.id,
              userTag: authorTag,
              userName: authorUsername,
              displayName: authorDisplayName,
              channelId: channelId,
              channelName: channelName
            }
          });

          addLog("success", `Réponse envoyée (${reply.length} caract.): "${reply.substring(0, 80)}${reply.length > 80 ? '...' : ''}"`);

          const chunks = splitDiscordMessage(reply);
          for (const chunk of chunks) {
            await message.reply(chunk);
          }
        } catch (error: any) {
          addLog("error", `Erreur d'appel Gemini AI: ${error.message}`);
          try {
            await message.reply("⚠️ Une erreur est survenue lors du traitement de votre message par l'IA.");
          } catch (e) {}
        }
        return;
      }

      // 5. Handle Direct Mention OR Reply to Bot (@Bot [message] or replying to a bot message)
      if (allowedByMention) {
        const cleanPrompt = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
        let resolvedPrompt = await resolveDiscordMentions(cleanPrompt, message, discordClient);

        // If no text was written with the mention and no referenced message and no media/links:
        if (!resolvedPrompt && !referencedMessageInfo && extractedImages.length === 0 && extractedLinks.length === 0) {
          try {
            await message.reply(`Bonjour <@${message.author.id}> ! Comment puis-je vous aider ? (Tapez \`${currentConfig.prefix}help\` pour voir les commandes disponibles).`);
          } catch (e) {}
          return;
        }

        // If user tagged the bot on a reply without extra text (e.g. replying with just "@Bot"):
        if (!resolvedPrompt && referencedMessageInfo) {
          resolvedPrompt = `[Message cité de @${referencedMessageInfo.authorName} : "${referencedMessageInfo.content}"]\n\nL'utilisateur a mentionné le bot en réponse à ce message. Donne une réaction pertinente et engageante au sujet abordé.`;
        } else if (resolvedPrompt && referencedMessageInfo) {
          resolvedPrompt = `[Message auquel l'utilisateur répond (de @${referencedMessageInfo.authorName}) : "${referencedMessageInfo.content}"]\n\n${resolvedPrompt}`;
        }

        try {
          await (message.channel as any).sendTyping();
        } catch (e) {}

        try {
          const logContext = referencedMessageInfo ? ` (en réponse à @${referencedMessageInfo.authorName})` : '';
          addLog("gemini", `Mention/Réponse reçue de ${authorDisplayName} (@${message.author.username})${logContext} dans #${channelName}: "${resolvedPrompt.substring(0, 80)}..."`);
          
          const reply = await generateAIResponseWithContext({
            model: modelToUse,
            prompt: resolvedPrompt,
            systemInstruction: currentConfig.systemInstruction,
            images: extractedImages,
            inspectedLinks: extractedLinks,
            sessionContext: {
              scope: 'guild',
              userId: message.author.id,
              userTag: authorTag,
              userName: authorUsername,
              displayName: authorDisplayName,
              channelId: channelId,
              channelName: channelName
            }
          });

          addLog("success", `Réponse envoyée à ${authorDisplayName} (@${message.author.username}): "${reply.substring(0, 80)}..."`);

          const chunks = splitDiscordMessage(reply);
          for (const chunk of chunks) {
            await message.reply(chunk);
          }
        } catch (error: any) {
          addLog("error", `Erreur d'appel Gemini AI sur mention: ${error.message}`);
          try {
            await message.reply("⚠️ Une erreur est survenue lors du traitement de votre message par l'IA.");
          } catch (e) {}
        }
        return;
      }
    });

    // 6. Authenticate bot
    await discordClient.login(config.token);

  } catch (error: any) {
    addLog("error", `Échec de connexion Discord: ${error.message}`);
    botStatus.status = "offline";
    botStatus.error = error.message || "Impossible de se connecter au bot Discord.";
    discordClient = null;
  } finally {
    isStartingBot = false;
  }
}

// Function to stop the Discord Bot
async function stopDiscordBot() {
  if (discordClient) {
    try {
      discordClient.removeAllListeners();
      await discordClient.destroy();
      addLog("system", "Bot Discord déconnecté avec succès.");
    } catch (e: any) {
      addLog("error", `Erreur lors de l'arrêt du bot: ${e.message}`);
    }
    discordClient = null;
  }
  botStatus.status = "offline";
  botStatus.username = null;
  botStatus.avatarUrl = null;
  botStatus.guildsCount = 0;
  botStatus.ping = null;
  botStatus.channels = [];
  botStatus.roles = [];
  userRateLimitMap.clear();
}

// REST API Endpoints
app.get("/api/bot/status", (req, res) => {
  // Update ping dynamic info, channels, and roles if connected
  if (discordClient && botStatus.status === "online") {
    botStatus.ping = discordClient.ws.ping;
    botStatus.guildsCount = discordClient.guilds.cache.size;
    botStatus.channels = getConnectedChannels();
    botStatus.roles = getConnectedRoles();
  }
  res.json({
    status: botStatus,
    config: currentConfig
  });
});

app.get("/api/bot/logs", (req, res) => {
  res.json({ logs });
});

// Dynamic Context Sessions endpoint
app.get("/api/bot/dynamic-context", (req, res) => {
  const now = Date.now();
  const retentionMs = (currentConfig.dynamicContextRetentionMinutes || 15) * 60 * 1000;
  const sessions = [];

  for (const [key, session] of dynamicContextStore.entries()) {
    const elapsed = now - session.lastActive;
    if (elapsed <= retentionMs) {
      const remainingMinutes = Math.max(0, Math.ceil((retentionMs - elapsed) / 60000));
      sessions.push({
        key,
        scope: session.scope,
        type: session.scope === 'dm' ? 'dm' : session.scope === 'simulator' ? 'sim' : 'guild',
        userTag: session.userTag,
        userName: session.userName || session.userTag,
        displayName: session.displayName || session.userTag,
        channelName: session.channelName,
        messageCount: session.history.length,
        lastActiveFormatted: new Date(session.lastActive).toLocaleTimeString('fr-FR'),
        expiresInMinutes: remainingMinutes
      });
    }
  }

  res.json({
    enabled: currentConfig.dynamicContextEnabled !== false,
    retentionMinutes: currentConfig.dynamicContextRetentionMinutes || 15,
    maxTurns: currentConfig.dynamicContextMaxTurns || 6,
    activeSessionsCount: sessions.length,
    sessions
  });
});

// Clear Dynamic Context Sessions endpoint
app.post("/api/bot/dynamic-context/clear", (req, res) => {
  const { sessionKey } = req.body;
  if (sessionKey) {
    dynamicContextStore.delete(sessionKey);
    addLog("system", `[MÉMOIRE DYNAMIQUE] Session de contexte supprimée manuellement: ${sessionKey}`);
  } else {
    const count = dynamicContextStore.size;
    dynamicContextStore.clear();
    addLog("system", `[MÉMOIRE DYNAMIQUE] Toutes les mémoires de contexte conversationnel ont été purgées (${count} sessions).`);
  }
  res.json({ success: true, message: "Mémoire dynamique réinitialisée." });
});

app.post("/api/bot/start", async (req, res) => {
  const { config } = req.body;
  if (!config || !config.token) {
    return res.status(400).json({ error: "Le jeton (token) du bot est requis." });
  }
  startDiscordBot(config);
  res.json({ success: true, message: "Lancement du bot démarré." });
});

app.post("/api/bot/stop", async (req, res) => {
  await stopDiscordBot();
  res.json({ success: true, message: "Bot arrêté." });
});

// Test Event Rules Endpoint: evaluates a message against configured event triggers
app.post("/api/bot/events/test", async (req, res) => {
  try {
    const { message, events, model } = req.body;
    if (!message || !events || !Array.isArray(events) || events.length === 0) {
      return res.json({ results: [] });
    }

    const modelToUse = getValidGeminiModel(model || currentConfig.model);

    const evaluationPrompt = `
Tu es un moteur d'analyse et de détection d'événements pour un bot Discord.
Voici un message envoyé par un utilisateur (ex: @JoueurTest dans #general) :
"""
${message}
"""

Voici la liste des règles d'événements configurées :
${JSON.stringify(events.map((r: any) => ({ id: r.id, name: r.name, triggerPrompt: r.triggerPrompt })))}

Pour chaque règle, analyse attentivement si le message correspond ou non au critère décrit dans "triggerPrompt".
Sois précis : déclenche la règle uniquement si le message correspond au comportement ou à la demande visée.

Réponds UNIQUEMENT avec un objet JSON valide suivant ce format exact :
{
  "matches": [
    {
      "id": "id-de-la-regle",
      "matched": true,
      "reason": "Explication courte du déclenchement en 10-15 mots"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: evaluationPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let data: any = {};
    try {
      const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      data = JSON.parse(cleanJson);
    } catch (e) {
      data = { matches: [] };
    }

    const results = (events as BotEventRule[]).map((rule) => {
      const match = (data.matches || []).find((m: any) => m.id === rule.id);
      const isMatched = !!match?.matched;
      let simulatedAction = "";
      if (isMatched) {
        if (rule.actionType === 'dm') {
          simulatedAction = `Envoi d'un Message Privé (MP) à ${rule.dmTarget === 'author' ? '@JoueurTest' : (rule.dmTargetId || 'destinataire')}`;
        } else if (rule.actionType === 'channel') {
          simulatedAction = `Alerte envoyée dans ${rule.channelTargetType === 'source_channel' ? '#salon-actuel' : '#' + (rule.channelId || 'alertes')}`;
        } else {
          simulatedAction = `MP à @JoueurTest + Alerte dans #${rule.channelId || 'alertes'}`;
        }
      }
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        matched: isMatched,
        reason: match?.reason || (isMatched ? "Critère correspondant" : "Aucun déclenchement pour ce message"),
        simulatedAction
      };
    });

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Simulator Endpoint: Simulate chatbot or custom commands on web dashboard
app.post("/api/bot/test-message", async (req, res) => {
  const { message, config, resetContext, testerPseudo, images } = req.body;
  if (!message && (!images || images.length === 0)) {
    return res.status(400).json({ error: "Le message ou l'image est requis." });
  }

  const testerName = (testerPseudo && typeof testerPseudo === 'string' && testerPseudo.trim()) ? testerPseudo.trim() : "Alex";
  const testerUsername = testerName.toLowerCase().replace(/\s+/g, '_');

  if (resetContext) {
    dynamicContextStore.delete("sim_web_user");
    dynamicContextStore.delete(`sim_${testerUsername}`);
  }

  const model = getValidGeminiModel(config?.model || currentConfig.model);
  const systemInstruction = config?.systemInstruction || currentConfig.systemInstruction;
  const prefix = config?.prefix || currentConfig.prefix || "!";
  const customCommands: CustomCommand[] = (config?.customCommands || currentConfig.customCommands || []).filter((c: CustomCommand) => c.enabled);
  const events: BotEventRule[] = (config?.events || currentConfig.events || []).filter((e: BotEventRule) => e.enabled);

  // Format and inspect any provided images and URLs in message
  const simImages: InspectedImage[] = [];
  if (Array.isArray(images)) {
    for (const img of images) {
      if (img.data && img.mimeType) {
        simImages.push({
          mimeType: img.mimeType,
          data: img.data,
          name: img.name || 'image_simulee'
        });
      }
    }
  }

  const detectedUrls = extractUrlsFromText(message || "");
  const inspectedLinks: InspectedLink[] = [];
  for (const url of detectedUrls.slice(0, 3)) {
    const inspected = await inspectAndFetchUrl(url);
    if (inspected) {
      if (inspected.type === 'image' && inspected.image) {
        simImages.push(inspected.image);
      } else if (inspected.link) {
        inspectedLinks.push(inspected.link);
      }
    }
  }

  const mediaSummary = `${simImages.length > 0 ? ` [${simImages.length} image(s)]` : ''}${inspectedLinks.length > 0 ? ` [${inspectedLinks.length} lien(s) web]` : ''}`;
  addLog("gemini", `[SIMULATEUR] Test du message de ${testerName}${mediaSummary} : "${message || '(sans texte)'}"`);

  // Evaluate active events for simulator notification
  let triggeredEvents: Array<{ name: string; reason: string; action: string }> = [];
  if (events.length > 0) {
    try {
      const evalPrompt = `
Un utilisateur "${testerName}" (@${testerUsername}) envoie : "${message || 'Image sans texte'}".
Évalue si ce message déclenche l'une de ces règles :
${JSON.stringify(events.map(e => ({ id: e.id, name: e.name, triggerPrompt: e.triggerPrompt })))}
Réponds avec un JSON { "matches": [{ "id": "...", "matched": true|false, "reason": "..." }] }
`;
      const evalRes = await ai.models.generateContent({
        model: model,
        contents: evalPrompt,
        config: { responseMimeType: "application/json" }
      });
      const clean = (evalRes.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.matches && Array.isArray(parsed.matches)) {
        for (const m of parsed.matches) {
          if (m.matched) {
            const ev = events.find(e => e.id === m.id);
            if (ev) {
              triggeredEvents.push({
                name: ev.name,
                reason: m.reason || "Critère validé",
                action: ev.actionType === 'dm' ? "MP généré" : ev.actionType === 'channel' ? "Alerte salon générée" : "MP + Alerte salon générés"
              });
              addLog("event", `[SIMULATEUR - ÉVÈNEMENT DÉCLENCHÉ] "${ev.name}" : ${m.reason}`);
            }
          }
        }
      }
    } catch (e) {}
  }

  // 1. Check if user typed a command in simulator (e.g. "!help", "!code comment trier...")
  if (message && message.startsWith(prefix)) {
    const rawWithoutPrefix = message.slice(prefix.length).trim();
    const firstWord = rawWithoutPrefix.split(/\s+/)[0]?.toLowerCase();
    const commandArg = rawWithoutPrefix.slice(firstWord.length).trim();

    const matchedCommand = customCommands.find(c => c.name.toLowerCase() === firstWord);

    if (matchedCommand) {
      if (matchedCommand.type === 'static') {
        const reply = matchedCommand.staticResponse || "Commande statique sans texte configuré.";
        addLog("command", `[SIMULATEUR - COMMANDE STATIQUE] ${prefix}${matchedCommand.name}`);
        return res.json({
          reply,
          commandName: matchedCommand.name,
          commandType: 'static',
          triggeredEvents,
          inspectedLinks,
          imagesCount: simImages.length
        });
      }

      if (matchedCommand.type === 'ai') {
        let promptToRun = commandArg;
        if (matchedCommand.aiPromptTemplate) {
          promptToRun = matchedCommand.aiPromptTemplate.replace(/\{query\}|\{input\}|\{prompt\}/g, commandArg || "Explique cette commande");
        }

        try {
          addLog("command", `[SIMULATEUR - COMMANDE IA] ${prefix}${matchedCommand.name}`);
          const reply = await generateAIResponseWithContext({
            model: model,
            prompt: promptToRun || "Bonjour",
            systemInstruction: matchedCommand.systemInstruction || systemInstruction,
            images: simImages,
            inspectedLinks: inspectedLinks,
            sessionContext: {
              scope: 'simulator',
              userId: testerUsername,
              userTag: testerName,
              userName: testerUsername,
              displayName: testerName,
              channelId: 'simulator',
              channelName: 'Simulateur'
            }
          });

          return res.json({
            reply,
            commandName: matchedCommand.name,
            commandType: 'ai',
            triggeredEvents,
            inspectedLinks,
            imagesCount: simImages.length
          });
        } catch (err: any) {
          return res.status(500).json({ error: err.message });
        }
      }
    }
  }

  // 2. Direct Prompt Simulation with Dynamic Context Memory
  try {
    const reply = await generateAIResponseWithContext({
      model: model,
      prompt: message || "",
      systemInstruction: systemInstruction,
      images: simImages,
      inspectedLinks: inspectedLinks,
      sessionContext: {
        scope: 'simulator',
        userId: testerUsername,
        userTag: testerName,
        userName: testerUsername,
        displayName: testerName,
        channelId: 'simulator',
        channelName: 'Simulateur'
      }
    });

    addLog("success", `[SIMULATEUR] Réponse générée: "${reply}"`);
    res.json({
      reply,
      triggeredEvents,
      inspectedLinks,
      imagesCount: simImages.length
    });
  } catch (error: any) {
    addLog("error", `[SIMULATEUR] Erreur: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Clear Logs Endpoint
app.post("/api/bot/logs/clear", (req, res) => {
  logs = [];
  addLog("system", "Historique de la console vidé.");
  res.json({ success: true });
});

// Global Error Handler for payload size and json parsing
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      error: "La taille du fichier ou de la requête est trop volumineuse (limite : 50 Mo)."
    });
  }
  next(err);
});

// Vite middleware configuration and Static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
