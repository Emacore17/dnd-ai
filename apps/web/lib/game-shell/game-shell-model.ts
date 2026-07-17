export const MAX_ACTION_LENGTH = 2_000;

export type GameShellStatus =
  | "idle"
  | "submitting"
  | "progress"
  | "completed"
  | "reconnect"
  | "error";

export type GameDrawerSection = "objective" | "party" | "inventory";

export type NarrativeTurnView =
  | Readonly<{
      id: string;
      kind: "narration";
      authorLabel: string;
      markdown: string;
    }>
  | Readonly<{
      id: string;
      kind: "player_action";
      text: string;
    }>
  | Readonly<{
      id: string;
      kind: "rule_result";
      label: string;
      formula: string;
      outcome: "success" | "failure";
      detail: string;
      stateDiff: string | null;
    }>;

export interface SafeTurnFailureView {
  readonly message: string;
  readonly retryable: boolean;
  readonly stateApplied: boolean;
}

export interface SceneSummaryView {
  readonly campaignLabel: string;
  readonly sceneTitle: string;
  readonly saveLabel: string;
  readonly hitPointsLabel: string;
  readonly conditionLabel: string;
}

export interface SuggestedActionView {
  readonly id: string;
  readonly label: string;
}

export interface GameHudView {
  readonly objective: string;
  readonly party: readonly string[];
  readonly inventory: readonly string[];
}

export interface TurnProgressView {
  readonly label: string;
  readonly value: number;
}

export interface GameShellViewModel {
  readonly scene: SceneSummaryView;
  readonly status: GameShellStatus;
  readonly draft: string;
  readonly pendingAction: string | null;
  readonly activeDrawer: GameDrawerSection | null;
  readonly turns: readonly NarrativeTurnView[];
  readonly suggestedActions: readonly SuggestedActionView[];
  readonly hud: GameHudView;
  readonly progress: TurnProgressView | null;
  readonly failure: SafeTurnFailureView | null;
  readonly stateDiff: string | null;
}

export type GameShellEvent =
  | Readonly<{ type: "draft_changed"; draft: string }>
  | Readonly<{ type: "submit_requested"; action: string }>
  | Readonly<{ type: "command_acknowledged" }>
  | Readonly<{ type: "progress_received"; progress: TurnProgressView }>
  | Readonly<{ type: "connection_lost" }>
  | Readonly<{ type: "turn_failed"; failure: SafeTurnFailureView }>
  | Readonly<{ type: "retry_requested" }>
  | Readonly<{
      type: "turn_completed";
      turns: readonly NarrativeTurnView[];
      suggestedActions: readonly SuggestedActionView[];
      hud: GameHudView;
      stateDiff: string | null;
    }>
  | Readonly<{ type: "turn_ready" }>
  | Readonly<{ type: "drawer_opened"; section: GameDrawerSection }>
  | Readonly<{ type: "drawer_closed" }>;

export interface FixtureTurnSource {
  eventsFor(action: string): readonly GameShellEvent[];
  retryEventsFor(action: string): readonly GameShellEvent[];
}
