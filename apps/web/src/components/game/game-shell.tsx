"use client";

import {
  BackpackIcon,
  BookOpenTextIcon,
  CircleDotIcon,
  MenuIcon,
  UsersIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useId, useState } from "react";

import { ConnectionStatus } from "@/components/game/connection-status";
import { CurrentObjectiveCard } from "@/components/game/current-objective-card";
import { FreeActionComposer } from "@/components/game/free-action-composer";
import { GameConversation } from "@/components/game/game-conversation";
import { GameDrawer } from "@/components/game/game-drawer";
import { NarrativeTurn } from "@/components/game/narrative-turn";
import { PartyStatusPanel } from "@/components/game/party-status-panel";
import { RuleResultCard } from "@/components/game/rule-result-card";
import { SafeRetryBanner } from "@/components/game/safe-retry-banner";
import { SaveIndicator } from "@/components/game/save-indicator";
import { SuggestedActionList } from "@/components/game/suggested-action-list";
import { TurnProgress } from "@/components/game/turn-progress";
import {
  GameMotion,
  GameMotionProvider,
} from "@/components/motion/game-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useVisualViewportHeight } from "@/hooks/use-visual-viewport-height";
import {
  turnStatePresentation,
  type CanonicalTurnState,
  type GameShellFixture,
  type SuggestedActionFixture,
} from "@/lib/game-shell-state";
import { getNarrativeLiveAnnouncement } from "@/lib/narrative-live-announcement";

export interface GameShellProps {
  fixture: GameShellFixture;
}

type ShellStyle = CSSProperties & {
  "--game-viewport-height"?: string;
};

const pendingStates: ReadonlySet<CanonicalTurnState> = new Set([
  "submitting",
  "queued",
  "processing_rules",
  "streaming_provisional",
  "committing",
]);

function InventoryPreview() {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center gap-2">
        <BackpackIcon aria-hidden="true" className="size-4 text-primary" />
        <h2 className="text-sm font-semibold" id={headingId}>
          Inventario rapido
        </h2>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Due oggetti sono pronti. Le azioni di inventario saranno collegate allo
        stato canonico nel core loop.
      </p>
      <ul className="grid gap-2 text-sm" role="list">
        <li className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
          <span>Torcia schermata</span>
          <span className="font-mono text-xs text-muted-foreground">1</span>
        </li>
        <li className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5">
          <span>Kit da corda</span>
          <span className="font-mono text-xs text-muted-foreground">1</span>
        </li>
      </ul>
    </section>
  );
}

function ProtagonistSummary({ fixture }: GameShellProps) {
  const { protagonist } = fixture;
  const healthPercentage = Math.min(
    100,
    Math.max(0, (protagonist.hp / Math.max(1, protagonist.maxHp)) * 100),
  );

  return (
    <section
      aria-label="Stato essenziale del protagonista"
      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2"
      data-testid="protagonist-summary"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{protagonist.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {protagonist.role} · {protagonist.condition}
        </p>
      </div>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        <span className="sr-only">Punti salute: </span>
        {protagonist.hp}/{protagonist.maxHp} HP
      </p>
      <div
        aria-label={`Punti salute di ${protagonist.name}`}
        aria-valuemax={protagonist.maxHp}
        aria-valuemin={0}
        aria-valuenow={protagonist.hp}
        className="col-span-2 h-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-game-success"
          style={{ width: `${healthPercentage}%` }}
        />
      </div>
    </section>
  );
}

function TurnLoadingCue({ state }: { state: CanonicalTurnState }) {
  if (!pendingStates.has(state)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="grid max-w-[90%] gap-3 py-2"
      data-testid="turn-loading-cue"
    >
      <Skeleton className="h-3 w-24 rounded-full" />
      <Skeleton className="h-3 w-full rounded-full" />
      <Skeleton className="h-3 w-[72%] rounded-full" />
    </div>
  );
}

function StateAppliedNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-game-success/25 bg-game-success/8 px-3 py-3 text-sm leading-6"
      data-testid="state-diff"
    >
      <CircleDotIcon
        aria-hidden="true"
        className="mt-1 size-4 shrink-0 text-game-success"
      />
      <span>{children}</span>
    </div>
  );
}

function SafetyGuidance({ state }: { state: CanonicalTurnState }) {
  if (state !== "blocked_safety") {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-game-danger/35 bg-game-danger/8 px-4 py-3 text-sm leading-6"
      role="group"
    >
      Questa formulazione non può essere inviata. Descrivi un&apos;azione
      diversa per continuare: nessun cambiamento è stato applicato.
    </div>
  );
}

function MobileHud({ fixture }: GameShellProps) {
  const partyMembers = [fixture.protagonist, ...fixture.party];

  return (
    <nav
      aria-label="Pannelli di gioco"
      className="mobile-hud grid grid-cols-3 border-t border-game-border bg-background px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <GameDrawer
        description="Obiettivo corrente e progresso visibile."
        title="Obiettivo"
        trigger={
          <Button
            className="min-h-11 min-w-11 flex-col gap-0.5 rounded-none px-1 text-[0.6875rem]"
            data-testid="hud-objective"
            type="button"
            variant="ghost"
          >
            <BookOpenTextIcon aria-hidden="true" className="size-4" />
            Obiettivo
          </Button>
        }
      >
        <CurrentObjectiveCard objective={fixture.objective} />
      </GameDrawer>

      <GameDrawer
        description="Punti salute e condizioni essenziali della compagnia."
        title="Compagnia"
        trigger={
          <Button
            className="min-h-11 min-w-11 flex-col gap-0.5 rounded-none px-1 text-[0.6875rem]"
            data-testid="hud-party"
            type="button"
            variant="ghost"
          >
            <UsersIcon aria-hidden="true" className="size-4" />
            Party
          </Button>
        }
      >
        <PartyStatusPanel members={partyMembers} />
      </GameDrawer>

      <GameDrawer
        description="Anteprima degli oggetti pronti per la scena."
        title="Inventario"
        trigger={
          <Button
            className="min-h-11 min-w-11 flex-col gap-0.5 rounded-none px-1 text-[0.6875rem]"
            data-testid="hud-inventory"
            type="button"
            variant="ghost"
          >
            <BackpackIcon aria-hidden="true" className="size-4" />
            Inventario
          </Button>
        }
      >
        <InventoryPreview />
      </GameDrawer>
    </nav>
  );
}

function GameMenu({ fixture }: GameShellProps) {
  const partyMembers = [fixture.protagonist, ...fixture.party];

  return (
    <GameDrawer
      description="Contesto della scena e pannelli secondari, senza lasciare il racconto."
      title="Dettagli avventura"
      trigger={
        <Button
          aria-label="Apri menu di gioco"
          className="size-11 shrink-0 rounded-xl"
          data-testid="game-menu"
          size="icon"
          type="button"
          variant="ghost"
        >
          <MenuIcon aria-hidden="true" className="size-5" />
        </Button>
      }
    >
      <div className="grid gap-5">
        <CurrentObjectiveCard objective={fixture.objective} />
        <Separator />
        <PartyStatusPanel members={partyMembers} />
        <Separator />
        <InventoryPreview />
      </div>
    </GameDrawer>
  );
}

export function GameShell({ fixture }: GameShellProps) {
  const [draft, setDraft] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const viewportHeight = useVisualViewportHeight();
  const presentation = turnStatePresentation[fixture.canonicalState];
  const partyMembers = [fixture.protagonist, ...fixture.party];
  const isReconnecting =
    fixture.canonicalState === "completed_with_delivery_error";
  const isStreaming = fixture.canonicalState === "streaming_provisional";
  const showResolvedTurn = fixture.canonicalState === "completed";
  const shellStyle: ShellStyle | undefined =
    viewportHeight > 0
      ? { "--game-viewport-height": `${viewportHeight}px` }
      : undefined;

  function selectSuggestedAction(action: SuggestedActionFixture) {
    setDraft(action.label);
    setLocalNotice(
      "Suggerimento copiato nel composer. Puoi modificarlo liberamente.",
    );
  }

  function submitFixtureAction(value: string) {
    setLocalNotice(
      `Fixture locale: “${value}”. Nessun turno è stato inviato al server.`,
    );
    setDraft("");
  }

  function requestSafeRetry() {
    setLocalNotice(
      "Fixture locale: retry sicuro richiesto con la stessa chiave idempotente.",
    );
  }

  return (
    <GameMotionProvider>
      <main
        className="mx-auto flex h-[var(--game-viewport-height,100dvh)] min-h-0 w-full min-w-80 max-w-[100rem] flex-col overflow-hidden bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        data-fixture={fixture.fixtureName}
        data-testid="game-shell"
        data-turn-state={fixture.canonicalState}
        style={shellStyle}
      >
        <p
          aria-atomic="true"
          aria-live="polite"
          className="sr-only"
          data-testid="turn-state-announcer"
          role="status"
        >
          {presentation.announce}
        </p>
        <header className="shrink-0 border-b border-game-border bg-game-surface px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-5">
          <div className="mx-auto flex max-w-[92rem] items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.6875rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {fixture.actLabel}
              </p>
              <h1 className="truncate text-base font-semibold tracking-[-0.01em] sm:text-lg">
                {fixture.sceneTitle}
              </h1>
            </div>
            <SaveIndicator
              state={fixture.canonicalState}
              stateVersion={fixture.stateVersion}
            />
            <GameMenu fixture={fixture} />
          </div>
          <div className="mobile-protagonist-summary mx-auto mt-2 max-w-[92rem] lg:hidden">
            <ProtagonistSummary fixture={fixture} />
          </div>
        </header>

        <div className="mx-auto grid min-h-0 w-full max-w-[92rem] flex-1 justify-center lg:grid-cols-[15rem_minmax(0,46rem)_17rem] xl:grid-cols-[17rem_minmax(0,48rem)_19rem]">
          <section
            aria-label="Scena e azioni"
            className="game-stage flex min-h-0 min-w-0 flex-col bg-game-surface lg:col-start-2 lg:row-start-1"
          >
            <div className="turn-progress-slot shrink-0 px-3 pt-3 sm:px-4">
              <TurnProgress state={fixture.canonicalState} />
            </div>

            <ConnectionStatus state={fixture.canonicalState} />

            <GameConversation
              className="game-conversation-slot mt-3 border-y border-game-border/70"
              contentClassName="mx-auto w-full max-w-2xl"
              isReconnecting={isReconnecting}
              isStreaming={isStreaming}
              liveAnnouncement={getNarrativeLiveAnnouncement(
                fixture.turnNarrative,
                isStreaming,
              )}
            >
              <NarrativeTurn content={fixture.playerAction} role="user" />
              {showResolvedTurn ? (
                <GameMotion>
                  <RuleResultCard result={fixture.ruleResult} />
                </GameMotion>
              ) : null}
              {showResolvedTurn ? (
                <GameMotion>
                  <StateAppliedNote>{fixture.stateDiff}</StateAppliedNote>
                </GameMotion>
              ) : null}
              <GameMotion>
                <NarrativeTurn
                  content={fixture.turnNarrative}
                  isStreaming={isStreaming}
                  role="assistant"
                />
              </GameMotion>
              <TurnLoadingCue state={fixture.canonicalState} />
              {localNotice ? (
                <div
                  className="rounded-xl border border-primary/25 bg-primary/8 px-3 py-3 text-sm leading-6"
                  data-testid="fixture-notice"
                >
                  {localNotice}
                </div>
              ) : null}
            </GameConversation>

            <div className="game-action-slot grid shrink-0 gap-3 px-3 pt-3 sm:px-4">
              <SafeRetryBanner
                onRetry={requestSafeRetry}
                retryable={presentation.retryable}
                stateApplied={presentation.stateApplied}
              />
              <SafetyGuidance state={fixture.canonicalState} />
              <SuggestedActionList
                actions={fixture.suggestedActions}
                disabled={presentation.composerLocked}
                onSelect={selectSuggestedAction}
              />
            </div>

            <FreeActionComposer
              className="game-composer-slot"
              disabled={presentation.composerLocked}
              onSubmit={submitFixtureAction}
              onValueChange={setDraft}
              pending={
                pendingStates.has(fixture.canonicalState) || isReconnecting
              }
              value={draft}
            />
            <MobileHud fixture={fixture} />
          </section>

          <aside className="hidden min-h-0 border-r border-game-border bg-game-surface px-5 py-6 lg:col-start-1 lg:row-start-1 lg:block">
            <PartyStatusPanel members={partyMembers} />
          </aside>

          <aside className="hidden min-h-0 border-l border-game-border bg-game-surface px-5 py-6 lg:col-start-3 lg:row-start-1 lg:block">
            <CurrentObjectiveCard objective={fixture.objective} />
            <div className="mt-4 rounded-xl border border-game-border bg-game-surface-elevated px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Scena
              </p>
              <p className="mt-2 text-sm leading-6">
                Una via principale, un passaggio laterale e una decisione ancora
                aperta.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </GameMotionProvider>
  );
}
