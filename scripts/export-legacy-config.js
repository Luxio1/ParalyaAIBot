// Export de la configuration de l'ANCIENNE application (stockée dans le navigateur).
// Utilisation : ouvrir l'ancien dashboard dans le navigateur, appuyer sur F12 → onglet Console,
// coller tout ce fichier puis Entrée. Un fichier legacy-config.json est téléchargé.
// ⚠️ Le fichier contient le token Discord en clair : ne le partagez pas et supprimez-le après import.
(() => {
  const raw = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("discord_")) raw[key] = localStorage.getItem(key);
  }
  const json = (k, d) => { try { return JSON.parse(raw[k] ?? ""); } catch { return d; } };
  const bool = (k, d) => (raw[k] === undefined ? d : raw[k] === "true");
  const num = (k, d) => (raw[k] === undefined || isNaN(Number(raw[k])) ? d : Number(raw[k]));

  const config = {
    token: raw.discord_token ?? "",
    clientId: raw.discord_client_id ?? "",
    prefix: raw.discord_prefix ?? "!",
    responseMode: raw.discord_response_mode ?? "both",
    systemInstruction: raw.discord_system_instruction ?? "",
    model: raw.discord_model ?? "",
    channelRestrictionMode: raw.discord_channel_mode ?? "all",
    allowedChannels: json("discord_allowed_channels", []),
    allowDMs: raw.discord_allow_dms !== "false",
    rateLimitEnabled: bool("discord_ratelimit_enabled", false),
    cooldownSeconds: num("discord_cooldown_seconds", 15),
    maxRequestsBeforeCooldown: num("discord_max_requests_before_cooldown", 3),
    bypassRoles: json("discord_bypass_roles", []),
    bypassUsers: json("discord_bypass_users", []),
    notifyOnRateLimit: raw.discord_notify_ratelimit !== "false",
    dynamicContextEnabled: raw.discord_dynamic_context_enabled !== "false",
    dynamicContextRetentionMinutes: num("discord_dynamic_context_retention", 15),
    dynamicContextMaxTurns: num("discord_dynamic_context_max_turns", 6),
    customCommands: json("discord_custom_commands", []),
    events: json("discord_events", []),
    dmRelayEnabled: bool("discord_dm_relay_enabled", false),
    dmRelayChannelId: raw.discord_dm_relay_channel_id ?? "",
    simulatorPseudo: raw.discord_sim_pseudo ?? "Alex",
  };

  const payload = { format: "discord-ai-bot-studio/legacy", exportedAt: new Date().toISOString(), config };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "legacy-config.json" });
  document.body.appendChild(a); a.click(); a.remove();
  console.log(`✅ Export terminé : ${Object.keys(raw).length} clés, ${config.customCommands.length} commandes, ${config.events.length} règles.`);
})();
