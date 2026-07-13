export const canonicalTurnStates = [
  "idle",
  "submitting",
  "queued",
  "processing_rules",
  "streaming_provisional",
  "committing",
  "completed",
  "failed_precommit",
  "completed_with_delivery_error",
  "blocked_safety",
] as const;

export type CanonicalTurnState = (typeof canonicalTurnStates)[number];

export const fixtureAliases = {
  error: "failed_precommit",
  loading: "processing_rules",
  long: "completed",
  reconnect: "completed_with_delivery_error",
} as const satisfies Record<string, CanonicalTurnState>;

export type FixtureAlias = keyof typeof fixtureAliases;
export type ShellFixtureName = CanonicalTurnState | FixtureAlias;
export type TurnStateTone = "danger" | "info" | "neutral" | "success";

export interface TurnStatePresentation {
  announce: string;
  composerLocked: boolean;
  detail: string;
  label: string;
  retryable: boolean;
  stateApplied: boolean;
  tone: TurnStateTone;
}

export const turnStatePresentation = {
  idle: {
    announce: "Campagna pronta. Puoi scegliere o scrivere una nuova azione.",
    composerLocked: false,
    detail: "Tocca a te",
    label: "Pronto",
    retryable: false,
    stateApplied: false,
    tone: "neutral",
  },
  submitting: {
    announce: "Invio dell'azione in corso.",
    composerLocked: true,
    detail: "Invio sicuro in corso",
    label: "Invio",
    retryable: false,
    stateApplied: false,
    tone: "info",
  },
  queued: {
    announce: "Azione ricevuta e in attesa di elaborazione.",
    composerLocked: true,
    detail: "Azione ricevuta",
    label: "In coda",
    retryable: false,
    stateApplied: false,
    tone: "info",
  },
  processing_rules: {
    announce: "Il sistema sta risolvendo regole e conseguenze.",
    composerLocked: true,
    detail: "Regole e conseguenze",
    label: "Risoluzione",
    retryable: false,
    stateApplied: false,
    tone: "info",
  },
  streaming_provisional: {
    announce: "La risposta è in preparazione e non è ancora definitiva.",
    composerLocked: true,
    detail: "Risposta provvisoria",
    label: "Narrazione",
    retryable: false,
    stateApplied: false,
    tone: "info",
  },
  committing: {
    announce: "Salvataggio delle conseguenze del turno in corso.",
    composerLocked: true,
    detail: "Conferma dello stato",
    label: "Salvataggio",
    retryable: false,
    stateApplied: false,
    tone: "info",
  },
  completed: {
    announce: "Turno completato e salvato. Puoi continuare.",
    composerLocked: false,
    detail: "Turno salvato",
    label: "Completato",
    retryable: false,
    stateApplied: true,
    tone: "success",
  },
  failed_precommit: {
    announce: "L'azione non è stata applicata. Puoi riprovare in sicurezza.",
    composerLocked: false,
    detail: "Nessun cambiamento applicato",
    label: "Da riprovare",
    retryable: true,
    stateApplied: false,
    tone: "danger",
  },
  completed_with_delivery_error: {
    announce:
      "Il turno è stato salvato. Stiamo recuperando la risposta senza ripetere l'azione.",
    composerLocked: true,
    detail: "Stato applicato, risposta in recupero",
    label: "Riconnessione",
    retryable: false,
    stateApplied: true,
    tone: "info",
  },
  blocked_safety: {
    announce: "L'azione non è stata inviata. Riformulala per continuare.",
    composerLocked: false,
    detail: "Riformula l'azione",
    label: "Azione sospesa",
    retryable: false,
    stateApplied: false,
    tone: "danger",
  },
} as const satisfies Record<CanonicalTurnState, TurnStatePresentation>;

export interface SuggestedActionFixture {
  id: string;
  label: string;
}

export interface PartyResourceFixture {
  current: number;
  id: string;
  label: string;
  max: number;
}

export interface PartyMemberFixture {
  condition: string;
  hp: number;
  id: string;
  maxHp: number;
  name: string;
  resources: readonly PartyResourceFixture[];
  role: string;
}

export type RuleResultTone = "failure" | "neutral" | "success";

export type RuleDifficultyFixture =
  | {
      label: string;
      value: number;
      visibility: "shown";
    }
  | {
      visibility: "hidden";
    };

export interface GameShellFixture {
  actLabel: string;
  canonicalState: CanonicalTurnState;
  fixtureName: ShellFixtureName;
  isLongContent: boolean;
  objective: {
    detail: string;
    label: string;
    progress: string;
  };
  party: PartyMemberFixture[];
  playerAction: string;
  protagonist: PartyMemberFixture;
  ruleResult: {
    degree: string;
    difficulty: RuleDifficultyFixture;
    formula: string;
    label: string;
    sourceLabel: string;
    tone: RuleResultTone;
    total: number;
  };
  sceneTitle: string;
  stateDiff: string;
  stateVersion: number;
  suggestedActions: SuggestedActionFixture[];
  turnNarrative: string;
}

const standardNarrative = `La vibrazione oltre la parete si interrompe di colpo. Nel silenzio, i simboli sulla porta rispondono alla luce della tua torcia: non sono decorazioni, ma una **sequenza che indica il livello dell'acqua**.

Nara abbassa la voce. «Se la leggiamo al contrario, potremmo aprire il passaggio senza attivare il meccanismo.»`;

const longNarrative = `${standardNarrative}

Una seconda linea si accende sotto la prima. Segna tre camere collegate e una sola via ancora asciutta. L'ultima camera pulsa con un ritmo regolare, come se qualcosa dall'altra parte stesse misurando il tempo insieme a voi.

Timo indica una fessura quasi invisibile nel pavimento. Da lì arriva aria fredda e pulita: una strada più lunga, ma forse meno esposta. Nessuno dei due percorsi sembra chiudersi alle vostre spalle, almeno per ora.`;

const suggestedActions: SuggestedActionFixture[] = [
  { id: "inspect", label: "Esamino la sequenza senza toccarla" },
  { id: "ask-nara", label: "Chiedo a Nara cosa riconosce" },
  { id: "side-route", label: "Cerco una via laterale" },
  { id: "listen", label: "Resto in ascolto" },
];

const protagonist: PartyMemberFixture = {
  condition: "Lucida",
  hp: 18,
  id: "player-mira",
  maxHp: 24,
  name: "Mira",
  resources: [{ current: 2, id: "focus", label: "Concentrazione", max: 3 }],
  role: "Esploratrice",
};

const party: PartyMemberFixture[] = [
  {
    condition: "Pronta",
    hp: 13,
    id: "companion-nara",
    maxHp: 18,
    name: "Nara",
    resources: [{ current: 1, id: "insight", label: "Intuizioni", max: 2 }],
    role: "Analista",
  },
  {
    condition: "Affaticato",
    hp: 9,
    id: "companion-timo",
    maxHp: 12,
    name: "Timo",
    resources: [{ current: 2, id: "guard", label: "Guardia", max: 2 }],
    role: "Guardiano",
  },
];

export function resolveCanonicalTurnState(
  fixtureName: ShellFixtureName,
): CanonicalTurnState {
  return fixtureName in fixtureAliases
    ? fixtureAliases[fixtureName as FixtureAlias]
    : (fixtureName as CanonicalTurnState);
}

export function isShellFixtureName(value: string): value is ShellFixtureName {
  return (
    canonicalTurnStates.includes(value as CanonicalTurnState) ||
    value in fixtureAliases
  );
}

export function getGameShellFixture(
  requestedFixture: string | undefined,
): GameShellFixture {
  const fixtureName =
    requestedFixture && isShellFixtureName(requestedFixture)
      ? requestedFixture
      : "completed";
  const canonicalState = resolveCanonicalTurnState(fixtureName);
  const isLongContent = fixtureName === "long";

  return {
    actLabel: "Atto I · Soglia",
    canonicalState,
    fixtureName,
    isLongContent,
    objective: {
      detail:
        "Trova il percorso asciutto e raggiungi la camera centrale prima che la marea torni.",
      label: "Apri il varco sommerso",
      progress: "2 di 4 indizi",
    },
    party,
    playerAction: "Osservo la porta e cerco un ritmo nei simboli.",
    protagonist,
    ruleResult: {
      degree: "Successo",
      difficulty: { label: "Difficile", value: 16, visibility: "shown" },
      formula: "d20 (14) + Intuito (2) + Competenza (2)",
      label: "Percezione",
      sourceLabel: "Regole base v1",
      tone: "success",
      total: 18,
    },
    sceneTitle: "Il varco sommerso",
    stateDiff: "Nuovo indizio: la sequenza segue il livello dell'acqua.",
    stateVersion: 42,
    suggestedActions,
    turnNarrative: isLongContent ? longNarrative : standardNarrative,
  };
}
