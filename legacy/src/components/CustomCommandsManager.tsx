import React, { useState } from 'react';
import { 
  Terminal, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Sparkles, 
  MessageSquareText, 
  Zap, 
  Copy, 
  RotateCcw,
  Info,
  HelpCircle
} from 'lucide-react';
import { CustomCommand } from '../types';

interface CustomCommandsManagerProps {
  prefix: string;
  customCommands: CustomCommand[];
  setCustomCommands: React.Dispatch<React.SetStateAction<CustomCommand[]>>;
  isBotOnline?: boolean;
  onApplyToLiveBot?: () => void | Promise<void>;
}

export const DEFAULT_PRESET_COMMANDS: CustomCommand[] = [
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
];

export function CustomCommandsManager({
  prefix,
  customCommands,
  setCustomCommands,
  isBotOnline,
  onApplyToLiveBot
}: CustomCommandsManagerProps) {
  const [editingCommand, setEditingCommand] = useState<CustomCommand | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<'static' | 'ai'>('static');
  const [formStaticResponse, setFormStaticResponse] = useState("");
  const [formAiPromptTemplate, setFormAiPromptTemplate] = useState("");
  const [formSystemInstruction, setFormSystemInstruction] = useState("");

  const handleOpenCreate = () => {
    setEditingCommand(null);
    setFormName("");
    setFormDescription("");
    setFormType("static");
    setFormStaticResponse("");
    setFormAiPromptTemplate("Tu es un assistant expert. Réponds précisément à la demande du joueur : {query}");
    setFormSystemInstruction("");
    setIsCreatingNew(true);
  };

  const handleOpenEdit = (cmd: CustomCommand) => {
    setEditingCommand(cmd);
    setFormName(cmd.name);
    setFormDescription(cmd.description || "");
    setFormType(cmd.type);
    setFormStaticResponse(cmd.staticResponse || "");
    setFormAiPromptTemplate(cmd.aiPromptTemplate || "Tu es un assistant expert. Réponds précisément à la demande : {query}");
    setFormSystemInstruction(cmd.systemInstruction || "");
    setIsCreatingNew(false);
  };

  const handleSaveCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim().toLowerCase().replace(/^[!/?.#$]+/, '');
    if (!cleanName) return;

    if (editingCommand) {
      // Update existing
      setCustomCommands(prev => prev.map(cmd => {
        if (cmd.id === editingCommand.id) {
          return {
            ...cmd,
            name: cleanName,
            description: formDescription.trim(),
            type: formType,
            staticResponse: formType === 'static' ? formStaticResponse : undefined,
            aiPromptTemplate: formType === 'ai' ? formAiPromptTemplate : undefined,
            systemInstruction: formType === 'ai' && formSystemInstruction.trim() ? formSystemInstruction.trim() : undefined
          };
        }
        return cmd;
      }));
      setEditingCommand(null);
    } else {
      // Create new
      const newCmd: CustomCommand = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        description: formDescription.trim(),
        enabled: true,
        type: formType,
        staticResponse: formType === 'static' ? formStaticResponse : undefined,
        aiPromptTemplate: formType === 'ai' ? formAiPromptTemplate : undefined,
        systemInstruction: formType === 'ai' && formSystemInstruction.trim() ? formSystemInstruction.trim() : undefined
      };
      setCustomCommands(prev => [...prev, newCmd]);
      setIsCreatingNew(false);
    }
  };

  const handleToggleCommand = (id: string) => {
    setCustomCommands(prev => prev.map(cmd => {
      if (cmd.id === id) {
        return { ...cmd, enabled: !cmd.enabled };
      }
      return cmd;
    }));
  };

  const handleDeleteCommand = (id: string) => {
    setCustomCommands(prev => prev.filter(cmd => cmd.id !== id));
    if (editingCommand?.id === id) {
      setEditingCommand(null);
    }
  };

  const handleDuplicateCommand = (cmd: CustomCommand) => {
    const duplicated: CustomCommand = {
      ...cmd,
      id: `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${cmd.name}-copie`,
      description: cmd.description ? `${cmd.description} (Copie)` : ""
    };
    setCustomCommands(prev => [...prev, duplicated]);
  };

  const handleRestorePresets = () => {
    if (window.confirm("Voulez-vous réinitialiser vos commandes avec les modèles recommandés par défaut ?")) {
      setCustomCommands(DEFAULT_PRESET_COMMANDS);
    }
  };

  const handleCopyExample = (cmdName: string, id: string) => {
    navigator.clipboard.writeText(`${prefix}${cmdName}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Gestionnaire de Commandes Personnalisées</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Préfixe : {prefix}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Créez vos propres commandes Discord déclenchées par le préfixe <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">{prefix}</code>. 
                Choisissez entre une <strong>réponse simple prédéfinie</strong> ou une <strong>réponse IA sur-mesure</strong> traitant la requête envoyée en paramètre.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isBotOnline && onApplyToLiveBot && (
              <button
                type="button"
                onClick={() => onApplyToLiveBot()}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-yellow-300" />
                Appliquer au bot
              </button>
            )}
            <button
              type="button"
              onClick={handleRestorePresets}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
              title="Restaurer les commandes par défaut"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Modèles par défaut
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Créer une commande
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Commands list + Form drawer/modal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Commands List */}
        <div className={`${isCreatingNew || editingCommand ? "lg:col-span-7" : "lg:col-span-12"} flex flex-col gap-3`}>
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-400 uppercase font-mono tracking-wider">
              Commandes enregistrées ({customCommands.length})
            </span>
            <span className="text-xs text-slate-500">
              {customCommands.filter(c => c.enabled).length} active(s)
            </span>
          </div>

          {customCommands.length === 0 ? (
            <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
              <Terminal className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-300">Aucune commande personnalisée</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                Ajoutez des commandes simples ou des commandes d'IA pour enrichir les fonctionnalités de votre bot Discord.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRestorePresets}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                >
                  Charger les modèles recommandés
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Créer une commande
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {customCommands.map((cmd) => {
                const isSelected = editingCommand?.id === cmd.id;
                return (
                  <div
                    key={cmd.id}
                    className={`bg-slate-900 border rounded-xl p-4 transition-all ${
                      isSelected 
                        ? "border-indigo-500/80 ring-1 ring-indigo-500/30 shadow-md bg-slate-900/90" 
                        : cmd.enabled 
                          ? "border-slate-800 hover:border-slate-700" 
                          : "border-slate-800/40 opacity-60 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      
                      {/* Left info */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                          cmd.type === 'ai' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {cmd.type === 'ai' ? <Sparkles className="w-4 h-4" /> : <MessageSquareText className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-white text-sm bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {prefix}{cmd.name}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              cmd.type === 'ai'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                              {cmd.type === 'ai' ? 'IA Dynamique' : 'Réponse Simple'}
                            </span>
                            {!cmd.enabled && (
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                Désactivée
                              </span>
                            )}
                          </div>

                          {cmd.description && (
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              {cmd.description}
                            </p>
                          )}

                          {/* Preview snippet */}
                          <div className="mt-2.5 text-xs font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 text-slate-300">
                            {cmd.type === 'static' ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-500 font-sans uppercase font-bold flex items-center gap-1">
                                  <MessageSquareText className="w-3 h-3 text-emerald-400" />
                                  Réponse prédéfinie :
                                </span>
                                <p className="text-slate-300 font-sans text-xs line-clamp-2 whitespace-pre-line">
                                  {cmd.staticResponse || "(Aucune réponse configurée)"}
                                </p>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-purple-400 font-sans uppercase font-bold flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  Prompt IA avec paramètre :
                                </span>
                                <p className="text-purple-200/90 font-mono text-[11px] line-clamp-2">
                                  {cmd.aiPromptTemplate || "{query}"}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Toggle active */}
                        <button
                          type="button"
                          onClick={() => handleToggleCommand(cmd.id)}
                          className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                            cmd.enabled ? "bg-indigo-600" : "bg-slate-800"
                          }`}
                          title={cmd.enabled ? "Désactiver la commande" : "Activer la commande"}
                        >
                          <span className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            cmd.enabled ? "translate-x-4" : "translate-x-0"
                          }`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyExample(cmd.name, cmd.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Copier la commande"
                        >
                          {copiedId === cmd.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateCommand(cmd)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Dupliquer la commande"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cmd)}
                          className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="Modifier la commande"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCommand(cmd.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Supprimer la commande"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create / Edit Form Drawer */}
        {(isCreatingNew || editingCommand) && (
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col gap-4 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  {editingCommand ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {editingCommand ? `Modifier ${prefix}${editingCommand.name}` : "Nouvelle commande"}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Définissez la syntaxe et le comportement
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreatingNew(false); setEditingCommand(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCommand} className="flex flex-col gap-4">
              
              {/* Command Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Nom de la commande <span className="text-rose-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 font-mono font-bold text-indigo-400 text-sm">
                    {prefix}
                  </span>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    placeholder="ex: help, regles, code, resume..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 pl-8 pr-3 py-2 text-xs font-mono rounded-lg text-slate-200 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  Les utilisateurs taperont <code className="text-indigo-400">{prefix}{formName || "commande"}</code> sur Discord.
                </span>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Description de la commande (optionnel)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ex: Affiche les règles du serveur Discord"
                  className="bg-slate-950 border border-slate-800 focus:border-indigo-500 px-3 py-2 text-xs rounded-lg text-slate-200 focus:outline-none"
                />
              </div>

              {/* Action Type Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-300">
                  Fonction de la commande <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('static')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                      formType === 'static'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <MessageSquareText className="w-3.5 h-3.5 text-emerald-400" />
                      Réponse Simple
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Renvoie un texte prédéfini fixe (règles, liens, aide, infos).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('ai')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                      formType === 'ai'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300 ring-1 ring-purple-500/40'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Génération IA
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Traite la requête en paramètre avec une consigne IA dédiée.
                    </p>
                  </button>
                </div>
              </div>

              {/* Conditional Form fields according to Action Type */}
              {formType === 'static' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Texte de la réponse Discord</span>
                    <span className="text-[10px] text-slate-500">Markdown supporté</span>
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={formStaticResponse}
                    onChange={(e) => setFormStaticResponse(e.target.value)}
                    placeholder="Écrivez le message que le bot renverra systématiquement (ex: règles, annonce, liens de vote...)"
                    className="bg-slate-950 border border-slate-800 focus:border-emerald-500 p-3 text-xs rounded-lg text-slate-200 focus:outline-none resize-none font-sans leading-relaxed"
                  />
                  <span className="text-[10px] text-slate-500">
                    💡 Astuce : Vous pouvez utiliser les balises Markdown Discord comme <code>**gras**</code>, <code>*italique*</code>, <code>`code`</code> ou des listes à puces.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        Prompt / Modèle de consigne IA
                      </label>
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                        {`{query}`}
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      required
                      value={formAiPromptTemplate}
                      onChange={(e) => setFormAiPromptTemplate(e.target.value)}
                      placeholder="ex: Tu es un expert en code. Réponds précisément à la demande : {query}"
                      className="bg-slate-950 border border-slate-800 focus:border-purple-500 p-3 text-xs rounded-lg text-slate-200 focus:outline-none resize-none font-mono text-[11px] leading-relaxed"
                    />
                    <div className="bg-purple-950/20 border border-purple-500/30 p-2.5 rounded-lg flex items-start gap-2 text-[11px] text-purple-300">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-400" />
                      <p className="leading-tight">
                        La variable <code>{`{query}`}</code> sera automatiquement remplacée par le texte écrit par l'utilisateur après la commande (ex: <code>{prefix}{formName || 'code'} comment trier un tableau</code>).
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-slate-400" />
                      Consigne système dédiée à cette commande (optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={formSystemInstruction}
                      onChange={(e) => setFormSystemInstruction(e.target.value)}
                      placeholder="Optionnel : Personnalisez la personnalité de l'IA pour cette commande spécifique..."
                      className="bg-slate-950 border border-slate-800 focus:border-purple-500 p-2.5 text-xs rounded-lg text-slate-200 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setIsCreatingNew(false); setEditingCommand(null); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingCommand ? "Enregistrer les modifications" : "Créer la commande"}
                </button>
              </div>

            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default CustomCommandsManager;
