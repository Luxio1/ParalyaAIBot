import React, { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  MessageSquare, 
  Inbox, 
  Copy, 
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Hash,
  User,
  Users,
  Send,
  Timer,
  Play
} from 'lucide-react';
import { BotEventRule, DiscordChannelInfo, DiscordRoleInfo } from '../types';

interface EventManagerProps {
  events: BotEventRule[];
  setEvents: React.Dispatch<React.SetStateAction<BotEventRule[]>>;
  connectedChannels?: DiscordChannelInfo[];
  connectedRoles?: DiscordRoleInfo[];
  isBotOnline?: boolean;
  onApplyToLiveBot?: () => void | Promise<void>;
  selectedModel?: string;
}

export const DEFAULT_PRESET_EVENTS: BotEventRule[] = [
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
    enabled: true,
    triggerPrompt: "Quand un joueur pose une question générale sur le fonctionnement du serveur, les rôles disponibles ou où trouver les informations.",
    channelFilter: "all",
    actionType: "channel",
    dmTarget: "author",
    dmMessageMode: "custom",
    channelTargetType: "source_channel",
    channelMessageMode: "ai",
    channelAiPrompt: "Fournis une réponse chaleureuse et concise guidant le membre vers les salons clés (règles, rôles, annonces).",
    cooldownSeconds: 30
  }
];

export const EventManager: React.FC<EventManagerProps> = ({
  events,
  setEvents,
  connectedChannels = [],
  connectedRoles = [],
  isBotOnline = false,
  onApplyToLiveBot,
  selectedModel = "gemini-3.7-flash"
}) => {
  const [editingEvent, setEditingEvent] = useState<BotEventRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Live test states
  const [testMessage, setTestMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    evaluated: boolean;
    matches: { ruleId: string; ruleName: string; matched: boolean; reason: string; simulatedAction: string }[];
  } | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTriggerPrompt, setFormTriggerPrompt] = useState("");
  const [formChannelFilter, setFormChannelFilter] = useState<'all' | 'specific'>('all');
  const [formTargetChannels, setFormTargetChannels] = useState<string[]>([]);
  const [formActionType, setFormActionType] = useState<'dm' | 'channel' | 'both'>('channel');
  
  // DM Action Form State
  const [formDmTarget, setFormDmTarget] = useState<'author' | 'user' | 'role'>('author');
  const [formDmTargetId, setFormDmTargetId] = useState("");
  const [formDmMessageMode, setFormDmMessageMode] = useState<'custom' | 'ai'>('custom');
  const [formDmCustomMessage, setFormDmCustomMessage] = useState("");
  const [formDmAiPrompt, setFormDmAiPrompt] = useState("");

  // Channel Action Form State
  const [formChannelTargetType, setFormChannelTargetType] = useState<'specific_channel' | 'source_channel'>('specific_channel');
  const [formChannelId, setFormChannelId] = useState("");
  const [formChannelMessageMode, setFormChannelMessageMode] = useState<'custom' | 'ai'>('custom');
  const [formChannelCustomMessage, setFormChannelCustomMessage] = useState("");
  const [formChannelAiPrompt, setFormChannelAiPrompt] = useState("");
  const [formChannelMentionRole, setFormChannelMentionRole] = useState("");

  const [formCooldown, setFormCooldown] = useState<number>(30);
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenCreateModal = (preset?: BotEventRule) => {
    if (preset) {
      setFormName(preset.name);
      setFormDescription(preset.description || "");
      setFormTriggerPrompt(preset.triggerPrompt);
      setFormChannelFilter(preset.channelFilter || 'all');
      setFormTargetChannels(preset.targetChannels || []);
      setFormActionType(preset.actionType);
      
      setFormDmTarget(preset.dmTarget || 'author');
      setFormDmTargetId(preset.dmTargetId || "");
      setFormDmMessageMode(preset.dmMessageMode || 'custom');
      setFormDmCustomMessage(preset.dmCustomMessage || "");
      setFormDmAiPrompt(preset.dmAiPrompt || "");

      setFormChannelTargetType(preset.channelTargetType || 'specific_channel');
      setFormChannelId(preset.channelId || "");
      setFormChannelMessageMode(preset.channelMessageMode || 'custom');
      setFormChannelCustomMessage(preset.channelCustomMessage || "");
      setFormChannelAiPrompt(preset.channelAiPrompt || "");
      setFormChannelMentionRole(preset.channelMentionRole || "");

      setFormCooldown(preset.cooldownSeconds ?? 30);
    } else {
      setFormName("");
      setFormDescription("");
      setFormTriggerPrompt("");
      setFormChannelFilter('all');
      setFormTargetChannels([]);
      setFormActionType('channel');
      
      setFormDmTarget('author');
      setFormDmTargetId("");
      setFormDmMessageMode('custom');
      setFormDmCustomMessage("Bonjour {user}, nous avons détecté votre message dans #{channel}.");
      setFormDmAiPrompt("Rédige un message bienveillant et courtois expliquant la situation.");

      setFormChannelTargetType('specific_channel');
      setFormChannelId("");
      setFormChannelMessageMode('custom');
      setFormChannelCustomMessage("⚠️ **Événement Détecté** : {user} dans #{channel} : _{message}_");
      setFormChannelAiPrompt("Rédige une alerte claire pour l'équipe résumant l'événement.");
      setFormChannelMentionRole("");

      setFormCooldown(30);
    }
    setFormError(null);
    setEditingEvent(null);
    setIsCreatingNew(true);
  };

  const handleOpenEditModal = (event: BotEventRule) => {
    setEditingEvent(event);
    setFormName(event.name);
    setFormDescription(event.description || "");
    setFormTriggerPrompt(event.triggerPrompt);
    setFormChannelFilter(event.channelFilter || 'all');
    setFormTargetChannels(event.targetChannels || []);
    setFormActionType(event.actionType);
    
    setFormDmTarget(event.dmTarget || 'author');
    setFormDmTargetId(event.dmTargetId || "");
    setFormDmMessageMode(event.dmMessageMode || 'custom');
    setFormDmCustomMessage(event.dmCustomMessage || "");
    setFormDmAiPrompt(event.dmAiPrompt || "");

    setFormChannelTargetType(event.channelTargetType || 'specific_channel');
    setFormChannelId(event.channelId || "");
    setFormChannelMessageMode(event.channelMessageMode || 'custom');
    setFormChannelCustomMessage(event.channelCustomMessage || "");
    setFormChannelAiPrompt(event.channelAiPrompt || "");
    setFormChannelMentionRole(event.channelMentionRole || "");

    setFormCooldown(event.cooldownSeconds ?? 30);
    setFormError(null);
    setIsCreatingNew(false);
  };

  const handleCloseModal = () => {
    setEditingEvent(null);
    setIsCreatingNew(false);
    setFormError(null);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Veuillez indiquer un nom pour cet événement.");
      return;
    }
    if (!formTriggerPrompt.trim()) {
      setFormError("Veuillez rédiger le critère de détection (Prompt) de l'événement.");
      return;
    }

    if (formActionType === 'dm' || formActionType === 'both') {
      if (formDmTarget !== 'author' && !formDmTargetId.trim()) {
        setFormError("Veuillez spécifier l'identifiant (ID) de l'utilisateur ou du rôle destinataire du MP.");
        return;
      }
      if (formDmMessageMode === 'custom' && !formDmCustomMessage.trim()) {
        setFormError("Veuillez rédiger le message privé à envoyer.");
        return;
      }
      if (formDmMessageMode === 'ai' && !formDmAiPrompt.trim()) {
        setFormError("Veuillez définir la consigne IA pour générer le message privé.");
        return;
      }
    }

    if (formActionType === 'channel' || formActionType === 'both') {
      if (formChannelTargetType === 'specific_channel' && !formChannelId.trim()) {
        setFormError("Veuillez spécifier le nom ou l'ID du salon de destination.");
        return;
      }
      if (formChannelMessageMode === 'custom' && !formChannelCustomMessage.trim()) {
        setFormError("Veuillez rédiger le message d'alerte à envoyer dans le salon.");
        return;
      }
      if (formChannelMessageMode === 'ai' && !formChannelAiPrompt.trim()) {
        setFormError("Veuillez définir la consigne IA pour générer le message de salon.");
        return;
      }
    }

    const newRule: BotEventRule = {
      id: editingEvent ? editingEvent.id : `evt-${Date.now()}`,
      name: formName.trim(),
      description: formDescription.trim(),
      enabled: editingEvent ? editingEvent.enabled : true,
      triggerPrompt: formTriggerPrompt.trim(),
      channelFilter: formChannelFilter,
      targetChannels: formTargetChannels,
      actionType: formActionType,
      dmTarget: formDmTarget,
      dmTargetId: formDmTargetId.trim(),
      dmMessageMode: formDmMessageMode,
      dmCustomMessage: formDmCustomMessage.trim(),
      dmAiPrompt: formDmAiPrompt.trim(),
      channelTargetType: formChannelTargetType,
      channelId: formChannelId.trim(),
      channelMessageMode: formChannelMessageMode,
      channelCustomMessage: formChannelCustomMessage.trim(),
      channelAiPrompt: formChannelAiPrompt.trim(),
      channelMentionRole: formChannelMentionRole.trim(),
      cooldownSeconds: formCooldown
    };

    if (editingEvent) {
      setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? newRule : ev));
    } else {
      setEvents(prev => [newRule, ...prev]);
    }

    handleCloseModal();
  };

  const handleToggleEvent = (id: string) => {
    setEvents(prev => prev.map(ev => ev.id === id ? { ...ev, enabled: !ev.enabled } : ev));
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer cet événement ?")) {
      setEvents(prev => prev.filter(ev => ev.id !== id));
    }
  };

  const handleDuplicateEvent = (event: BotEventRule) => {
    const copy: BotEventRule = {
      ...event,
      id: `evt-${Date.now()}`,
      name: `${event.name} (Copie)`,
      enabled: true
    };
    setEvents(prev => [copy, ...prev]);
  };

  const handleResetDefaults = () => {
    if (confirm("Réinitialiser les événements aux modèles par défaut recommandés ?")) {
      setEvents(DEFAULT_PRESET_EVENTS);
    }
  };

  const handleApply = async () => {
    if (onApplyToLiveBot) {
      setIsApplying(true);
      await onApplyToLiveBot();
      setTimeout(() => setIsApplying(false), 600);
    }
  };

  // Test message against active event rules
  const handleTestEventRules = async () => {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    setTestResults(null);
    try {
      const res = await fetch("/api/bot/events/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: testMessage,
          events: events.filter(e => e.enabled),
          model: selectedModel
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTestResults({
          evaluated: true,
          matches: data.results || []
        });
      }
    } catch (e) {
      console.error("Erreur lors du test des événements:", e);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white">Événements & Déclencheurs IA</h3>
              <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono px-2 py-0.5 rounded-full font-semibold">
                Surveillance & Actions automatiques
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Définissez des règles en langage naturel (ex: <em>"Quand quelqu'un est vulgaire"</em>, <em>"Quand un joueur demande de l'aide"</em>). 
              Le bot analyse le message et déclenche automatiquement un <strong>Message Privé (MP)</strong> à un joueur/rôle ou un <strong>message d'alerte</strong> dans un salon dédié.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-[#5865F2]/20"
          >
            <Plus className="w-4 h-4" />
            Créer un événement
          </button>
          {isBotOnline && onApplyToLiveBot && (
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? 'animate-spin' : ''}`} />
              Appliquer au bot
            </button>
          )}
        </div>
      </div>

      {/* Preset templates bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Modèles d'événements prêts à l'emploi
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurer les modèles
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DEFAULT_PRESET_EVENTS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleOpenCreateModal(preset)}
              className="p-3 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left transition-all group flex flex-col justify-between gap-2"
            >
              <div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors block truncate">
                  {preset.name}
                </span>
                <span className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                  {preset.description}
                </span>
              </div>
              <span className="text-[10px] text-[#5865F2] font-semibold flex items-center gap-1 self-start">
                <Plus className="w-3 h-3" />
                Utiliser ce modèle
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Events List (8 cols) & Live Tester (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Events Cards */}
        <div className="lg:col-span-8 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
              Événements configurés ({events.length})
            </span>
            <span className="text-xs font-mono text-emerald-400">
              {events.filter(e => e.enabled).length} actif{events.filter(e => e.enabled).length > 1 ? 's' : ''}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-xl p-10 text-center flex flex-col items-center gap-3">
              <Zap className="w-8 h-8 text-slate-600" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-300">Aucun événement configuré</span>
                <span className="text-xs text-slate-500 max-w-sm">
                  Créez votre premier déclencheur d'événement ou choisissez un modèle ci-dessus pour surveiller et automatiser les actions.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                className="mt-2 px-4 py-2 bg-[#5865F2] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#5865F2]/20"
              >
                <Plus className="w-4 h-4" />
                Créer un événement
              </button>
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className={`bg-slate-900 border rounded-xl p-4 transition-all flex flex-col gap-3 ${
                  ev.enabled 
                    ? 'border-slate-800 hover:border-slate-700' 
                    : 'border-slate-850 opacity-60 bg-slate-950/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleEvent(ev.id)}
                      className={`relative inline-flex items-center cursor-pointer shrink-0 mt-0.5`}
                      title={ev.enabled ? "Désactiver cet événement" : "Activer cet événement"}
                    >
                      <div className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${
                        ev.enabled ? 'bg-amber-500' : 'bg-slate-800'
                      }`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                          ev.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </button>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{ev.name}</span>
                        
                        {/* Action Badges */}
                        <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                          ev.actionType === 'both' ? 'bg-purple-950/80 text-purple-300 border-purple-800/60' :
                          ev.actionType === 'dm' ? 'bg-pink-950/80 text-pink-300 border-pink-800/60' :
                          'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                        }`}>
                          {ev.actionType === 'both' ? 'Action : MP + Salon' :
                           ev.actionType === 'dm' ? 'Action : Message Privé (MP)' :
                           'Action : Salon Discord'}
                        </span>

                        {ev.cooldownSeconds && ev.cooldownSeconds > 0 && (
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            Cooldown: {ev.cooldownSeconds}s
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <span className="text-xs text-slate-400 mt-0.5">{ev.description}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDuplicateEvent(ev)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Dupliquer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(ev)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prompt trigger display */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex flex-col gap-1 text-xs">
                  <span className="text-[10px] font-mono font-semibold text-amber-400/90 uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Critère de déclenchement (Prompt IA) :
                  </span>
                  <span className="text-slate-300 italic font-mono leading-relaxed">
                    "{ev.triggerPrompt}"
                  </span>
                </div>

                {/* Action details cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {(ev.actionType === 'dm' || ev.actionType === 'both') && (
                    <div className="bg-pink-950/20 border border-pink-900/30 rounded-lg p-2.5 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-pink-400 uppercase font-mono flex items-center gap-1">
                        <Inbox className="w-3 h-3" />
                        Message Privé (MP) :
                      </span>
                      <div className="text-[11px] text-pink-200/90">
                        <span>Destinataire : <strong>{
                          ev.dmTarget === 'author' ? 'Auteur du message' :
                          ev.dmTarget === 'role' ? `Membres du rôle (${ev.dmTargetId || 'non défini'})` :
                          `Utilisateur ID: ${ev.dmTargetId}`
                        }</strong></span>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {ev.dmMessageMode === 'ai' ? `IA Prompt: ${ev.dmAiPrompt}` : `Message: ${ev.dmCustomMessage}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {(ev.actionType === 'channel' || ev.actionType === 'both') && (
                    <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-lg p-2.5 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase font-mono flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        Message dans un Salon :
                      </span>
                      <div className="text-[11px] text-cyan-200/90">
                        <span>Salon : <strong>{
                          ev.channelTargetType === 'source_channel' ? 'Salon d\'origine' : `#${ev.channelId || 'non défini'}`
                        }</strong> {ev.channelMentionRole ? `(Mention: ${ev.channelMentionRole})` : ''}</span>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {ev.channelMessageMode === 'ai' ? `IA Prompt: ${ev.channelAiPrompt}` : `Message: ${ev.channelCustomMessage}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

        {/* Right Column: Live Event Simulator / Evaluator */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-3.5 shadow-sm sticky top-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400 border border-emerald-500/20">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Simulateur d'Événements</h4>
                <p className="text-[11px] text-slate-400">Testez si une phrase déclenche vos règles actives.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Message de test utilisateur :</label>
              <textarea
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Ex: C'est n'importe quoi ce serveur, bande d'incapables !"
                className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono"
              />
            </div>

            {/* Quick test phrases */}
            <div className="flex flex-wrap gap-1">
              {[
                "Vous êtes tous des nuls, je déteste ce serveur !",
                "Comment je peux postuler pour devenir modérateur ?",
                "J'ai besoin d'aide je me fais harceler en MP",
                "Comment fonctionne le système de rôles ?"
              ].map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTestMessage(phrase)}
                  className="text-[10px] text-slate-400 hover:text-amber-300 bg-slate-950 hover:bg-slate-850 px-2 py-1 rounded border border-slate-800 transition-colors text-left truncate max-w-full"
                >
                  "{phrase}"
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleTestEventRules}
              disabled={isTesting || !testMessage.trim() || events.filter(e => e.enabled).length === 0}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Analyse IA par Gemini...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Analyser et tester les règles
                </>
              )}
            </button>

            {/* Test Results Output */}
            {testResults && (
              <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-slate-200 font-mono flex items-center justify-between">
                  <span>Résultat d'évaluation :</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    testResults.matches.some(m => m.matched) ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'bg-slate-950 text-slate-400'
                  }`}>
                    {testResults.matches.filter(m => m.matched).length} déclenchée(s)
                  </span>
                </span>

                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {testResults.matches.map((res) => (
                    <div
                      key={res.ruleId}
                      className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                        res.matched 
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-200' 
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="truncate">{res.ruleName}</span>
                        <span className={`text-[10px] font-mono px-1.5 rounded ${
                          res.matched ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-500'
                        }`}>
                          {res.matched ? 'DÉCLENCHÉ' : 'Non détecté'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-300 leading-relaxed font-sans">
                        {res.reason}
                      </span>
                      {res.matched && res.simulatedAction && (
                        <div className="bg-slate-950/80 p-2 rounded border border-amber-900/40 text-[10px] text-slate-300 font-mono mt-1">
                          <strong>Action simulée :</strong> {res.simulatedAction}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreatingNew || editingEvent) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-500/10 p-2 rounded-lg text-amber-400 border border-amber-500/20">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingEvent ? "Modifier l'événement" : "Créer un nouvel événement"}
                  </h3>
                  <p className="text-xs text-slate-400">Configurez le critère de détection par l'IA et les actions automatiques.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveEvent} className="p-6 flex flex-col gap-5">
              
              {formError && (
                <div className="bg-rose-950/40 border border-rose-900/60 p-3 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Name & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">Nom de l'événement :</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Détection de vulgarité"
                    className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-200">Description (optionnelle) :</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Ex: Alerte les modérateurs et prévient l'auteur"
                    className="bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* 2. Natural Language Trigger Prompt */}
              <div className="flex flex-col gap-1.5 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Critère de détection (Prompt en langage naturel) :
                </label>
                <p className="text-[11px] text-slate-400">
                  Expliquez clairement ce que l'IA doit repérer dans les messages des membres.
                </p>
                <textarea
                  rows={3}
                  required
                  value={formTriggerPrompt}
                  onChange={(e) => setFormTriggerPrompt(e.target.value)}
                  placeholder="Ex: Quand quelqu'un se comporte de façon agressive, insulte un autre joueur, utilise des gros mots ou tient des propos toxiques."
                  className="bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none font-mono mt-1"
                />
              </div>

              {/* 3. Action Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-200">Action(s) à déclencher :</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'channel', label: 'Salon Discord', desc: 'Alerter dans un salon' },
                    { type: 'dm', label: 'Message Privé (MP)', desc: 'Envoyer un MP au joueur/rôle' },
                    { type: 'both', label: 'Les Deux (MP + Salon)', desc: 'MP + Alerte salon' },
                  ].map((act) => (
                    <button
                      key={act.type}
                      type="button"
                      onClick={() => setFormActionType(act.type as any)}
                      className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1 ${
                        formActionType === act.type
                          ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="text-xs font-bold">{act.label}</span>
                      <span className="text-[10px] opacity-70">{act.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. DM Action Details */}
              {(formActionType === 'dm' || formActionType === 'both') && (
                <div className="bg-pink-950/20 border border-pink-900/40 p-4 rounded-xl flex flex-col gap-3">
                  <span className="text-xs font-bold text-pink-400 uppercase font-mono flex items-center gap-1.5">
                    <Inbox className="w-4 h-4" />
                    Configuration de l'Action Message Privé (MP)
                  </span>

                  {/* Recipient selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { target: 'author', label: 'Auteur du message', desc: 'Le joueur ayant parlé' },
                      { target: 'user', label: 'Utilisateur précis', desc: 'Par User ID / @tag' },
                      { target: 'role', label: 'Membres d\'un rôle', desc: 'Par Role ID / @role' },
                    ].map((t) => (
                      <button
                        key={t.target}
                        type="button"
                        onClick={() => setFormDmTarget(t.target as any)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                          formDmTarget === t.target
                            ? 'bg-pink-950/60 border-pink-500 text-pink-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-semibold block">{t.label}</span>
                        <span className="text-[10px] text-slate-500">{t.desc}</span>
                      </button>
                    ))}
                  </div>

                  {formDmTarget !== 'author' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-pink-300">
                        {formDmTarget === 'user' ? "ID ou @tag de l'utilisateur :" : "ID ou nom du rôle :"}
                      </label>
                      <input
                        type="text"
                        value={formDmTargetId}
                        onChange={(e) => setFormDmTargetId(e.target.value)}
                        placeholder={formDmTarget === 'user' ? "ex: 10928374918237..." : "ex: @Modérateur ou Role ID"}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  )}

                  {/* Mode: Custom vs AI */}
                  <div className="flex items-center gap-4 pt-1">
                    <label className="text-xs text-slate-300 font-medium">Rédaction du MP :</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormDmMessageMode('custom')}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${
                          formDmMessageMode === 'custom' ? 'bg-pink-600 text-white border-pink-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Message fixe (Template)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDmMessageMode('ai')}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${
                          formDmMessageMode === 'ai' ? 'bg-pink-600 text-white border-pink-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Rédigé par l'IA Gemini
                      </button>
                    </div>
                  </div>

                  {formDmMessageMode === 'custom' ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-slate-300">Texte du message privé :</label>
                      <textarea
                        rows={3}
                        value={formDmCustomMessage}
                        onChange={(e) => setFormDmCustomMessage(e.target.value)}
                        placeholder="Bonjour {user}, nous avons remarqué votre message dans #{channel}..."
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                        <span>Variables disponibles :</span>
                        {['{user}', '{channel}', '{message}'].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFormDmCustomMessage(prev => `${prev} ${v}`)}
                            className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-pink-300 border border-slate-800 hover:border-pink-500"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-slate-300">Consigne donnée à l'IA pour rédiger le MP :</label>
                      <textarea
                        rows={3}
                        value={formDmAiPrompt}
                        onChange={(e) => setFormDmAiPrompt(e.target.value)}
                        placeholder="Rédige un avertissement courtois et bienveillant rappelant les règles sans être agressif."
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  )}

                </div>
              )}

              {/* 5. Channel Action Details */}
              {(formActionType === 'channel' || formActionType === 'both') && (
                <div className="bg-cyan-950/20 border border-cyan-900/40 p-4 rounded-xl flex flex-col gap-3">
                  <span className="text-xs font-bold text-cyan-400 uppercase font-mono flex items-center gap-1.5">
                    <Hash className="w-4 h-4" />
                    Configuration de l'Action Salon Discord
                  </span>

                  {/* Destination selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormChannelTargetType('specific_channel')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        formChannelTargetType === 'specific_channel'
                          ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="font-semibold block">Salon dédié spécifique</span>
                      <span className="text-[10px] text-slate-500">Ex: #alertes-moderation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormChannelTargetType('source_channel')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                        formChannelTargetType === 'source_channel'
                          ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="font-semibold block">Salon d'origine</span>
                      <span className="text-[10px] text-slate-500">Répondre là où le message a été posté</span>
                    </button>
                  </div>

                  {formChannelTargetType === 'specific_channel' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-cyan-300">Nom ou ID du salon de destination :</label>
                      <input
                        type="text"
                        value={formChannelId}
                        onChange={(e) => setFormChannelId(e.target.value)}
                        placeholder="ex: alertes-staff ou 109283749..."
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                      />
                      {connectedChannels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-[10px] text-slate-500">Salons détectés :</span>
                          {connectedChannels.slice(0, 6).map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => setFormChannelId(ch.id)}
                              className="text-[10px] bg-slate-900 hover:bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded font-mono border border-slate-800"
                            >
                              #{ch.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mention role */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-slate-300">Mentionner un rôle ou membre (optionnel) :</label>
                    <input
                      type="text"
                      value={formChannelMentionRole}
                      onChange={(e) => setFormChannelMentionRole(e.target.value)}
                      placeholder="ex: @Modérateur, @Staff ou Role ID"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>

                  {/* Mode: Custom vs AI */}
                  <div className="flex items-center gap-4 pt-1">
                    <label className="text-xs text-slate-300 font-medium">Rédaction du message de salon :</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormChannelMessageMode('custom')}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${
                          formChannelMessageMode === 'custom' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Message fixe (Template)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormChannelMessageMode('ai')}
                        className={`px-2.5 py-1 rounded text-xs font-medium border ${
                          formChannelMessageMode === 'ai' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        Rédigé par l'IA Gemini
                      </button>
                    </div>
                  </div>

                  {formChannelMessageMode === 'custom' ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-slate-300">Texte du message de salon :</label>
                      <textarea
                        rows={3}
                        value={formChannelCustomMessage}
                        onChange={(e) => setFormChannelCustomMessage(e.target.value)}
                        placeholder="⚠️ **Alerte** : {user} a déclenché un événement dans #{channel} : _{message}_"
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                        <span>Variables disponibles :</span>
                        {['{user}', '{channel}', '{message}'].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFormChannelCustomMessage(prev => `${prev} ${v}`)}
                            className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-cyan-300 border border-slate-800 hover:border-cyan-500"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-slate-300">Consigne donnée à l'IA pour rédiger l'alerte :</label>
                      <textarea
                        rows={3}
                        value={formChannelAiPrompt}
                        onChange={(e) => setFormChannelAiPrompt(e.target.value)}
                        placeholder="Rédige une alerte claire pour l'équipe résumant le problème et indiquant le contexte."
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  )}

                </div>
              )}

              {/* 6. Cooldown settings */}
              <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    Délai d'attente (Cooldown) anti-spam de cette règle :
                  </label>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
                    {formCooldown}s
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 20, 30, 60, 120].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setFormCooldown(sec)}
                      className={`py-1.5 rounded-md text-xs font-semibold font-mono transition-all border ${
                        formCooldown === sec
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-500">
                  Évite que le bot n'envoie plusieurs alertes d'affilée si le membre poste plusieurs messages en quelques secondes.
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Check className="w-4 h-4" />
                  {editingEvent ? "Mettre à jour l'événement" : "Créer l'événement"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default EventManager;
