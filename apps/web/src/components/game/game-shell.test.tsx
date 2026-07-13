import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GameShell } from "@/components/game/game-shell";
import { getGameShellFixture } from "@/lib/game-shell-state";

describe("GameShell fixture states", () => {
  it("renders a completed turn with outcome, state diff and active composer", () => {
    render(<GameShell fixture={getGameShellFixture("completed")} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Il varco sommerso",
    );
    expect(screen.getByTestId("rule-result")).toBeInTheDocument();
    expect(screen.getByTestId("state-diff")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Scrivi la tua azione" }),
    ).toBeEnabled();
    expect(screen.getByRole("log")).toHaveAccessibleName(
      "Cronologia dell'avventura",
    );
  });

  it("maps loading to rules processing and locks mutating controls", () => {
    render(<GameShell fixture={getGameShellFixture("loading")} />);

    expect(screen.getByTestId("game-shell")).toHaveAttribute(
      "data-turn-state",
      "processing_rules",
    );
    expect(screen.getByTestId("turn-loading-cue")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Scrivi la tua azione" }),
    ).toBeDisabled();
  });

  it("announces streaming narration by completed block instead of by token", () => {
    render(
      <GameShell fixture={getGameShellFixture("streaming_provisional")} />,
    );

    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "off");
    expect(screen.getByTestId("narrative-live-announcer")).toHaveTextContent(
      /La vibrazione oltre la parete si interrompe di colpo/u,
    );
    expect(
      screen.getByTestId("narrative-live-announcer"),
    ).not.toHaveTextContent(/Nara abbassa la voce/u);
  });

  it("shows a safe retry only when no state was applied", () => {
    render(<GameShell fixture={getGameShellFixture("error")} />);

    expect(screen.getByTestId("safe-retry-banner")).toHaveTextContent(
      "Nessun cambiamento",
    );
    expect(
      screen.getByRole("button", { name: "Riprova in sicurezza" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("textbox", { name: "Scrivi la tua azione" }),
    ).toBeEnabled();
  });

  it("reconnects after commit without exposing retry or a second submit", () => {
    render(<GameShell fixture={getGameShellFixture("reconnect")} />);

    expect(screen.getByTestId("connection-status")).toHaveTextContent(
      "Il turno è già salvo",
    );
    expect(
      screen.queryByRole("button", { name: "Riprova in sicurezza" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Scrivi la tua azione" }),
    ).toBeDisabled();
  });

  it("keeps long narrative content complete and the composer reachable", () => {
    render(<GameShell fixture={getGameShellFixture("long")} />);

    expect(
      screen.getByText(/qualcosa dall'altra parte stesse misurando il tempo/u),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invia azione" }),
    ).toBeInTheDocument();
  });
});
