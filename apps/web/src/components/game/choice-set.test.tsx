import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoiceSet, type ChoiceOption } from "@/components/game/choice-set";

const choices: readonly ChoiceOption[] = [
  { id: "left", label: "Accetta il patto" },
  {
    id: "right",
    label: "Apri il passaggio",
    prerequisite: { label: "Serve la chiave integra", met: false },
  },
];

describe("ChoiceSet", () => {
  it("shows prerequisites and confirms an irreversible choice exactly once", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ChoiceSet
        actions={choices}
        choiceSetId="pact-choice"
        confirmation={{
          description: "Il patto cambierà in modo permanente questa alleanza.",
        }}
        irreversible
        onSelect={onSelect}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Apri il passaggio" }),
    ).toBeDisabled();
    expect(screen.getByText(/Serve la chiave integra/u)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accetta il patto" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Torna indietro" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Accetta il patto" }));
    await user.click(screen.getByRole("button", { name: "Conferma scelta" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(choices[0]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Scelta inviata: Accetta il patto.",
    );
    expect(
      screen.getByRole("button", { name: "Accetta il patto" }),
    ).toBeDisabled();
  });

  it("locks a reversible choice after the first selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ChoiceSet
        actions={choices}
        choiceSetId="reversible-choice"
        onSelect={onSelect}
      />,
    );

    const choice = screen.getByRole("button", { name: "Accetta il patto" });
    await user.click(choice);
    await user.click(choice);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(choice).toBeDisabled();
  });

  it("renders a consumed choice set as read-only", () => {
    render(
      <ChoiceSet actions={choices} choiceSetId="consumed-choice" consumed />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Scelta già confermata.",
    );
    expect(
      screen.getByRole("button", { name: "Accetta il patto" }),
    ).toBeDisabled();
  });

  it("resets the local one-shot lock for a new canonical choice set", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ChoiceSet actions={choices} choiceSetId="first-choice" />,
    );

    await user.click(screen.getByRole("button", { name: "Accetta il patto" }));
    expect(
      screen.getByRole("button", { name: "Accetta il patto" }),
    ).toBeDisabled();

    rerender(<ChoiceSet actions={choices} choiceSetId="second-choice" />);

    expect(
      screen.getByRole("button", { name: "Accetta il patto" }),
    ).toBeEnabled();
    expect(screen.queryByText(/Scelta inviata/u)).not.toBeInTheDocument();
  });
});
