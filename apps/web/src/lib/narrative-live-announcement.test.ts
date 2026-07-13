import { describe, expect, it } from "vitest";

import { getNarrativeLiveAnnouncement } from "@/lib/narrative-live-announcement";

describe("getNarrativeLiveAnnouncement", () => {
  it("announces only the latest complete block while streaming", () => {
    expect(
      getNarrativeLiveAnnouncement(
        "**Primo blocco.**\n\nSecondo in corso",
        true,
      ),
    ).toBe("Dungeon Master: Primo blocco.");
  });

  it("stays silent until the first block is complete", () => {
    expect(getNarrativeLiveAnnouncement("Testo ancora in corso", true)).toBe(
      "",
    );
  });

  it("announces the final block when streaming settles", () => {
    expect(
      getNarrativeLiveAnnouncement(
        "Primo blocco.\n\n_Secondo completo._",
        false,
      ),
    ).toBe("Dungeon Master: Secondo completo.");
  });
});
