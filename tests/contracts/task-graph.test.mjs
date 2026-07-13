import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import {
  expandDependencyExpression,
  validateTaskDocuments,
  validateTaskGraph,
} from "../../scripts/lib/task-graph.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function taskCard({
  id,
  status = "BACKLOG",
  dependencies = "—",
  references = "`docs/MVP_SPEC.md` §31 `BL-001`",
}) {
  return `### ${id} — Fixture

- **Stato:** \`${status}\`
- **Progresso:** \`0%\`
- **Esito test:** \`NOT_RUN\`
- **Contesto verificato:** \`NO\` — commit/SHA: \`—\`; data: \`—\`
- **Priorità / stima:** \`P0\` / \`S\`
- **Dipendenze:** ${dependencies}
- **Riferimenti obbligatori:** ${references}
- **Obiettivo:** Fixture
- **Deliverable:** Fixture
- **Criterio di accettazione:** Fixture
- **Test obbligatori prima di \`DONE\`:**
  - [ ] Fixture
- **Documentazione e contesto:** Fixture
- **Evidenze di chiusura:** Fixture
- **Note, rischi o bloccanti:** \`—\`
`;
}

test("the repository task graph and MVP backlog stay aligned", async () => {
  const [taskMarkdown, specMarkdown] = await Promise.all([
    readFile(path.join(repositoryRoot, "docs", "TASKS.md"), "utf8"),
    readFile(path.join(repositoryRoot, "docs", "MVP_SPEC.md"), "utf8"),
  ]);

  assert.deepEqual(validateTaskDocuments(taskMarkdown, specMarkdown), []);
});

test("dependency expressions reject prose conditions", () => {
  assert.throws(
    () => expandDependencyExpression("MVP stabile"),
    /dependency must be a task ID or range/,
  );
});

test("unknown dependencies and cycles fail the graph", () => {
  const markdown = [
    taskCard({ id: "BL-001", dependencies: "BL-002" }),
    taskCard({ id: "BL-002", dependencies: "BL-001" }),
    taskCard({ id: "BL-003", dependencies: "BL-999" }),
  ].join("\n");
  const errors = validateTaskGraph(markdown);

  assert.ok(errors.some((error) => error.includes("dependency-cycle")));
  assert.ok(
    errors.some((error) => error.includes("unknown-dependency: BL-999")),
  );
});

test("a UI task must cite the design contract and accepted ADR", () => {
  const markdown = [
    taskCard({
      id: "BL-079",
      references:
        "`docs/product/UX_UI_DESIGN.md`; `docs/adr/0001-mobile-first-conversational-ui.md`; `docs/MVP_SPEC.md` §31 `BL-079`",
    }),
    taskCard({
      id: "BL-005",
      dependencies: "BL-079",
      references:
        "`docs/product/UX_UI_DESIGN.md`; `docs/MVP_SPEC.md` §31 `BL-005`",
    }).replace(
      "Fixture\n- **Deliverable:**",
      "Component/mobile accessibility\n- **Deliverable:**",
    ),
  ].join("\n");
  const errors = validateTaskGraph(markdown);

  assert.ok(errors.some((error) => error.includes("missing-ux-adr-reference")));
});
