import type {
  FixtureTurnSource,
  GameHudView,
  GameShellEvent,
  GameShellViewModel,
  NarrativeTurnView,
  SuggestedActionView,
} from "./game-shell-model.ts";

const INITIAL_TURNS = [
  {
    id: "turn-narration-1",
    kind: "narration",
    authorLabel: "DM",
    markdown:
      "Il traghetto spegne i fari. Una luce blu pulsa sotto la banchina; Mara si ferma e ti fa cenno di ascoltare.",
  },
  {
    id: "turn-player-1",
    kind: "player_action",
    text: "Cerco l'origine della luce senza oltrepassare la linea.",
  },
  {
    id: "turn-rule-1",
    kind: "rule_result",
    label: "Percezione",
    formula: "17 vs 14",
    outcome: "success",
    detail:
      "È il segnale della Guardia di Marea: qualcuno sta chiedendo aiuto.",
    stateDiff: null,
  },
] as const satisfies readonly NarrativeTurnView[];

const INITIAL_SUGGESTED_ACTIONS = [
  { id: "follow-signal", label: "Segui il segnale" },
  { id: "stay-with-mara", label: "Resta con Mara" },
  { id: "inspect-dock", label: "Ispeziona la banchina" },
  { id: "call-the-guard", label: "Chiama la Guardia" },
] as const satisfies readonly SuggestedActionView[];

const INITIAL_HUD = {
  objective: "Raggiungi il segnale sotto la banchina.",
  party: ["Mara · esploratrice", "Ivo · navigatore"],
  inventory: ["Lampada stagna", "Corda leggera", "2 kit medici"],
} as const satisfies GameHudView;

function createCompletedTurns(action: string): readonly NarrativeTurnView[] {
  return [
    ...INITIAL_TURNS,
    {
      id: "turn-player-2",
      kind: "player_action",
      text: action,
    },
    {
      id: "turn-narration-2",
      kind: "narration",
      authorLabel: "DM",
      markdown:
        "Avanzi lungo il passaggio di servizio. Il segnale si ferma dietro una paratia socchiusa, mentre Mara copre le tue spalle.",
    },
    {
      id: "turn-rule-2",
      kind: "rule_result",
      label: "Movimento prudente",
      formula: "16 vs 13",
      outcome: "success",
      detail: "Raggiungi la paratia senza attirare attenzione.",
      stateDiff: "Posizione aggiornata: paratia di servizio.",
    },
  ];
}

const COMPLETED_SUGGESTED_ACTIONS = [
  { id: "open-hatch", label: "Apri la paratia" },
  { id: "listen-first", label: "Ascolta oltre la porta" },
  { id: "ask-mara", label: "Chiedi a Mara" },
  { id: "secure-exit", label: "Metti in sicurezza l'uscita" },
] as const satisfies readonly SuggestedActionView[];

const COMPLETED_HUD = {
  ...INITIAL_HUD,
  objective: "Scopri chi sta inviando il segnale.",
} as const satisfies GameHudView;

export const FIXTURE_PROGRESS = {
  type: "progress_received",
  progress: { label: "Interpreto la scena", value: 45 },
} as const satisfies GameShellEvent;

export const FIXTURE_RETRYABLE_FAILURE = {
  type: "turn_failed",
  failure: {
    message: "La risposta non è arrivata. Puoi riprovare la stessa azione.",
    retryable: true,
    stateApplied: false,
  },
} as const satisfies GameShellEvent;

export const FIXTURE_POST_APPLY_FAILURE = {
  type: "turn_failed",
  failure: {
    message:
      "Lo stato è già stato applicato. Attendi la sincronizzazione prima di agire.",
    retryable: false,
    stateApplied: true,
  },
} as const satisfies GameShellEvent;

function createCompletedTurn(action: string): GameShellEvent {
  return {
    type: "turn_completed",
    turns: createCompletedTurns(action),
    suggestedActions: COMPLETED_SUGGESTED_ACTIONS,
    hud: COMPLETED_HUD,
    stateDiff: "Obiettivo e posizione aggiornati.",
  };
}

export const FIXTURE_COMPLETED_TURN = createCompletedTurn(
  "Seguo il segnale restando al riparo.",
);

const FIXTURE_ADVANCED_PROGRESS = {
  type: "progress_received",
  progress: { label: "Applico le conseguenze", value: 80 },
} as const satisfies GameShellEvent;

export const FIXTURE_HAPPY_PATH_EVENTS = [
  { type: "command_acknowledged" },
  FIXTURE_PROGRESS,
  FIXTURE_ADVANCED_PROGRESS,
  FIXTURE_COMPLETED_TURN,
] as const satisfies readonly GameShellEvent[];

export const FIXTURE_RECONNECT_EVENTS = [
  { type: "command_acknowledged" },
  FIXTURE_PROGRESS,
  { type: "connection_lost" },
  {
    type: "progress_received",
    progress: { label: "Connessione ripristinata", value: 65 },
  },
  FIXTURE_COMPLETED_TURN,
] as const satisfies readonly GameShellEvent[];

export const FIXTURE_RETRYABLE_FAILURE_EVENTS = [
  { type: "command_acknowledged" },
  FIXTURE_RETRYABLE_FAILURE,
] as const satisfies readonly GameShellEvent[];

export const FIXTURE_POST_APPLY_FAILURE_EVENTS = [
  { type: "command_acknowledged" },
  FIXTURE_PROGRESS,
  FIXTURE_POST_APPLY_FAILURE,
] as const satisfies readonly GameShellEvent[];

export const FIXTURE_TURN_SOURCE: FixtureTurnSource = {
  eventsFor: (action) => [
    { type: "command_acknowledged" },
    FIXTURE_PROGRESS,
    FIXTURE_ADVANCED_PROGRESS,
    createCompletedTurn(action),
  ],
  retryEventsFor: (action) => [
    FIXTURE_PROGRESS,
    FIXTURE_ADVANCED_PROGRESS,
    createCompletedTurn(action),
  ],
};

export function createInitialGameShellState(): GameShellViewModel {
  return {
    scene: {
      campaignLabel: "Porto Sommerso · Capitolo 2",
      sceneTitle: "Passaggio di servizio",
      saveLabel: "Salvato",
      hitPointsLabel: "18 / 24 HP",
      conditionLabel: "Stabile",
    },
    status: "idle",
    draft: "",
    pendingAction: null,
    activeDrawer: null,
    turns: INITIAL_TURNS,
    suggestedActions: INITIAL_SUGGESTED_ACTIONS,
    hud: INITIAL_HUD,
    progress: null,
    failure: null,
    stateDiff: null,
  };
}
