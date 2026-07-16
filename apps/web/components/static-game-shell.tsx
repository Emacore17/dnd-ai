import {
  ArrowUp,
  Compass,
  HeartPulse,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { STATIC_GAME_SHELL_FIXTURE } from "@/lib/static-game-shell-fixture";

const fixture = STATIC_GAME_SHELL_FIXTURE;

export function StaticGameShell() {
  return (
    <main
      data-game-shell="static"
      className="mx-auto h-svh w-full overflow-hidden bg-background lg:px-6"
    >
      <div className="mx-auto flex h-svh w-full max-w-3xl flex-col overflow-hidden bg-background sm:border-x sm:border-border/70">
        <header className="shrink-0 border-b border-border/80 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                <MapPin aria-hidden="true" className="size-3.5" />
                {fixture.campaignLabel}
              </p>
              <h1 className="text-balance text-xl leading-tight font-semibold tracking-[-0.025em] sm:text-2xl">
                {fixture.sceneTitle}
              </h1>
            </div>

            <Badge
              variant="outline"
              className="mt-0.5 shrink-0 border-success/30 bg-success/8 px-2.5 py-1 text-success"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-success"
              />
              {fixture.saveLabel}
            </Badge>
          </div>

          <div
            aria-label="Stato dell’avventura"
            className="mt-4 flex min-h-11 items-center gap-3 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-1.5 text-foreground">
              <HeartPulse
                aria-hidden="true"
                className="size-4 text-destructive"
              />
              {fixture.playerStatus.hitPoints}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" className="size-4 text-success" />
              {fixture.playerStatus.condition}
            </span>
          </div>
        </header>

        <section
          aria-label="Conversazione di gioco"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 overscroll-contain sm:space-y-6 sm:px-6 sm:py-6"
        >
          <article
            data-message-kind="narration"
            className="border-l-2 border-primary/70 pl-4 sm:pl-5"
          >
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-primary uppercase">
              <Compass aria-hidden="true" className="size-4" />
              Dungeon Master
            </p>
            <p className="max-w-[65ch] text-[1.0625rem] leading-7 text-foreground/95">
              {fixture.narration}
            </p>
          </article>

          <article
            data-message-kind="player-action"
            className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-secondary px-4 py-3 text-sm leading-6 text-secondary-foreground sm:max-w-[78%]"
          >
            <p className="sr-only">La tua azione</p>
            {fixture.playerAction}
          </article>

          <Card
            data-message-kind="rule-result"
            className="gap-0 border-border/80 bg-card py-0 shadow-none"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {fixture.ruleResult.label}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {fixture.ruleResult.formula}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-success/30 bg-success/8 text-success"
                >
                  {fixture.ruleResult.outcome}
                </Badge>
              </div>
              <Separator className="my-4" />
              <p className="text-sm leading-6 text-muted-foreground">
                {fixture.ruleResult.detail}
              </p>
            </CardContent>
          </Card>

          <section aria-labelledby="current-decision">
            <Separator className="mb-5" />
            <p className="mb-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Cosa fai?
            </p>
            <h2
              id="current-decision"
              className="text-pretty text-lg font-semibold tracking-[-0.015em]"
            >
              {fixture.decision}
            </h2>
            <div
              aria-label="Azioni suggerite"
              className="mt-4 grid grid-cols-2 gap-2"
            >
              {fixture.suggestedActions.map((action, index) => (
                <Button
                  key={action}
                  type="button"
                  variant={index === 0 ? "default" : "outline"}
                  size="lg"
                  className="w-full px-3 text-sm"
                >
                  {action}
                </Button>
              ))}
            </div>
          </section>
        </section>

        <footer className="shrink-0 border-t border-border/80 bg-background px-3 pt-3 pb-[var(--safe-area-bottom)] sm:px-4">
          <div
            role="group"
            aria-labelledby="player-action-label"
            className="flex items-center gap-2"
          >
            <label
              id="player-action-label"
              htmlFor="player-action"
              className="sr-only"
            >
              La tua azione
            </label>
            <Input
              id="player-action"
              readOnly
              placeholder="Scrivi la tua azione…"
              className="h-12 rounded-xl bg-card px-4"
            />
            <Button
              type="button"
              size="icon-lg"
              aria-label="Invia azione"
              className="shrink-0 rounded-xl"
            >
              <ArrowUp aria-hidden="true" className="size-5" />
            </Button>
          </div>

          <nav
            aria-label="HUD dell’avventura"
            className="mt-2 grid grid-cols-3 gap-1"
          >
            {fixture.hudItems.map((item) => (
              <Button
                key={item}
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
              >
                {item}
              </Button>
            ))}
          </nav>
        </footer>
      </div>
    </main>
  );
}
