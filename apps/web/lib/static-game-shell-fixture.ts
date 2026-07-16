export const STATIC_GAME_SHELL_FIXTURE = {
  campaignLabel: "Porto Sommerso · Capitolo 2",
  sceneTitle: "Passaggio di servizio",
  saveLabel: "Salvato",
  playerStatus: {
    hitPoints: "18 / 24 HP",
    condition: "Stabile",
  },
  narration:
    "Il traghetto spegne i fari. Una luce blu pulsa sotto la banchina; Mara si ferma e ti fa cenno di ascoltare.",
  playerAction: "Cerco l’origine della luce senza oltrepassare la linea.",
  ruleResult: {
    label: "Percezione",
    formula: "17 vs 14",
    outcome: "Prova superata",
    detail:
      "È il segnale della Guardia di Marea: qualcuno sta chiedendo aiuto.",
  },
  decision: "Il segnale si allontana nel tunnel.",
  suggestedActions: ["Segui il segnale", "Resta con Mara"],
  hudItems: ["Obiettivo", "Party", "Inventario"],
} as const;
