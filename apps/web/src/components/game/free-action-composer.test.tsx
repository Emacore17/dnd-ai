import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FreeActionComposer } from "@/components/game/free-action-composer";

function ComposerHarness({
  disabled = false,
  onSubmit,
  pending = false,
}: {
  disabled?: boolean;
  onSubmit: (value: string) => void;
  pending?: boolean;
}) {
  const [value, setValue] = useState("");

  return (
    <FreeActionComposer
      disabled={disabled}
      onSubmit={onSubmit}
      onValueChange={setValue}
      pending={pending}
      value={value}
    />
  );
}

describe("FreeActionComposer", () => {
  it("submits a trimmed free action with Enter and updates the counter", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposerHarness onSubmit={onSubmit} />);

    const textbox = screen.getByRole("textbox", {
      name: "Scrivi la tua azione",
    });
    await user.type(textbox, "  Apro la porta  ");

    expect(screen.getByLabelText("17 di 2000 caratteri")).toHaveTextContent(
      "17/2000",
    );
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith("Apro la porta");
  });

  it("keeps Shift+Enter as a newline instead of submitting", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ComposerHarness onSubmit={onSubmit} />);

    const textbox = screen.getByRole("textbox", {
      name: "Scrivi la tua azione",
    });
    await user.type(textbox, "Prima riga");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textbox).toHaveValue("Prima riga\n");
  });

  it("locks the textarea and submit while a turn is pending", () => {
    render(<ComposerHarness onSubmit={vi.fn()} pending />);

    expect(
      screen.getByRole("textbox", { name: "Scrivi la tua azione" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Azione in elaborazione" }),
    ).toBeDisabled();
  });
});
