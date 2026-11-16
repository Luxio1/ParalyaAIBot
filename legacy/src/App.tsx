import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Settings, 
  Terminal, 
  MessageSquare, 
  HelpCircle, 
  Power, 
  RefreshCw, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Users, 
  Sliders, 
  Sparkles, 
  Cpu, 
  BookOpen, 
  ArrowRight,
  Check,
  AlertCircle,
  Compass,
  Hash,
  Shield,
  Plus,
  X,
  Lock,
  Timer,
  ShieldCheck,
  Zap,
  Gauge,
  SlidersHorizontal,
  ChevronRight,
  Send,
  MessageCircle,
  Inbox,
  AtSign,
  Command,
  UserCheck,
  Brain,
  Clock,
  History,
  RotateCcw,
  Image as ImageIcon,
  Paperclip,
  Globe,
  Link2,
  Eye
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BotConfig, LogEntry, BotStatus, CustomCommand, DynamicSessionInfo, BotEventRule } from "./types";
import CustomCommandsManager from "./components/CustomCommandsManager";
import EventManager, { DEFAULT_PRESET_EVENTS } from "./components/EventManager";

// Pre-defined personas for the bot
const PERSONA_PRESETS = [
  {
    name: "Assistant Polyvalent",
    icon: Sparkles,
    description: "Amical, professionnel et concis. Répond avec clarté à toutes les demandes.",
    instruction: "Tu es un assistant virtuel utile, amical et très clair. Réponds toujours avec courtoisie de manière concise en utilisant des listes à puces si nécessaire."
  },
  {
    name: "Sarcastic & Piquant",
    icon: Bot,
    description: "Humour grinçant, répliques ironiques, mais reste informatif.",
    instruction: "Tu es un bot Discord doté d'une personnalité cynique, ironique et sarcastique. Tu adores faire de l'humour pince-sans-rire, mais tu finis quand même par donner de vraies réponses utiles sous tes airs désabusés. Reste concis."
  },
  {
    name: "Tuteur Dev / Code",
    icon: Cpu,
    description: "Expert en programmation. Explique avec pédagogie et fournit du code propre.",
    instruction: "Tu es un tuteur expert en informatique et programmation. Explique les concepts de manière simple, conseille les bonnes pratiques et présente des blocs de code formatés en Markdown de manière impeccable."
  },
  {
    name: "Maître du Donjon (RPG)",
    icon: Compass,
    description: "Narrateur immersif pour des aventures fantastiques de jeu de rôle.",
    instruction: "Tu es un Maître du Donjon pour un jeu de rôle médiéval-fantastique. Parle avec un ton mystérieux et épique. Quand l'utilisateur te parle, réagis comme s'il était un aventurier dans ton monde et propose-lui de faire des choix."
  },
  {
    name: "Coach Motivationnel",
    icon: Sliders,
    description: "Énergie positive débordante, t'aide à surmonter les obstacles.",
    instruction: "Tu es un coach de vie ultra-dynamique, positif et motivant. Utilise des expressions encourageantes, booste la confiance en soi de l'utilisateur et donne des conseils pratiques pour surmonter la procrastination."
  }
];

// Initial default custom commands
const DEFAULT_CUSTOM_COMMANDS: CustomCommand[] = [
  {
    id: "cmd-help",
    name: "help",
    description: "Affiche la liste des commandes disponibles et l'aide générale",
    enabled: true,
    type: "static",
    staticResponse: "🤖 **Commandes disponibles :**\n- `!help` : Afficher cette aide\n- `!regles` : Consulter les règles du serveur\n- `!code <votre question>` : Poser une question à l'expert IA en programmation\n- `!traduis <texte>` : Traduire un texte en anglais\n- `!resume <texte>` : Obtenir un résumé concis\n\n💡 Vous pouvez aussi me mentionner directement avec `@MonBot [votre question]` pour discuter librement !"
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
];

export default function App() {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "commands" | "events" | "persona" | "playground" | "guide">("dashboard");

  // Local storage keys
  const [token, setToken] = useState(() => localStorage.getItem("discord_token") || "");
  const [clientId, setClientId] = useState(() => localStorage.getItem("discord_client_id") || "");
  const [prefix, setPrefix] = useState(() => localStorage.getItem("discord_prefix") || "!");
  
  // Response Mode: 'both' | 'mention' | 'prefix' (Note: 'all' has been removed per instructions)
  const [responseMode, setResponseMode] = useState<'both' | 'mention' | 'prefix'>(() => {
    const saved = localStorage.getItem("discord_response_mode");
    if (saved === "mention" || saved === "prefix" || saved === "both") {
      return saved;
    }
    return "both";
  });

  const [systemInstruction, setSystemInstruction] = useState(() => {
    return localStorage.getItem("discord_system_instruction") || PERSONA_PRESETS[0].instruction;
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem("discord_model");
    if (!saved || saved === "gemini-2.0-flash" || saved === "gemini-1.5-flash") {
      return "gemini-3.7-flash";
    }
    return saved;
  });

  // Channel Restriction State
  const [channelRestrictionMode, setChannelRestrictionMode] = useState<'all' | 'whitelist'>(() => {
    return (localStorage.getItem("discord_channel_mode") as any) || "all";
  });
  const [allowedChannels, setAllowedChannels] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("discord_allowed_channels") || "[]");
    } catch {
      return [];
    }
  });
  const [allowDMs, setAllowDMs] = useState<boolean>(() => {
    return localStorage.getItem("discord_allow_dms") !== "false";
  });
  const [channelInput, setChannelInput] = useState("");

  // Rate Limiting (Cooldown) & Bypass Role State (Applies to Servers AND DMs)
  const [rateLimitEnabled, setRateLimitEnabled] = useState<boolean>(() => {
    return localStorage.getItem("discord_ratelimit_enabled") === "true";
  });
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(() => {
    const saved = localStorage.getItem("discord_cooldown_seconds");
    return saved ? parseInt(saved, 10) : 15;
  });
  const [maxRequestsBeforeCooldown, setMaxRequestsBeforeCooldown] = useState<number>(() => {
    const saved = localStorage.getItem("discord_max_requests_before_cooldown");
    return saved ? parseInt(saved, 10) : 3;
  });
  const [bypassRoles, setBypassRoles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("discord_bypass_roles") || "[]");
    } catch {
      return [];
    }
  });
  const [bypassUsers, setBypassUsers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("discord_bypass_users") || "[]");
    } catch {
      return [];
    }
  });
  const [notifyOnRateLimit, setNotifyOnRateLimit] = useState<boolean>(() => {
    return localStorage.getItem("discord_notify_ratelimit") !== "false";
  });
  const [roleInput, setRoleInput] = useState("");
  const [userBypassInput, setUserBypassInput] = useState("");

  // Dynamic Context (Conversational Memory) State
  const [dynamicContextEnabled, setDynamicContextEnabled] = useState<boolean>(() => {
    return localStorage.getItem("discord_dynamic_context_enabled") !== "false";
  });
  const [dynamicContextRetentionMinutes, setDynamicContextRetentionMinutes] = useState<number>(() => {
    const saved = localStorage.getItem("discord_dynamic_context_retention");
    return saved ? parseInt(saved, 10) : 15;
  });
  const [dynamicContextMaxTurns, setDynamicContextMaxTurns] = useState<number>(() => {
    const saved = localStorage.getItem("discord_dynamic_context_max_turns");
    return saved ? parseInt(saved, 10) : 6;
  });
  const [dynamicSessions, setDynamicSessions] = useState<DynamicSessionInfo[]>([]);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);
  const [isClearingContext, setIsClearingContext] = useState<boolean>(false);

  // Custom Commands State
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>(() => {
    try {
      const saved = localStorage.getItem("discord_custom_commands");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CUSTOM_COMMANDS;
  });

  // Automated Event Rules State (Déclencheurs comportementaux & Modération IA)
  const [events, setEvents] = useState<BotEventRule[]>(() => {
    try {
      const saved = localStorage.getItem("discord_events");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PRESET_EVENTS;
  });

  // DM Relay State (Retranscription des MP et réponses du bot vers un salon dédié)
  const [dmRelayEnabled, setDmRelayEnabled] = useState<boolean>(() => {
    return localStorage.getItem("discord_dm_relay_enabled") === "true";
  });
  const [dmRelayChannelId, setDmRelayChannelId] = useState<string>(() => {
    return localStorage.getItem("discord_dm_relay_channel_id") || "";
  });

  // Server state
  const [botStatus, setBotStatus] = useState<BotStatus>({
    status: "offline",
    username: null,
    avatarUrl: null,
    guildsCount: 0,
    ping: null,
    error: null,
    channels: [],
    roles: []
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isStartingOrStopping, setIsStartingOrStopping] = useState(false);

  // Playground simulator state
  const [chatMessages, setChatMessages] = useState<{
    sender: 'user' | 'bot' | 'system';
    text: string;
    timestamp: string;
    badge?: string;
    imagePreview?: string;
    inspectedLinks?: Array<{ url: string; title: string; description?: string }>;
  }[]>([
    { 
      sender: 'system', 
      text: "Simulateur de canal Discord avec Vision Multimodale et Consultation Web.\n• Vous pouvez poser une question, joindre une image ou coller un lien web (ex: article Wikipédia, GitHub, site d'actualités).\n• Tapez une commande (ex: `!help`, `!regles`, `!code ...`) ou discutez directement pour tester la mémoire contextuelle.", 
      timestamp: new Date().toLocaleTimeString('fr-FR') 
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [selectedSimImage, setSelectedSimImage] = useState<{
    name: string;
    mimeType: string;
    data: string; // base64
    previewUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [simulatorPseudo, setSimulatorPseudo] = useState<string>(() => {
    return localStorage.getItem("discord_sim_pseudo") || "Alex";
  });
  const [isBotRespondingInSimulator, setIsBotRespondingInSimulator] = useState(false);

  // UI state
  const [copiedInvite, setCopiedInvite] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Save config to local storage on changes
  useEffect(() => {
    localStorage.setItem("discord_token", token);
    localStorage.setItem("discord_client_id", clientId);
    localStorage.setItem("discord_prefix", prefix);
    localStorage.setItem("discord_response_mode", responseMode);
    localStorage.setItem("discord_system_instruction", systemInstruction);
    localStorage.setItem("discord_model", selectedModel);
    localStorage.setItem("discord_channel_mode", channelRestrictionMode);
    localStorage.setItem("discord_allowed_channels", JSON.stringify(allowedChannels));
    localStorage.setItem("discord_allow_dms", allowDMs.toString());
    localStorage.setItem("discord_ratelimit_enabled", rateLimitEnabled.toString());
    localStorage.setItem("discord_cooldown_seconds", cooldownSeconds.toString());
    localStorage.setItem("discord_max_requests_before_cooldown", maxRequestsBeforeCooldown.toString());
    localStorage.setItem("discord_bypass_roles", JSON.stringify(bypassRoles));
    localStorage.setItem("discord_bypass_users", JSON.stringify(bypassUsers));
    localStorage.setItem("discord_notify_ratelimit", notifyOnRateLimit.toString());
    localStorage.setItem("discord_dynamic_context_enabled", dynamicContextEnabled.toString());
    localStorage.setItem("discord_dynamic_context_retention", dynamicContextRetentionMinutes.toString());
    localStorage.setItem("discord_dynamic_context_max_turns", dynamicContextMaxTurns.toString());
    localStorage.setItem("discord_custom_commands", JSON.stringify(customCommands));
    localStorage.setItem("discord_events", JSON.stringify(events));
    localStorage.setItem("discord_dm_relay_enabled", dmRelayEnabled.toString());
    localStorage.setItem("discord_dm_relay_channel_id", dmRelayChannelId);
    localStorage.setItem("discord_sim_pseudo", simulatorPseudo);
  }, [
    token, 
    clientId, 
    prefix, 
    responseMode, 
    systemInstruction, 
    selectedModel, 
    channelRestrictionMode, 
    allowedChannels, 
    allowDMs, 
    rateLimitEnabled, 
    cooldownSeconds, 
    maxRequestsBeforeCooldown,
    bypassRoles, 
    bypassUsers,
    notifyOnRateLimit, 
    dynamicContextEnabled,
    dynamicContextRetentionMinutes,
    dynamicContextMaxTurns,
    customCommands,
    events,
    dmRelayEnabled,
    dmRelayChannelId,
    simulatorPseudo
  ]);

  // Channel manipulation helpers
  const handleAddChannel = (rawChannel: string) => {
    const trimmed = rawChannel.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setAllowedChannels(prev => {
      const updated = [...prev];
      for (const part of parts) {
        if (!updated.includes(part)) {
          updated.push(part);
        }
      }
      return updated;
    });
    setChannelInput("");
  };

  const handleRemoveChannel = (channelToRemove: string) => {
    setAllowedChannels(prev => prev.filter(c => c !== channelToRemove));
  };

  const handleToggleDetectedChannel = (channelId: string, channelName: string) => {
    const isIncluded = allowedChannels.includes(channelId) || allowedChannels.includes(`#${channelName}`) || allowedChannels.includes(channelName);
    if (isIncluded) {
      setAllowedChannels(prev => prev.filter(c => c !== channelId && c !== `#${channelName}` && c !== channelName));
    } else {
      setAllowedChannels(prev => [...prev, channelId]);
    }
  };

  // Role manipulation helpers
  const handleAddBypassRole = (rawRole: string) => {
    const trimmed = rawRole.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setBypassRoles(prev => {
      const updated = [...prev];
      for (const part of parts) {
        if (!updated.includes(part)) {
          updated.push(part);
        }
      }
      return updated;
    });
    setRoleInput("");
  };

  const handleRemoveBypassRole = (roleToRemove: string) => {
    setBypassRoles(prev => prev.filter(r => r !== roleToRemove));
  };

  const handleToggleDetectedRole = (roleId: string, roleName: string) => {
    const isIncluded = bypassRoles.includes(roleId) || bypassRoles.includes(`@${roleName}`) || bypassRoles.includes(roleName);
    if (isIncluded) {
      setBypassRoles(prev => prev.filter(r => r !== roleId && r !== `@${roleName}` && r !== roleName));
    } else {
      setBypassRoles(prev => [...prev, roleId]);
    }
  };

  // User bypass manipulation helpers (Work for both MP / DMs and Servers)
  const handleAddBypassUser = (rawUser: string) => {
    const trimmed = rawUser.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    setBypassUsers(prev => {
      const updated = [...prev];
      for (const part of parts) {
        if (!updated.includes(part)) {
          updated.push(part);
        }
      }
      return updated;
    });
    setUserBypassInput("");
  };

  const handleRemoveBypassUser = (userToRemove: string) => {
    setBypassUsers(prev => prev.filter(u => u !== userToRemove));
  };

  // Fetch status, logs, and dynamic context sessions
  const fetchStatusAndLogs = async () => {
    try {
      const statusRes = await fetch("/api/bot/status");
      if (statusRes.ok) {
        const data = await statusRes.json();
        setBotStatus(data.status);
      }

      const logsRes = await fetch("/api/bot/logs");
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
      }

      const ctxRes = await fetch("/api/bot/dynamic-context");
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        setDynamicSessions(ctxData.sessions || []);
        setActiveSessionsCount(ctxData.activeSessionsCount || 0);
      }
    } catch (e) {
      console.error("Erreur de récupération des données du bot:", e);
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
    const interval = setInterval(fetchStatusAndLogs, 1500);
    return () => clearInterval(interval);
  }, []);

  // Trigger manual refresh
  const handleManualRefresh = async () => {
    setIsRefreshingStatus(true);
    await fetchStatusAndLogs();
    setTimeout(() => setIsRefreshingStatus(false), 600);
  };

  // Clear Dynamic Context (Conversational Memory)
  const handleClearDynamicContext = async (sessionKey?: string) => {
    setIsClearingContext(true);
    try {
      await fetch("/api/bot/dynamic-context/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey })
      });
      await fetchStatusAndLogs();
    } catch (e) {
      console.error("Erreur lors de la purge de la mémoire:", e);
    } finally {
      setIsClearingContext(false);
    }
  };

  // Start or Update the Discord Bot
  const handleStartBot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) {
      alert("Veuillez saisir votre jeton (token) de bot Discord.");
      return;
    }
    setIsStartingOrStopping(true);
    try {
      const res = await fetch("/api/bot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            token,
            clientId,
            prefix,
            responseMode,
            systemInstruction,
            model: selectedModel,
            channelRestrictionMode,
            allowedChannels,
            allowDMs,
            rateLimitEnabled,
            cooldownSeconds,
            maxRequestsBeforeCooldown,
            bypassRoles,
            bypassUsers,
            notifyOnRateLimit,
            dynamicContextEnabled,
            dynamicContextRetentionMinutes,
            dynamicContextMaxTurns,
            customCommands,
            events,
            dmRelayEnabled,
            dmRelayChannelId
          }
        })
      });
      if (!res.ok) {
        throw new Error("Erreur de communication avec le serveur");
      }
    } catch (err: any) {
      alert("Impossible de démarrer le bot: " + err.message);
    } finally {
      setIsStartingOrStopping(false);
      fetchStatusAndLogs();
    }
  };

  // Stop the Discord Bot
  const handleStopBot = async () => {
    setIsStartingOrStopping(true);
    try {
      const res = await fetch("/api/bot/stop", { method: "POST" });
      if (!res.ok) {
        throw new Error("Erreur serveur lors de l'arrêt");
      }
    } catch (err: any) {
      alert("Erreur lors de l'arrêt: " + err.message);
    } finally {
      setIsStartingOrStopping(false);
      fetchStatusAndLogs();
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      await fetch("/api/bot/logs/clear", { method: "POST" });
      setLogs([]);
    } catch (e) {}
  };

  // Image selection handler for simulator
  const handleImageFileSelect = (file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64 = resultStr.split(",")[1];
      const previewUrl = URL.createObjectURL(file);
      setSelectedSimImage({
        name: file.name,
        mimeType: file.type,
        data: base64,
        previewUrl
      });
    };
    reader.readAsDataURL(file);
  };

  // Simulate chat message
  const handleSendSimulatedMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() && !selectedSimImage) return;

    const userMsg = userInput.trim();
    const currentImage = selectedSimImage;
    setUserInput("");
    setSelectedSimImage(null);

    setChatMessages(prev => [...prev, {
      sender: 'user',
      text: userMsg,
      imagePreview: currentImage?.previewUrl,
      timestamp: new Date().toLocaleTimeString('fr-FR')
    }]);
    setIsBotRespondingInSimulator(true);

    try {
      const res = await fetch("/api/bot/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          testerPseudo: simulatorPseudo,
          images: currentImage ? [{
            name: currentImage.name,
            mimeType: currentImage.mimeType,
            data: currentImage.data
          }] : undefined,
          config: {
            model: selectedModel,
            systemInstruction,
            prefix,
            customCommands,
            events,
            dynamicContextEnabled,
            dynamicContextRetentionMinutes,
            dynamicContextMaxTurns
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        let badge: string | undefined = undefined;
        if (data.commandName) {
          badge = `[COMMANDE : ${prefix}${data.commandName} | ${data.commandType === 'static' ? 'STATIQUE' : 'IA'}]`;
        }

        // Check if any events triggered
        if (data.triggeredEvents && data.triggeredEvents.length > 0) {
          for (const ev of data.triggeredEvents) {
            setChatMessages(prev => [...prev, {
              sender: 'system',
              text: `⚡ **[ÉVÈNEMENT DÉCLENCHÉ : ${ev.name}]**\n🎯 Raison : ${ev.reason}\n🚀 Action : ${ev.action}`,
              timestamp: new Date().toLocaleTimeString('fr-FR')
            }]);
          }
        }

        setChatMessages(prev => [...prev, { 
          sender: 'bot', 
          text: data.reply, 
          timestamp: new Date().toLocaleTimeString('fr-FR'),
          badge,
          inspectedLinks: data.inspectedLinks
        }]);
      } else {
        const errorData = await res.json();
        setChatMessages(prev => [...prev, { sender: 'system', text: `Erreur: ${errorData.error || 'Impossible de joindre Gemini.'}`, timestamp: new Date().toLocaleTimeString('fr-FR') }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'system', text: "Erreur de communication avec l'IA.", timestamp: new Date().toLocaleTimeString('fr-FR') }]);
    } finally {
      setIsBotRespondingInSimulator(false);
    }
  };

  // Generate Invite URL
  const inviteUrl = clientId 
    ? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=3072&scope=bot`
    : "";

  const copyInviteToClipboard = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      {/* Header Banner */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#5865F2] p-2.5 rounded-xl shadow-lg shadow-[#5865F2]/15">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Discord AI Bot Studio
              <span className="text-xs bg-slate-800 text-slate-400 font-mono px-2 py-0.5 rounded border border-slate-700">v2.0</span>
            </h1>
            <p className="text-xs text-slate-400">Configurez votre bot Discord sur mesure : mentions, commandes préfixes & retranscription MP</p>
          </div>
        </div>

        {/* Global Connection status pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-sm">
            <span className="text-slate-400">Statut du Bot :</span>
            <span className="flex items-center gap-1.5 font-semibold">
              {botStatus.status === "online" ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400">En ligne</span>
                </>
              ) : botStatus.status === "connecting" ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-400">Connexion...</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-rose-400">Hors ligne</span>
                </>
              )}
            </span>
          </div>

          <button 
            onClick={handleManualRefresh}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300 rounded-xl border border-slate-700"
            title="Rafraîchir le statut"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <nav className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-4 flex flex-col gap-1.5 shrink-0">
          <div className="text-slate-500 text-xs font-mono font-semibold tracking-wider uppercase px-3 mb-2">Navigation</div>
          
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeTab === "dashboard"
                ? "bg-[#5865F2] text-white font-medium shadow-md shadow-[#5865F2]/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4" />
              Contrôle & Configuration
            </span>
          </button>

          <button
            onClick={() => setActiveTab("commands")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeTab === "commands"
                ? "bg-[#5865F2] text-white font-medium shadow-md shadow-[#5865F2]/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4" />
              Commandes Personnalisées
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
              {customCommands.filter(c => c.enabled).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("events")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeTab === "events"
                ? "bg-[#5865F2] text-white font-medium shadow-md shadow-[#5865F2]/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Événements & Actions
            </span>
            <span className="text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
              {events.filter(e => e.enabled).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("persona")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeTab === "persona"
                ? "bg-[#5865F2] text-white font-medium shadow-md shadow-[#5865F2]/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4" />
              Personnalisation IA
            </span>
          </button>

          <button
            onClick={() => setActiveTab("playground")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeTab === "playground"
                ? "bg-[#5865F2] text-white font-medium shadow-md shadow-[#5865F2]/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              Simulateur & Tests
            </span>
            <span className="text-xs bg-slate-800 text-[#5865F2] px-1.5 py-0.5 rounded font-mono font-bold">Web</span>
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
              activeTab === "guide"
                ? "bg-[#5865F2] text-white font-medium shadow-md shadow-[#5865F2]/20"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4" />
              Guide d'installation
            </span>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded font-mono font-bold">Tuto</span>
          </button>

          <div className="mt-8 pt-4 border-t border-slate-800/80">
            <div className="text-slate-500 text-xs font-mono font-semibold tracking-wider uppercase px-3 mb-2">Moteur IA Gemini</div>
            <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-300">Modèle Actif :</p>
                <p className="font-mono mt-0.5 text-emerald-400">{selectedModel}</p>
                <p className="mt-1.5 text-slate-500">Exécution côté serveur sécurisée. Aucun spam intempestif : réagit uniquement aux déclencheurs autorisés.</p>
              </div>
            </div>
          </div>
        </nav>

        {/* Dynamic Content Panel */}
        <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col gap-6"
            >
              
              {/* VIEW 1: DASHBOARD & CONFIG */}
              {activeTab === "dashboard" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Form config */}
                  <div className="lg:col-span-7 flex flex-col gap-6">
                    {/* Setup warning if missing fields */}
                    {(!token || !clientId) && (
                      <div className="bg-amber-950/40 border border-amber-900/60 p-4 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-400">Configuration requise</h4>
                          <p className="text-xs text-slate-300 mt-1">
                            Veuillez renseigner votre jeton (Token) de bot Discord et votre ID Client. Consultez l'onglet 
                            <button onClick={() => setActiveTab("guide")} className="text-[#5865F2] hover:underline font-semibold mx-1">
                              Guide d'installation
                            </button> 
                            pour savoir comment les créer en 2 minutes sur le portail développeur Discord.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bot status details if online */}
                    {botStatus.status === "online" && (
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
                              {botStatus.avatarUrl ? (
                                <img src={botStatus.avatarUrl} alt="Bot Avatar" className="h-full w-full object-cover" />
                              ) : (
                                <Bot className="w-6 h-6 text-slate-500" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white font-mono">{botStatus.username || "Bot Discord"}</h3>
                              <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                                Connecté à l'API Discord Gateway
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={handleStopBot}
                            disabled={isStartingOrStopping}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-sm font-semibold rounded-lg transition-all"
                          >
                            <Power className="w-4 h-4" />
                            Arrêter le Bot
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                            <span className="text-[11px] text-slate-500 block">Serveurs</span>
                            <span className="text-xl font-bold font-mono text-slate-200">{botStatus.guildsCount}</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                            <span className="text-[11px] text-slate-500 block">Latence</span>
                            <span className="text-xl font-bold font-mono text-slate-200">{botStatus.ping ? `${botStatus.ping} ms` : "N/A"}</span>
                          </div>
                          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center flex flex-col justify-center items-center">
                            <span className="text-[11px] text-slate-500 block">Commandes</span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-[#5865F2]/20 text-[#5865F2] rounded-full border border-[#5865F2]/40 mt-1">
                              {customCommands.filter(c => c.enabled).length} Actives
                            </span>
                          </div>
                        </div>

                        {/* Invite Link Builder */}
                        {inviteUrl && (
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 mt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-300">🔗 Lien d'invitation du Bot</span>
                              <span className="text-[10px] text-slate-500 font-mono">Permissions requises : Messages & lecture</span>
                            </div>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                readOnly 
                                value={inviteUrl} 
                                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono flex-1 focus:outline-none"
                              />
                              <button 
                                onClick={copyInviteToClipboard}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1 transition-all"
                              >
                                {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedInvite ? "Copié !" : "Copier"}
                              </button>
                              <a 
                                href={inviteUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Inviter
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bot Setup / Start form */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Settings className="w-4.5 h-4.5 text-[#5865F2]" />
                        Paramètres d'accès & Déclencheurs
                      </h3>

                      <form onSubmit={handleStartBot} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs text-slate-300 font-medium flex items-center justify-between">
                            <span>Jeton de Bot Discord (Token) <span className="text-rose-500">*</span></span>
                            <span className="text-[10px] text-slate-500 font-normal">Stocké localement</span>
                          </label>
                          <input
                            type="password"
                            placeholder="MTAyNDM5NDk3... collez votre token ici"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            required
                            className="bg-slate-950 border border-slate-800 focus:border-[#5865F2] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-slate-300 font-medium">
                              ID Client (Application ID)
                            </label>
                            <input
                              type="text"
                              placeholder="ex: 10243949712..."
                              value={clientId}
                              onChange={(e) => setClientId(e.target.value)}
                              className="bg-slate-950 border border-slate-800 focus:border-[#5865F2] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all font-mono"
                            />
                            <span className="text-[10px] text-slate-500">Sert à générer le lien d'invitation Discord.</span>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs text-slate-300 font-medium">
                              Modèle d'IA Gemini
                            </label>
                            <select
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              className="bg-slate-950 border border-slate-800 focus:border-[#5865F2] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none transition-all font-mono"
                            >
                              <option value="gemini-3.7-flash">Gemini 3.7 Flash (Recommandé - Raisonnement hybride & Rapide)</option>
                              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (Raisonnement avancé & Code complexe)</option>
                              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra rapide & Léger)</option>
                              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Version stable standard)</option>
                              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Version 2.5 avancée)</option>
                            </select>
                            <span className="text-[10px] text-slate-500">Modèle officiel Google GenAI.</span>
                          </div>
                        </div>

                        {/* RESPONSE TRIGGER MODE (STRICT: Mention OU Commande Préfixe) */}
                        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                              <AtSign className="w-3.5 h-3.5 text-[#5865F2]" />
                              Déclenchement du Bot sur les salons
                            </label>
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-2 py-0.5 rounded font-mono font-semibold">
                              Zéro intrusion intempestive
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setResponseMode("both")}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 text-center transition-all ${
                                responseMode === "both"
                                  ? "bg-[#5865F2]/15 border-[#5865F2] text-[#5865F2] shadow-sm"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
                              }`}
                            >
                              <span>Mention OU Préfixe</span>
                              <span className="text-[10px] font-normal text-slate-500">@Bot ou {prefix}commande</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setResponseMode("mention")}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 text-center transition-all ${
                                responseMode === "mention"
                                  ? "bg-[#5865F2]/15 border-[#5865F2] text-[#5865F2] shadow-sm"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
                              }`}
                            >
                              <span>Mention uniquement</span>
                              <span className="text-[10px] font-normal text-slate-500">@MonBot</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setResponseMode("prefix")}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1 text-center transition-all ${
                                responseMode === "prefix"
                                  ? "bg-[#5865F2]/15 border-[#5865F2] text-[#5865F2] shadow-sm"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
                              }`}
                            >
                              <span>Préfixe uniquement</span>
                              <span className="text-[10px] font-normal text-slate-500">{prefix}commande</span>
                            </button>
                          </div>

                          {/* Prefix configuration */}
                          <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 mt-1">
                            <span className="text-xs text-slate-300 font-medium shrink-0">Caractère de préfixe :</span>
                            <input
                              type="text"
                              maxLength={3}
                              value={prefix}
                              onChange={(e) => setPrefix(e.target.value)}
                              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-center font-mono w-14 font-bold text-[#5865F2] focus:outline-none focus:border-[#5865F2]"
                            />
                            <div className="text-[11px] text-slate-400">
                              Exemples : <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-slate-300">{prefix}help</code>, <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-slate-300">{prefix}code</code>, <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-slate-300">{prefix}regles</code>
                            </div>
                          </div>

                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-[#5865F2]" />
                              <div>
                                <span className="text-xs font-semibold text-slate-200 block">Commandes personnalisées ({customCommands.length})</span>
                                <span className="text-[10px] text-slate-400">Gérez vos commandes statiques ou avec prompts IA paramétrés</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveTab("commands")}
                              className="text-xs bg-slate-800 hover:bg-slate-700 text-[#5865F2] hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 font-semibold transition-all"
                            >
                              Gérer les commandes
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* NEW FEATURE: DM RELAY TO SERVER CHANNEL */}
                        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                              <Inbox className="w-3.5 h-3.5 text-cyan-400" />
                              Retranscription des Messages Privés (MP / DMs)
                            </label>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                              dmRelayEnabled
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {dmRelayEnabled ? 'Retranscription Active' : 'Désactivée'}
                            </span>
                          </div>

                          {/* Toggle DM Relay */}
                          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-200 font-semibold flex items-center gap-1.5">
                                <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                                Retranscrire les MP reçus et les réponses du bot
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Transfère en temps réel dans un salon textuel de votre serveur les messages privés envoyés au bot ainsi que ses réponses.
                              </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={dmRelayEnabled}
                                onChange={(e) => setDmRelayEnabled(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                          </div>

                          {dmRelayEnabled && (
                            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3 mt-0.5">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-slate-300 font-medium">
                                  Salon Discord de destination de la retranscription :
                                </label>
                                
                                {/* Quick selector if bot online */}
                                {botStatus.channels && botStatus.channels.length > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] text-slate-400">Choisir parmi les salons détectés :</span>
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-900/60 rounded-lg border border-slate-800">
                                      {botStatus.channels.map((ch) => (
                                        <button
                                          key={ch.id}
                                          type="button"
                                          onClick={() => setDmRelayChannelId(ch.id)}
                                          className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all border ${
                                            dmRelayChannelId === ch.id
                                              ? "bg-cyan-600 text-white border-cyan-500 shadow-sm"
                                              : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white"
                                          }`}
                                        >
                                          <Hash className="w-3 h-3 opacity-70" />
                                          <span>{ch.name}</span>
                                          <span className="text-[10px] text-slate-400">({ch.guildName})</span>
                                          {dmRelayChannelId === ch.id && <Check className="w-3 h-3 text-white ml-0.5" />}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-2 mt-1">
                                  <div className="relative flex-1">
                                    <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                                    <input
                                      type="text"
                                      value={dmRelayChannelId}
                                      onChange={(e) => setDmRelayChannelId(e.target.value)}
                                      placeholder="ID du salon Discord (ex: 10243949712...)"
                                      className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
                                    />
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  Indiquez l'identifiant (ID numérique) d'un salon réservé aux logs/modérateurs.
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Channel Restriction Whitelist Section */}
                        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-[#5865F2]" />
                              Disponibilité & Salons autorisés
                            </label>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                              channelRestrictionMode === 'whitelist'
                                ? 'bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {channelRestrictionMode === 'whitelist' 
                                ? `${allowedChannels.length} salon(s) restreint(s)` 
                                : 'Tous les salons autorisés'}
                            </span>
                          </div>

                          {/* Mode switch */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setChannelRestrictionMode("all")}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                channelRestrictionMode === "all"
                                  ? "bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2]"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
                              }`}
                            >
                              <Hash className="w-3.5 h-3.5" />
                              Tous les salons
                            </button>
                            <button
                              type="button"
                              onClick={() => setChannelRestrictionMode("whitelist")}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                channelRestrictionMode === "whitelist"
                                  ? "bg-[#5865F2]/10 border-[#5865F2] text-[#5865F2]"
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400"
                              }`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Salons autorisés uniquement
                            </button>
                          </div>

                          {channelRestrictionMode === "all" ? (
                            <p className="text-[10px] text-slate-500">
                              Le bot répondra sur l'ensemble des salons textuels où il possède les permissions de lecture et d'envoi.
                            </p>
                          ) : (
                            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3.5 mt-1">
                              {botStatus.channels && botStatus.channels.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                                      Salons détectés sur vos serveurs Discord :
                                    </span>
                                    <span className="text-[10px] text-slate-500">Cliquez pour ajouter/retirer</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-900/60 rounded-lg border border-slate-800/80">
                                    {botStatus.channels.map((ch) => {
                                      const isSelected = allowedChannels.includes(ch.id) || allowedChannels.includes(`#${ch.name}`) || allowedChannels.includes(ch.name);
                                      return (
                                        <button
                                          key={ch.id}
                                          type="button"
                                          onClick={() => handleToggleDetectedChannel(ch.id, ch.name)}
                                          className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all border ${
                                            isSelected 
                                              ? "bg-[#5865F2] text-white border-[#5865F2] shadow-sm" 
                                              : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white"
                                          }`}
                                          title={`ID: ${ch.id} | Serveur: ${ch.guildName}`}
                                        >
                                          <Hash className="w-3 h-3 shrink-0 opacity-70" />
                                          <span className="font-semibold">{ch.name}</span>
                                          <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'}`}>
                                            {ch.guildName}
                                          </span>
                                          {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/60 flex items-start gap-2">
                                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span>
                                    {botStatus.status === "online" 
                                      ? "Aucun salon textuel détecté. Ajoutez vos salons manuellement ci-dessous."
                                      : "Démarrez le bot pour détecter automatiquement les salons de vos serveurs, ou renseignez manuellement vos salons autorisés ci-dessous."}
                                  </span>
                                </div>
                              )}

                              {/* Manual channel input */}
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs text-slate-300 font-medium">
                                  Ajouter un salon manuellement (Nom ou ID) :
                                </label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                                    <input
                                      type="text"
                                      value={channelInput}
                                      onChange={(e) => setChannelInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddChannel(channelInput);
                                        }
                                      }}
                                      placeholder="ex: #salon-ia, bot-chat ou ID 102439497..."
                                      className="w-full bg-slate-900 border border-slate-800 focus:border-[#5865F2] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddChannel(channelInput)}
                                    disabled={!channelInput.trim()}
                                    className="px-3.5 py-2 bg-slate-800 hover:bg-[#5865F2] disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700 hover:border-[#5865F2]"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Ajouter
                                  </button>
                                </div>
                              </div>

                              {/* Selected channels list */}
                              <div className="flex flex-col gap-1.5 pt-1">
                                <span className="text-xs text-slate-400 font-medium">
                                  Salons actuellement autorisés ({allowedChannels.length}) :
                                </span>
                                {allowedChannels.length === 0 ? (
                                  <div className="p-2.5 bg-amber-950/30 border border-amber-900/40 rounded-lg text-[11px] text-amber-400 flex items-center gap-2">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Aucun salon configuré : Le bot ignorera tous les messages tant que vous n'ajoutez pas au moins un salon.</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                                    {allowedChannels.map((item) => (
                                      <span
                                        key={item}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] text-xs font-mono font-medium"
                                      >
                                        <Hash className="w-3 h-3 opacity-70" />
                                        {item}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveChannel(item)}
                                          className="hover:text-rose-400 hover:bg-rose-950/50 rounded p-0.5 ml-1 transition-colors"
                                          title="Supprimer ce salon"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Allow DMs toggle */}
                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-xs text-slate-300 font-medium">Autoriser les messages privés (DM)</span>
                                  <span className="text-[10px] text-slate-500">Permettre aux membres d'utiliser le bot en privé</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={allowDMs}
                                    onChange={(e) => setAllowDMs(e.target.checked)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5865F2]"></div>
                                </label>
                              </div>

                            </div>
                          )}
                        </div>

                        {/* Rate Limit & Cooldown / Bypass Roles Section (WITH EXPLICIT MP SUPPORT) */}
                        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                              <Timer className="w-3.5 h-3.5 text-amber-400" />
                              Limite de fréquence (Anti-Spam Serveurs & MP)
                            </label>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                              rateLimitEnabled
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {rateLimitEnabled ? `Actif (${maxRequestsBeforeCooldown} req / ${cooldownSeconds}s)` : 'Désactivé'}
                            </span>
                          </div>

                          {/* Switch toggle on/off */}
                          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-200 font-semibold flex items-center gap-1.5">
                                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                                Activer la limitation de fréquence par utilisateur
                              </span>
                              <span className="text-[10px] text-slate-500">
                                S'applique sur les salons Discord <strong>ET</strong> en messages privés (MP) pour protéger vos quotas.
                              </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={rateLimitEnabled}
                                onChange={(e) => setRateLimitEnabled(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                            </label>
                          </div>

                          {rateLimitEnabled && (
                            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-4 mt-0.5">
                              
                              {/* 1. Request quota setting */}
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                                    Nombre de requêtes autorisées avant cooldown :
                                  </label>
                                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
                                    {maxRequestsBeforeCooldown} requête{maxRequestsBeforeCooldown > 1 ? 's' : ''}
                                  </span>
                                </div>

                                {/* Preset buttons for request count */}
                                <div className="grid grid-cols-5 gap-1.5">
                                  {[1, 2, 3, 5, 10].map((num) => (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => setMaxRequestsBeforeCooldown(num)}
                                      className={`py-1.5 rounded-md text-xs font-semibold font-mono transition-all border ${
                                        maxRequestsBeforeCooldown === num
                                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {num} req.
                                    </button>
                                  ))}
                                </div>

                                {/* Custom slider for request quota */}
                                <div className="flex items-center gap-3 pt-0.5">
                                  <input
                                    type="range"
                                    min={1}
                                    max={20}
                                    step={1}
                                    value={maxRequestsBeforeCooldown}
                                    onChange={(e) => setMaxRequestsBeforeCooldown(parseInt(e.target.value, 10))}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                  />
                                </div>
                              </div>

                              {/* 2. Cooldown duration setting */}
                              <div className="flex flex-col gap-2 border-t border-slate-800/80 pt-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                                    Délai d'attente imposé (Cooldown) :
                                  </label>
                                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
                                    {cooldownSeconds} seconde{cooldownSeconds > 1 ? 's' : ''}
                                  </span>
                                </div>

                                {/* Preset buttons */}
                                <div className="grid grid-cols-5 gap-1.5">
                                  {[5, 10, 15, 30, 60].map((sec) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => setCooldownSeconds(sec)}
                                      className={`py-1.5 rounded-md text-xs font-semibold font-mono transition-all border ${
                                        cooldownSeconds === sec
                                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ))}
                                </div>

                                {/* Custom slider */}
                                <div className="flex items-center gap-3 pt-0.5">
                                  <input
                                    type="range"
                                    min={2}
                                    max={180}
                                    step={1}
                                    value={cooldownSeconds}
                                    onChange={(e) => setCooldownSeconds(parseInt(e.target.value, 10))}
                                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                  />
                                </div>
                              </div>

                              {/* Summary / Explanatory card */}
                              <div className="bg-amber-950/20 border border-amber-900/40 p-2.5 rounded-lg text-[11px] text-amber-300 flex items-start gap-2">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                                <span>
                                  <strong>Règle appliquée :</strong> Chaque utilisateur peut envoyer jusqu'à <strong>{maxRequestsBeforeCooldown} requête{maxRequestsBeforeCooldown > 1 ? 's' : ''}</strong> d'affilée avec l'IA. À la {maxRequestsBeforeCooldown}ème requête, il est soumis à un cooldown de <strong>{cooldownSeconds}s</strong> avant d'obtenir à nouveau {maxRequestsBeforeCooldown} requêtes.
                                </span>
                              </div>

                              {/* Bypass Users & Roles Section (MP & Serveurs) */}
                              <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-4">
                                
                                {/* 1. Bypass Specific Users (ID, Username, @tag) - Works in DMs & Servers */}
                                <div className="flex flex-col gap-2.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800/90">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                        <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                                        Utilisateurs exemptés (Bypass en MP & Serveurs)
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        Les utilisateurs spécifiés ici ne subissent <strong>aucun cooldown</strong>, que ce soit en Message Privé (MP) ou sur les salons.
                                      </span>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-cyan-950/60 border border-cyan-800/50 text-cyan-300">
                                      {bypassUsers.length} utilisateur(s)
                                    </span>
                                  </div>

                                  {/* Input for adding exempt users */}
                                  <div className="flex gap-2">
                                    <div className="relative flex-1">
                                      <UserCheck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                                      <input
                                        type="text"
                                        value={userBypassInput}
                                        onChange={(e) => setUserBypassInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddBypassUser(userBypassInput);
                                          }
                                        }}
                                        placeholder="Identifiant Discord (User ID, ex: 10928374...) ou @pseudo"
                                        className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddBypassUser(userBypassInput)}
                                      disabled={!userBypassInput.trim()}
                                      className="px-3.5 py-2 bg-slate-800 hover:bg-cyan-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700 hover:border-cyan-600 shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Ajouter
                                    </button>
                                  </div>

                                  {/* Active Bypass Users Badges */}
                                  {bypassUsers.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800/60">
                                      {bypassUsers.map((user) => (
                                        <span
                                          key={user}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 text-xs font-mono font-medium"
                                        >
                                          <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                                          <span>{user}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveBypassUser(user)}
                                            className="hover:text-rose-400 hover:bg-rose-950/50 rounded p-0.5 ml-0.5 transition-colors"
                                            title="Retirer cet utilisateur du bypass"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-500 italic">
                                      Aucun utilisateur spécifié directement. Ajoutez un ID de compte (User ID) ou un pseudo pour lui accorder un accès illimité en MP.
                                    </p>
                                  )}
                                </div>

                                {/* 2. Bypass Roles Section */}
                                <div className="flex flex-col gap-2.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800/90">
                                  <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                        Rôles exemptés (Serveurs & MP via serveurs partagés)
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        Les membres ayant ces rôles (ou propriétaires) sont exemptés sur les serveurs et en MP.
                                      </span>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950/60 border border-emerald-800/50 text-emerald-300">
                                      {bypassRoles.length} rôle(s)
                                    </span>
                                  </div>

                                  {botStatus.roles && botStatus.roles.length > 0 ? (
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-[10px] text-slate-400">
                                        Rôles détectés sur votre serveur (cliquez pour ajouter/retirer) :
                                      </span>
                                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800/60">
                                        {botStatus.roles.map((role) => {
                                          const isSelected = bypassRoles.includes(role.id) || bypassRoles.includes(`@${role.name}`) || bypassRoles.includes(role.name);
                                          return (
                                            <button
                                              key={role.id}
                                              type="button"
                                              onClick={() => handleToggleDetectedRole(role.id, role.name)}
                                              className={`px-2.5 py-1 rounded-md text-xs font-mono flex items-center gap-1.5 transition-all border ${
                                                isSelected 
                                                  ? "bg-emerald-600 text-white border-emerald-500 shadow-sm" 
                                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white"
                                              }`}
                                              title={`ID: ${role.id} | Serveur: ${role.guildName}`}
                                            >
                                              <span 
                                                className="w-2 h-2 rounded-full inline-block shrink-0" 
                                                style={{ backgroundColor: role.color !== '#99aab5' ? role.color : '#5865F2' }} 
                                              />
                                              <span className="font-semibold">{role.name}</span>
                                              <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'}`}>
                                                {role.guildName}
                                              </span>
                                              {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 flex items-start gap-2">
                                      <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                      <span>
                                        {botStatus.status === "online"
                                          ? "Aucun rôle spécifique détecté. Ajoutez vos rôles manuellement ci-dessous."
                                          : "Démarrez le bot pour détecter automatiquement les rôles de vos serveurs, ou ajoutez-les manuellement ci-dessous."}
                                      </span>
                                    </div>
                                  )}

                                  {/* Manual role input */}
                                  <div className="flex gap-2">
                                    <div className="relative flex-1">
                                      <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                                      <input
                                        type="text"
                                        value={roleInput}
                                        onChange={(e) => setRoleInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddBypassRole(roleInput);
                                          }
                                        }}
                                        placeholder="Nom ou ID de rôle (ex: Admin, Modérateur, VIP ou ID 10928374...)"
                                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-400 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddBypassRole(roleInput)}
                                      disabled={!roleInput.trim()}
                                      className="px-3.5 py-2 bg-slate-800 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700 hover:border-emerald-600 shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Ajouter
                                    </button>
                                  </div>

                                  {/* Active Bypass Roles badges */}
                                  {bypassRoles.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950/50 rounded-lg border border-slate-800/60">
                                      {bypassRoles.map((role) => (
                                        <span
                                          key={role}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs font-mono font-medium"
                                        >
                                          <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                                          <span>{role}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveBypassRole(role)}
                                            className="hover:text-rose-400 hover:bg-rose-950/50 rounded p-0.5 ml-0.5 transition-colors"
                                            title="Supprimer cette exemption"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-500 italic">
                                      Aucun rôle configuré manuellement. Le propriétaire du serveur est toujours automatiquement exempté.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Notify user checkbox */}
                              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-xs text-slate-300 font-medium">Avertir l'utilisateur sur Discord (Serveur & MP)</span>
                                  <span className="text-[10px] text-slate-500">Envoyer un message lui indiquant le temps restant avant sa prochaine requête</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={notifyOnRateLimit}
                                    onChange={(e) => setNotifyOnRateLimit(e.target.checked)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                </label>
                              </div>

                            </div>
                          )}
                        </div>

                        {botStatus.error && (
                          <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg flex items-start gap-2 text-rose-300 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span><strong>Erreur de connexion :</strong> {botStatus.error}</span>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-800/80">
                          {botStatus.status === "offline" ? (
                            <button
                              type="submit"
                              disabled={isStartingOrStopping || !token}
                              className="w-full py-3 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#5865F2]/10"
                            >
                              <Power className="w-4 h-4" />
                              {isStartingOrStopping ? "Lancement en cours..." : "Démarrer le Bot Discord"}
                            </button>
                          ) : (
                            <div className="flex gap-3">
                              <button
                                type="submit"
                                disabled={isStartingOrStopping}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition-all"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Mettre à jour la Configuration en ligne
                              </button>
                              <button
                                type="button"
                                onClick={handleStopBot}
                                disabled={isStartingOrStopping}
                                className="py-3 px-6 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all"
                              >
                                <Power className="w-4 h-4" />
                                Arrêter
                              </button>
                            </div>
                          )}
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: Console / Logs */}
                  <div className="lg:col-span-5 flex flex-col h-[650px] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-[#5865F2]" />
                        <span className="text-xs font-bold font-mono tracking-wider text-slate-300">CONSOLE D'ACTIVITÉ</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">{logs.length} entrées</span>
                        <button 
                          onClick={handleClearLogs}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="Vider la console"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-2.5 bg-slate-950">
                      {logs.length === 0 ? (
                        <div className="text-slate-600 italic text-center py-10">Console vide. En attente d'événements.</div>
                      ) : (
                        logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-2 border-b border-slate-900/40 pb-1.5 last:border-0 last:pb-0">
                            <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                            <span className={`font-semibold shrink-0 select-none ${
                              log.type === 'error' ? 'text-rose-400' :
                              log.type === 'success' ? 'text-emerald-400' :
                              log.type === 'gemini' ? 'text-violet-400' :
                              log.type === 'discord' ? 'text-[#5865F2]' :
                              log.type === 'cooldown' ? 'text-amber-400 font-bold' :
                              log.type === 'command' ? 'text-cyan-400 font-bold' :
                              log.type === 'dm_relay' ? 'text-pink-400 font-bold' :
                              'text-amber-400'
                            }`}>
                              [{log.type.toUpperCase()}]
                            </span>
                            <span className={`text-slate-300 break-words flex-1 ${
                              log.type === 'error' ? 'text-rose-300' : 
                              log.type === 'cooldown' ? 'text-amber-200' : 
                              log.type === 'command' ? 'text-cyan-200' : 
                              log.type === 'dm_relay' ? 'text-pink-200' : ''
                            }`}>
                              {log.message}
                            </span>
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW 2: CUSTOM COMMANDS MANAGER */}
              {activeTab === "commands" && (
                <CustomCommandsManager
                  prefix={prefix}
                  customCommands={customCommands}
                  setCustomCommands={setCustomCommands}
                  isBotOnline={botStatus.status === "online"}
                  onApplyToLiveBot={handleStartBot}
                />
              )}

              {/* VIEW 3: AUTOMATED EVENT RULES & TRIGGERS */}
              {activeTab === "events" && (
                <EventManager
                  events={events}
                  setEvents={setEvents}
                  connectedChannels={botStatus.channels}
                  connectedRoles={botStatus.roles}
                  isBotOnline={botStatus.status === "online"}
                  onApplyToLiveBot={handleStartBot}
                  selectedModel={selectedModel}
                />
              )}

              {/* VIEW 4: AI PERSONA CUSTOMIZATION */}
              {activeTab === "persona" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left panel: Presets list */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-3">Modèles de personnalités</h4>
                      <p className="text-xs text-slate-400 mb-4">Cliquez sur un modèle pour l'appliquer instantanément comme consigne générale pour votre bot.</p>
                      
                      <div className="flex flex-col gap-2.5">
                        {PERSONA_PRESETS.map((preset) => {
                          const IconComp = preset.icon;
                          const isCurrentlySelected = systemInstruction === preset.instruction;
                          
                          return (
                            <button
                              key={preset.name}
                              onClick={() => {
                                setSystemInstruction(preset.instruction);
                              }}
                              className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                                isCurrentlySelected 
                                  ? "bg-[#5865F2]/10 border-[#5865F2] shadow-sm shadow-[#5865F2]/5" 
                                  : "bg-slate-950 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg ${isCurrentlySelected ? "bg-[#5865F2] text-white" : "bg-slate-900 text-slate-400"}`}>
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-white block">{preset.name}</span>
                                  {isCurrentlySelected && <span className="text-[10px] bg-[#5865F2] text-white font-mono px-1 rounded font-semibold">Actif</span>}
                                </div>
                                <span className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{preset.description}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right panel: Editor & Dynamic Context Configuration */}
                  <div className="lg:col-span-8 flex flex-col gap-6">
                    
                    {/* SECTION 1: CONTEXTE DYNAMIQUE & MÉMOIRE CONVERSATIONNELLE */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400 border border-purple-500/20">
                            <Brain className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-white">Contexte Dynamique (Mémoire Conversationnelle)</h3>
                              <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono px-2 py-0.5 rounded-full font-semibold">
                                IA Contextuelle
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">Permet au bot de retenir ce que les gens lui disent pour converser avec suite dans les idées.</p>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-mono font-semibold ${dynamicContextEnabled ? 'text-purple-400' : 'text-slate-500'}`}>
                            {dynamicContextEnabled ? 'Activé' : 'Désactivé'}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dynamicContextEnabled}
                              onChange={(e) => setDynamicContextEnabled(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Explanation of difference with system instructions */}
                      <div className="bg-purple-950/20 border border-purple-900/40 p-3 rounded-xl text-xs flex items-start gap-2.5 text-purple-200 leading-relaxed">
                        <History className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-purple-300">Différence avec les Consignes Système :</strong> Les consignes système ci-dessous sont <em>fixes et permanentes</em>. Le <strong>Contexte Dynamique</strong> est écrit automatiquement par le bot au fur et à mesure de l'échange pour se souvenir des questions précédentes, comprendre quand on lui répond et guider pas à pas un membre (ex: expliquer des règles de jeu ou du serveur).
                        </div>
                      </div>

                      {dynamicContextEnabled && (
                        <div className="flex flex-col gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                          
                          {/* 1. Retention period setting */}
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-purple-400" />
                                Durée de conservation en mémoire (Rétention périodique) :
                              </label>
                              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/60">
                                {dynamicContextRetentionMinutes >= 60 
                                  ? `${Math.floor(dynamicContextRetentionMinutes / 60)}h${dynamicContextRetentionMinutes % 60 ? ` ${dynamicContextRetentionMinutes % 60}m` : ''}` 
                                  : `${dynamicContextRetentionMinutes} minute${dynamicContextRetentionMinutes > 1 ? 's' : ''}`}
                              </span>
                            </div>

                            {/* Preset buttons for retention */}
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                              {[
                                { label: '5 min', val: 5 },
                                { label: '10 min', val: 10 },
                                { label: '15 min', val: 15 },
                                { label: '30 min', val: 30 },
                                { label: '1h', val: 60 },
                                { label: '2h', val: 120 },
                                { label: '24h', val: 1440 },
                              ].map((item) => (
                                <button
                                  key={item.val}
                                  type="button"
                                  onClick={() => setDynamicContextRetentionMinutes(item.val)}
                                  className={`py-1.5 rounded-md text-xs font-semibold font-mono transition-all border ${
                                    dynamicContextRetentionMinutes === item.val
                                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>

                            {/* Custom slider for retention */}
                            <div className="flex items-center gap-3 pt-0.5">
                              <input
                                type="range"
                                min={2}
                                max={1440}
                                step={5}
                                value={dynamicContextRetentionMinutes}
                                onChange={(e) => setDynamicContextRetentionMinutes(parseInt(e.target.value, 10))}
                                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                              />
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Après cette période d'inactivité de l'utilisateur, l'historique de contexte s'efface automatiquement pour préserver la mémoire et la vie privée.
                            </span>
                          </div>

                          {/* 2. Max history turns */}
                          <div className="flex flex-col gap-2 border-t border-slate-800/80 pt-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5 text-purple-400" />
                                Nombre maximal d'échanges mémorisés (Historique récent) :
                              </label>
                              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-800/60">
                                {dynamicContextMaxTurns} messages
                              </span>
                            </div>

                            {/* Preset buttons for max turns */}
                            <div className="grid grid-cols-6 gap-1.5">
                              {[4, 6, 8, 10, 15, 20].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setDynamicContextMaxTurns(num)}
                                  className={`py-1.5 rounded-md text-xs font-semibold font-mono transition-all border ${
                                    dynamicContextMaxTurns === num
                                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  {num} msgs
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 3. Live Active Memory Monitor & Purge */}
                          <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${activeSessionsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                                Sessions en mémoire active :
                                <span className="font-mono text-purple-400 font-bold">{activeSessionsCount}</span>
                              </span>
                              
                              <button
                                type="button"
                                onClick={() => handleClearDynamicContext()}
                                disabled={isClearingContext || activeSessionsCount === 0}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800/60 text-slate-400 hover:text-rose-300 disabled:opacity-40 disabled:hover:bg-slate-900 disabled:hover:text-slate-400 text-[11px] font-medium rounded-lg flex items-center gap-1.5 transition-all"
                              >
                                <RotateCcw className={`w-3 h-3 ${isClearingContext ? 'animate-spin' : ''}`} />
                                Vider toute la mémoire
                              </button>
                            </div>

                            {/* Active sessions list preview */}
                            {dynamicSessions.length > 0 ? (
                              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                                {dynamicSessions.map((session) => (
                                  <div
                                    key={session.key}
                                    className="bg-slate-900/80 border border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px]"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded font-mono font-semibold text-[10px] ${
                                        session.type === 'dm' ? 'bg-pink-950/60 text-pink-300 border border-pink-800/50' :
                                        session.type === 'sim' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50' :
                                        'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                                      }`}>
                                        {session.type === 'dm' ? 'MP / DM' : session.type === 'sim' ? 'SIMULATEUR' : 'SALON'}
                                      </span>
                                      <span className="text-slate-300 font-mono">
                                        {session.channelName ? `#${session.channelName}` : ''}
                                        {session.displayName ? ` ${session.displayName}` : ''}
                                        {session.userName && session.userName !== session.displayName ? ` (@${session.userName})` : ''}
                                        {!session.displayName && !session.userName ? ` ID: ${session.key.slice(-8)}` : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                                      <span>{session.messageCount} messages</span>
                                      <span className="text-amber-400/90">{session.expiresInMinutes}m restant</span>
                                      <button
                                        type="button"
                                        onClick={() => handleClearDynamicContext(session.key)}
                                        className="text-slate-500 hover:text-rose-400 transition-colors p-0.5"
                                        title="Effacer cette conversation"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic py-1">
                                Aucune conversation active en mémoire. Dès qu'un membre parle au bot, son contexte et son pseudo s'afficheront ici.
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>

                    {/* SECTION 2: CONSIGNES SYSTÈME DE L'IA (FIXES) */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Sliders className="w-5 h-5 text-[#5865F2]" />
                          <div>
                            <h3 className="text-base font-bold text-white">Consignes Système de l'IA (Comportement global fixe)</h3>
                            <p className="text-xs text-slate-400">Définit la personnalité, le ton et les règles permanentes lors des réponses sur mention et en messages privés.</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          {systemInstruction.length} caractères
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-300">Rédigez ou éditez vos consignes générales :</label>
                        <textarea
                          rows={10}
                          value={systemInstruction}
                          onChange={(e) => setSystemInstruction(e.target.value)}
                          placeholder="Tu es un bot Discord qui réagit de la manière suivante..."
                          className="bg-slate-950 border border-slate-800 focus:border-[#5865F2] rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#5865F2] transition-all font-mono leading-relaxed"
                        />
                      </div>

                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs flex items-start gap-2.5">
                        <Sparkles className="w-4.5 h-4.5 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-slate-400 leading-relaxed">
                          <p className="font-semibold text-slate-300">💡 Conseils pour une consigne système réussie :</p>
                          <ul className="list-disc pl-4 mt-1.5 flex flex-col gap-1">
                            <li><strong>Identité claire :</strong> Donnez un nom au bot et définissez son rôle.</li>
                            <li><strong>Formatage Markdown :</strong> Encouragez l'utilisation du gras, des listes et des blocs de code Markdown pour un rendu Discord parfait.</li>
                            <li><strong>Précision :</strong> Pour des comportements spécifiques (code, traduction, résumé), créez plutôt des <strong>Commandes Personnalisées</strong> avec leur propre prompt template.</li>
                          </ul>
                        </div>
                      </div>

                      {botStatus.status === "online" && (
                        <div className="pt-2 border-t border-slate-800 flex justify-end">
                          <button
                            onClick={handleStartBot}
                            className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-[#5865F2]/10"
                          >
                            <RefreshCw className="w-4 h-4 animate-spin-slow" />
                            Appliquer les consignes au bot en ligne
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* VIEW 4: INTERACTIVE PLAYGROUND (WEB CHAT SIMULATOR) */}
              {activeTab === "playground" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Commands helper & Shortcuts */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col gap-3.5">
                      <div className="bg-[#5865F2]/10 p-2.5 rounded-xl w-fit text-[#5865F2]">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-white">Canal d'essai Discord</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Testez vos <strong>commandes avec préfixe ({prefix})</strong> et vos conversations IA en temps réel avant de les déployer sur votre serveur.
                      </p>

                      {/* Quick Command Test Buttons */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Commandes actives à tester :</span>
                        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                          {customCommands.filter(c => c.enabled).map((cmd) => (
                            <button
                              key={cmd.id}
                              onClick={() => {
                                if (cmd.type === 'static') {
                                  setUserInput(`${prefix}${cmd.name}`);
                                } else {
                                  setUserInput(`${prefix}${cmd.name} Explique-moi comment fonctionne une boucle for`);
                                }
                              }}
                              className="text-left text-xs bg-slate-950 hover:bg-slate-800/80 border border-slate-800 p-2.5 rounded-lg text-slate-300 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-[#5865F2]">{prefix}{cmd.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                                  cmd.type === 'static' ? 'bg-slate-800 text-slate-400' : 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                                }`}>
                                  {cmd.type === 'static' ? 'Statique' : 'IA'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 block truncate mt-0.5">{cmd.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="border-t border-slate-800 pt-3 flex flex-col gap-1 text-[11px] text-slate-400 font-mono">
                        <div className="flex justify-between py-1">
                          <span>Préfixe configuré :</span>
                          <span className="text-white font-bold">{prefix}</span>
                        </div>
                        <div className="flex justify-between py-1 border-t border-slate-800/40">
                          <span>Modèle Gemini :</span>
                          <span className="text-emerald-400 font-semibold">{selectedModel}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Chat layout imitating Discord UI */}
                  <div className="lg:col-span-8 flex flex-col h-[560px] bg-[#313338] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    {/* Channel Header */}
                    <div className="px-4 py-3 bg-[#2b2d31] border-b border-[#1f2023] flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-[#80848e] font-mono">#</span>
                        <span className="text-sm font-bold text-white">salon-de-test-bot</span>
                        <div className="h-4 w-[1px] bg-[#3f4147] mx-1" />
                        <span className="text-xs text-[#949ba4] hidden sm:inline">Test des commandes & interactions</span>
                        {dynamicContextEnabled && (
                          <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 font-mono px-1.5 py-0.5 rounded ml-1">
                            Mémoire active ({dynamicContextRetentionMinutes}m)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5 bg-[#1e1f22] px-2 py-1 rounded border border-[#3f4147] text-xs">
                          <span className="text-[11px] text-[#949ba4] font-medium">Pseudo testeur :</span>
                          <input
                            type="text"
                            value={simulatorPseudo}
                            onChange={(e) => setSimulatorPseudo(e.target.value)}
                            placeholder="Alex"
                            className="bg-transparent text-white font-semibold w-24 focus:outline-none text-xs border-b border-transparent focus:border-[#5865F2]"
                            title="Pseudo utilisé par le bot dans ce test"
                          />
                        </div>
                        {dynamicContextEnabled && (
                          <button
                            type="button"
                            onClick={async () => {
                              const testerUsername = simulatorPseudo.toLowerCase().replace(/\s+/g, '_');
                              await handleClearDynamicContext("sim_web_user");
                              await handleClearDynamicContext(`sim_${testerUsername}`);
                              setChatMessages(prev => [...prev, {
                                sender: 'system',
                                text: `🧠 Mémoire de conversation du simulateur réinitialisée pour ${simulatorPseudo}.`,
                                timestamp: new Date().toLocaleTimeString('fr-FR')
                              }]);
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 bg-purple-950/40 px-2 py-1 rounded border border-purple-900/50"
                            title="Oublier la conversation en cours"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Réinitialiser la mémoire
                          </button>
                        )}
                        <button 
                          onClick={() => setChatMessages([{ sender: 'system', text: "Simulator rechargé.", timestamp: new Date().toLocaleTimeString('fr-FR') }])}
                          className="text-xs text-[#949ba4] hover:text-white transition-colors"
                        >
                          Effacer le chat
                        </button>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-5 bg-[#313338]">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className="flex gap-4 items-start select-text text-sm">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                            msg.sender === 'user' 
                              ? "bg-slate-700 text-slate-200" 
                              : msg.sender === 'system' 
                                ? "bg-amber-950 text-amber-400 border border-amber-900/40"
                                : "bg-[#5865F2] text-white"
                          }`}>
                            {msg.sender === 'user' ? (
                              <span className="font-bold text-xs uppercase">{simulatorPseudo ? simulatorPseudo.slice(0, 2) : 'U'}</span>
                            ) : msg.sender === 'system' ? (
                              <span className="font-bold text-xs font-mono">!</span>
                            ) : (
                              <Bot className="w-5 h-5" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className={`font-bold ${
                                msg.sender === 'user' ? 'text-slate-200' : msg.sender === 'system' ? 'text-amber-400 font-mono' : 'text-emerald-400'
                              }`}>
                                {msg.sender === 'user' ? simulatorPseudo || 'Vous' : msg.sender === 'system' ? 'Système' : 'Assistant IA Bot'}
                              </span>
                              {msg.sender === 'bot' && (
                                <span className="text-[10px] bg-[#5865F2] text-white font-mono px-1 rounded font-semibold scale-95">BOT IA</span>
                              )}
                              {msg.badge && (
                                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded font-mono font-semibold">
                                  {msg.badge}
                                </span>
                              )}
                              <span className="text-[11px] text-[#949ba4] font-normal">{msg.timestamp}</span>
                            </div>

                            {/* User attached image preview */}
                            {msg.imagePreview && (
                              <div className="mt-2 max-w-sm rounded-lg overflow-hidden border border-slate-700/80 bg-slate-900 p-1">
                                <img src={msg.imagePreview} alt="Image testée" className="max-h-60 rounded object-contain w-full" />
                              </div>
                            )}

                            {/* Message text */}
                            {msg.text && (
                              <div className="text-[#dbdee1] mt-1 whitespace-pre-wrap leading-relaxed select-text font-sans">
                                {msg.text}
                              </div>
                            )}

                            {/* Inspected links cards */}
                            {msg.inspectedLinks && msg.inspectedLinks.length > 0 && (
                              <div className="mt-3 flex flex-col gap-2">
                                <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                                  <Globe className="w-3.5 h-3.5" />
                                  <span>{msg.inspectedLinks.length} lien(s) web consulté(s) par l'IA :</span>
                                </div>
                                {msg.inspectedLinks.map((link, lIdx) => (
                                  <div key={lIdx} className="bg-[#2b2d31] border border-slate-700/80 rounded-lg p-2.5 text-xs flex flex-col gap-1 max-w-xl">
                                    <div className="flex items-center gap-1.5 text-slate-200 font-semibold truncate">
                                      <span className="truncate">{link.title || 'Page web'}</span>
                                    </div>
                                    {link.description && (
                                      <p className="text-slate-400 text-[11px] line-clamp-2">{link.description}</p>
                                    )}
                                    <a href={link.url} target="_blank" rel="noreferrer" className="text-[11px] text-[#5865F2] hover:underline flex items-center gap-1 mt-0.5 truncate font-mono">
                                      <Link2 className="w-3 h-3 shrink-0" /> {link.url}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {isBotRespondingInSimulator && (
                        <div className="flex gap-4 items-start select-text text-sm animate-pulse">
                          <div className="h-10 w-10 rounded-full bg-[#5865F2] text-white flex items-center justify-center shrink-0">
                            <Bot className="w-5 h-5 animate-spin-slow" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-emerald-400">Assistant IA Bot</span>
                              <span className="text-[11px] text-[#949ba4]">Analyse et génération en cours...</span>
                            </div>
                            <div className="text-slate-500 italic mt-1.5 text-xs flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" />
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.2s]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.4s]" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Input Bar */}
                    <form onSubmit={handleSendSimulatedMessage} className="p-4 bg-[#313338] pt-2 border-t border-slate-800">
                      {/* Attached image thumbnail preview */}
                      {selectedSimImage && (
                        <div className="mb-2 flex items-center gap-2 p-2 bg-[#2b2d31] rounded-lg border border-slate-700 w-fit">
                          <img src={selectedSimImage.previewUrl} alt="Aperçu sélectionné" className="h-12 w-12 object-cover rounded border border-slate-600" />
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-200 font-medium truncate max-w-[200px]">{selectedSimImage.name}</span>
                            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Image prête pour Vision IA
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedSimImage(null)}
                            className="p-1 text-slate-400 hover:text-red-400 transition-colors ml-2 rounded hover:bg-slate-700"
                            title="Retirer l'image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="relative flex items-center gap-2">
                        {/* Hidden file input for image attachment */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageFileSelect(file);
                            e.target.value = "";
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2.5 rounded-lg bg-[#383a40] text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          title="Joindre une image pour analyse IA (Vision)"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>

                        <div className="relative flex-1 flex items-center">
                          <input
                            type="text"
                            disabled={isBotRespondingInSimulator}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onPaste={(e) => {
                              const items = e.clipboardData?.items;
                              if (items) {
                                for (let i = 0; i < items.length; i++) {
                                  if (items[i].type.startsWith("image/")) {
                                    const file = items[i].getAsFile();
                                    if (file) {
                                      handleImageFileSelect(file);
                                      e.preventDefault();
                                      break;
                                    }
                                  }
                                }
                              }
                            }}
                            placeholder={selectedSimImage ? "Posez une question sur cette image (ou appuyez sur Entrée)..." : `Tapez un message, collez un lien web ou joignez une image...`}
                            className="w-full bg-[#383a40] text-[#dbdee1] placeholder-[#80848e] rounded-lg px-4 py-3.5 pr-12 focus:outline-none focus:ring-0 text-sm"
                          />
                          <button
                            type="submit"
                            disabled={isBotRespondingInSimulator || (!userInput.trim() && !selectedSimImage)}
                            className="absolute right-3.5 text-[#80848e] hover:text-white transition-colors disabled:opacity-40"
                          >
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                </div>
              )}

              {/* VIEW 5: SETUP GUIDE */}
              {activeTab === "guide" && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[#5865F2]" />
                      Guide d'installation & de configuration Discord
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Étapes pour créer votre application Discord, inviter votre bot et configurer les commandes & la retranscription.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800">
                    
                    {/* Left Column: Discord Registration */}
                    <div className="flex flex-col gap-5">
                      <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold">1</span>
                        Création sur le Portail Développeur Discord
                      </h4>
                      
                      <ol className="list-decimal pl-5 text-xs text-slate-300 flex flex-col gap-4">
                        <li>
                          <p className="font-semibold text-white">Accéder au Portail Développeur :</p>
                          <p className="text-slate-400 mt-1">
                            Rendez-vous sur <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-[#5865F2] hover:underline font-semibold inline-flex items-center gap-0.5">Discord Developer Portal <ExternalLink className="w-3 h-3 inline" /></a> et connectez-vous.
                          </p>
                        </li>
                        <li>
                          <p className="font-semibold text-white">Créer une Application :</p>
                          <p className="text-slate-400 mt-1">
                            Cliquez sur <strong className="text-slate-200">"New Application"</strong> en haut à droite et nommez votre bot (ex: "MonBotIA").
                          </p>
                        </li>
                        <li>
                          <p className="font-semibold text-white">Récupérer l'ID Client :</p>
                          <p className="text-slate-400 mt-1">
                            Dans <strong className="text-slate-200">"General Information"</strong>, copiez l'<strong>"Application ID"</strong>.
                          </p>
                        </li>
                        <li>
                          <p className="font-semibold text-white">Générer le Bot Token :</p>
                          <p className="text-slate-400 mt-1">
                            Dans le menu <strong className="text-slate-200">"Bot"</strong>, cliquez sur <strong className="text-slate-200">"Reset Token"</strong> pour générer votre jeton secret et collez-le dans notre onglet de contrôle.
                          </p>
                        </li>
                      </ol>
                    </div>

                    {/* Right Column: Key Intents & Inviting */}
                    <div className="flex flex-col gap-5">
                      <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold">2</span>
                        Permissions Clés & Fonctionnalités Avancées
                      </h4>

                      <div className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-slate-300 leading-relaxed">
                          <p className="font-semibold text-amber-400">Indispensable : "Message Content Intent"</p>
                          <p className="text-slate-400 mt-1">
                            Dans l'onglet <strong className="text-slate-200">"Bot"</strong> du portail Discord, activez la case <strong className="text-slate-200">"MESSAGE CONTENT INTENT"</strong> puis enregistrez. Sans cette autorisation, Discord masque le texte des commandes.
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-2.5 text-xs text-slate-300">
                        <p className="font-bold text-white flex items-center gap-1.5">
                          <Terminal className="w-4 h-4 text-[#5865F2]" />
                          Commandes Personnalisées (Statiques vs IA) :
                        </p>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Créez des commandes comme <code className="font-mono bg-slate-900 text-slate-300 px-1 py-0.5 rounded">{prefix}help</code> (réponse fixe instantanée) ou des commandes assistées par IA comme <code className="font-mono bg-slate-900 text-slate-300 px-1 py-0.5 rounded">{prefix}code [question]</code> ou <code className="font-mono bg-slate-900 text-slate-300 px-1 py-0.5 rounded">{prefix}traduis [texte]</code> avec template d'instruction dédié.
                        </p>

                        <p className="font-bold text-white flex items-center gap-1.5 mt-2">
                          <Eye className="w-4 h-4 text-emerald-400" />
                          Vision Multimodale & Liens Web :
                        </p>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Le bot analyse automatiquement les <strong>images jointes</strong> (fichiers ou URLs d'images) et consulte le <strong>contenu textuel des liens web</strong> envoyés dans les messages ou citations.
                        </p>

                        <p className="font-bold text-white flex items-center gap-1.5 mt-2">
                          <Inbox className="w-4 h-4 text-cyan-400" />
                          Retranscription des Messages Privés (DMs) :
                        </p>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          Activez la <em>Retranscription des MP</em> et choisissez un salon réservé aux modérateurs. Tous les DMs envoyés par les membres ainsi que les réponses fournies par le bot y seront automatiquement transcrits.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Footer copyright */}
      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>Discord AI Bot Studio • Google AI Studio Build</span>
        <div className="flex items-center gap-4">
          <span>IA Gemini 2.5 • Backend Node.js & discord.js v14</span>
        </div>
      </footer>
    </div>
  );
}
