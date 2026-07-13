import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PartyStatusPanel } from "@/components/game/party-status-panel";
import { RuleResultCard } from "@/components/game/rule-result-card";
import { SafeRetryBanner } from "@/components/game/safe-retry-banner";
import { getGameShellFixture } from "@/lib/game-shell-state";

describe("game domain view contracts", () => {
  it("shows the rule formula, visible difficulty and source on demand", async () => {
    const user = userEvent.setup();
    const fixture = getGameShellFixture("completed");

    render(<RuleResultCard result={fixture.ruleResult} />);
    await user.click(
      screen.getByRole("button", { name: "Dettagli del calcolo" }),
    );

    expect(screen.getByText(fixture.ruleResult.formula)).toBeInTheDocument();
    expect(screen.getByText("16 · Difficile")).toBeInTheDocument();
    expect(screen.getByText("Regole base v1")).toBeInTheDocument();
  });

  it("does not disclose a hidden difficulty", async () => {
    const user = userEvent.setup();
    const fixture = getGameShellFixture("completed");

    render(
      <RuleResultCard
        result={{
          ...fixture.ruleResult,
          difficulty: { visibility: "hidden" },
        }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Dettagli del calcolo" }),
    );

    const result = screen.getByTestId("rule-result");
    expect(within(result).getByText("Nascosta")).toBeInTheDocument();
    expect(
      within(result).queryByText("16 · Difficile"),
    ).not.toBeInTheDocument();
  });

  it("renders canonical party resources alongside health and conditions", () => {
    const fixture = getGameShellFixture("completed");

    render(<PartyStatusPanel members={[fixture.protagonist]} />);

    const resources = screen.getByRole("list", { name: "Risorse di Mira" });
    expect(within(resources).getByText("Concentrazione")).toBeInTheDocument();
    expect(within(resources).getByText("2/3")).toBeInTheDocument();
  });

  it("offers retry only when the server contract is retryable and unapplied", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <SafeRetryBanner onRetry={onRetry} retryable stateApplied={false} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Riprova in sicurezza" }),
    );
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <SafeRetryBanner onRetry={onRetry} retryable stateApplied={true} />,
    );
    expect(
      screen.queryByRole("button", { name: "Riprova in sicurezza" }),
    ).not.toBeInTheDocument();

    rerender(
      <SafeRetryBanner
        onRetry={onRetry}
        retryable={false}
        stateApplied={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Riprova in sicurezza" }),
    ).not.toBeInTheDocument();
  });
});
