import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NarrativeTurn } from "@/components/game/narrative-turn";

describe("NarrativeTurn safe Markdown contract", () => {
  it("renders only narrative paragraphs, emphasis and lists", () => {
    const { container } = render(
      <NarrativeTurn
        content={[
          "Un **segnale forte** e *improvviso*.",
          "",
          "- Primo indizio",
          "- Secondo indizio",
          "",
          "[Portale esterno](https://example.com)",
          "",
          "# Titolo non consentito",
          "",
          "`codice non consentito`",
        ].join("\n")}
        role="assistant"
      />,
    );

    expect(screen.getByText("segnale forte").tagName).toBe("STRONG");
    expect(screen.getByText("improvviso").tagName).toBe("EM");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(container.querySelector("a, h1, code")).not.toBeInTheDocument();
  });

  it("does not mount raw HTML from AI narration", () => {
    const { container } = render(
      <NarrativeTurn
        content={
          'Testo <img src="x" onerror="alert(1)"><script>alert(1)</script>'
        }
        role="assistant"
      />,
    );

    expect(container.querySelector("img, script")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("onerror");
  });
});
