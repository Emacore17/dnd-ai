const TASK_ID_PATTERN = "(?:BL|GOV|QA|DOC|GATE|BUG|DEC)-[A-Z0-9-]+";
const REQUIRED_FIELDS = [
  "Stato",
  "Progresso",
  "Esito test",
  "Contesto verificato",
  "Priorità / stima",
  "Dipendenze",
  "Riferimenti obbligatori",
  "Obiettivo",
  "Deliverable",
  "Criterio di accettazione",
  "Test obbligatori prima di `DONE`",
  "Documentazione e contesto",
  "Evidenze di chiusura",
  "Note, rischi o bloccanti",
];
const UX_REFERENCE = "docs/product/UX_UI_DESIGN.md";
const UX_ADR_REFERENCE = "docs/adr/0001-mobile-first-conversational-ui.md";
const UX_TASK_SIGNAL =
  /Component(?:\/mobile)?(?: test)? (?:UI|accessibility)|E2E mobile|keyboard-only|responsive\/AA|retry banner|social login|UI localizzata|streaming audio/i;

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldOccurrences(cardText, fieldName) {
  const expression = new RegExp(
    `^- \\*\\*${escapeRegularExpression(fieldName)}:\\*\\*(?: (.*))?$`,
    "gm",
  );
  return [...cardText.matchAll(expression)].map((match) =>
    (match[1] ?? "").trim(),
  );
}

function parseNumericTaskId(taskId) {
  // Task IDs are bounded metadata; this anchored expression has no wildcard branch.
  // eslint-disable-next-line security/detect-unsafe-regex
  const match = /^(?<base>[A-Z]+-(?:[A-Z]+-?)*?)(?<number>\d+)$/.exec(taskId);

  if (!match?.groups) {
    return null;
  }

  return {
    base: match.groups.base,
    number: Number(match.groups.number),
    width: match.groups.number.length,
  };
}

export function expandDependencyExpression(expression) {
  const trimmedExpression = expression.trim();

  if (trimmedExpression === "—") {
    return [];
  }

  const dependencies = [];

  for (const rawToken of trimmedExpression.split(",")) {
    const token = rawToken.trim();

    if (!token) {
      throw new Error("empty dependency token");
    }

    const rangeParts = token.split(/\.\.|–/);

    if (rangeParts.length === 1) {
      if (!new RegExp(`^${TASK_ID_PATTERN}$`).test(token)) {
        throw new Error(`dependency must be a task ID or range: ${token}`);
      }

      dependencies.push(token);
      continue;
    }

    if (rangeParts.length !== 2) {
      throw new Error(`invalid dependency range: ${token}`);
    }

    const [rangeStart, rangeEnd] = rangeParts;
    const parsedStart = parseNumericTaskId(rangeStart);
    const parsedEnd = parseNumericTaskId(rangeEnd);

    if (
      !parsedStart ||
      !parsedEnd ||
      parsedStart.base !== parsedEnd.base ||
      parsedStart.number > parsedEnd.number
    ) {
      throw new Error(`invalid dependency range: ${token}`);
    }

    for (
      let current = parsedStart.number;
      current <= parsedEnd.number;
      current += 1
    ) {
      dependencies.push(
        `${parsedStart.base}${String(current).padStart(parsedStart.width, "0")}`,
      );
    }
  }

  return dependencies;
}

export function parseTaskCards(markdown) {
  const headingExpression = new RegExp(
    `^### (?<id>${TASK_ID_PATTERN})\\b[^\\r\\n]*$`,
    "gm",
  );
  const headings = [...markdown.matchAll(headingExpression)];

  return headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? markdown.length;
    const raw = markdown.slice(start, end);
    const line = markdown.slice(0, start).split("\n").length;
    const fields = Object.fromEntries(
      REQUIRED_FIELDS.map((fieldName) => [
        fieldName,
        fieldOccurrences(raw, fieldName),
      ]),
    );
    const operationalDependencies = fieldOccurrences(
      raw,
      "Dipendenze operative aggiuntive",
    );

    return {
      id: heading.groups.id,
      line,
      raw,
      fields,
      operationalDependencies,
    };
  });
}

function dependencyIds(card, errors) {
  const expressions = [
    ...(card.fields.Dipendenze ?? []),
    ...card.operationalDependencies,
  ];
  const dependencies = [];

  for (const expression of expressions) {
    try {
      dependencies.push(...expandDependencyExpression(expression));
    } catch (error) {
      errors.push(
        `${card.id}:${card.line} invalid-dependency: ${error.message}`,
      );
    }
  }

  return [...new Set(dependencies)];
}

function findTaskCycle(graph) {
  const visited = new Set();
  const active = new Set();
  const stack = [];

  function visit(taskId) {
    if (active.has(taskId)) {
      return [...stack.slice(stack.indexOf(taskId)), taskId];
    }

    if (visited.has(taskId)) {
      return null;
    }

    visited.add(taskId);
    active.add(taskId);
    stack.push(taskId);

    for (const dependency of graph.get(taskId) ?? []) {
      const cycle = visit(dependency);

      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    active.delete(taskId);
    return null;
  }

  for (const taskId of graph.keys()) {
    const cycle = visit(taskId);

    if (cycle) {
      return cycle;
    }
  }

  return null;
}

function unquote(value) {
  return value?.replaceAll("`", "").trim();
}

export function validateTaskGraph(markdown) {
  const cards = parseTaskCards(markdown);
  const errors = [];
  const cardsById = new Map();

  for (const card of cards) {
    if (cardsById.has(card.id)) {
      errors.push(`${card.id}:${card.line} duplicate-task-id`);
    }

    cardsById.set(card.id, card);

    for (const [fieldName, occurrences] of Object.entries(card.fields)) {
      if (occurrences.length !== 1) {
        errors.push(
          `${card.id}:${card.line} field-count ${fieldName}=${occurrences.length}`,
        );
      }
    }

    if (card.operationalDependencies.length > 1) {
      errors.push(
        `${card.id}:${card.line} field-count Dipendenze operative aggiuntive=${card.operationalDependencies.length}`,
      );
    }
  }

  const graph = new Map();

  for (const card of cards) {
    const dependencies = dependencyIds(card, errors);
    graph.set(card.id, dependencies);

    for (const dependency of dependencies) {
      if (!cardsById.has(dependency)) {
        errors.push(
          `${card.id}:${card.line} unknown-dependency: ${dependency}`,
        );
      }

      if (dependency === card.id) {
        errors.push(`${card.id}:${card.line} self-dependency`);
      }
    }
  }

  const cycle = findTaskCycle(graph);

  if (cycle) {
    errors.push(`dependency-cycle: ${cycle.join(" -> ")}`);
  }

  const activeTasks = [];

  for (const card of cards) {
    const status = unquote(card.fields.Stato?.[0]);
    const progress = unquote(card.fields.Progresso?.[0]);
    const testStatus = unquote(card.fields["Esito test"]?.[0]);
    const contextVerified =
      card.fields["Contesto verificato"]?.[0]?.match(/`(YES|NO)`/)?.[1];

    if (status === "IN_PROGRESS") {
      activeTasks.push(card.id);

      if (contextVerified !== "YES") {
        errors.push(`${card.id}:${card.line} in-progress-context-not-verified`);
      }
    }

    if (status === "DONE") {
      if (
        progress !== "100%" ||
        testStatus !== "PASSING" ||
        contextVerified !== "YES"
      ) {
        errors.push(`${card.id}:${card.line} invalid-done-state`);
      }
    }

    if (status === "READY") {
      const incompleteDependencies = (graph.get(card.id) ?? []).filter(
        (dependency) =>
          unquote(cardsById.get(dependency)?.fields.Stato?.[0]) !== "DONE",
      );

      if (incompleteDependencies.length > 0) {
        errors.push(
          `${card.id}:${card.line} ready-with-incomplete-dependencies: ${incompleteDependencies.join(", ")}`,
        );
      }
    }

    if (card.id.startsWith("BL-") && UX_TASK_SIGNAL.test(card.raw)) {
      const references = card.fields["Riferimenti obbligatori"]?.[0] ?? "";

      if (!references.includes(UX_REFERENCE)) {
        errors.push(`${card.id}:${card.line} missing-ux-design-reference`);
      }

      if (!references.includes(UX_ADR_REFERENCE)) {
        errors.push(`${card.id}:${card.line} missing-ux-adr-reference`);
      }

      if (
        card.id !== "BL-079" &&
        !(graph.get(card.id) ?? []).includes("BL-079")
      ) {
        errors.push(`${card.id}:${card.line} missing-bl-079-dependency`);
      }
    }
  }

  if (activeTasks.length > 1) {
    errors.push(`multiple-in-progress-tasks: ${activeTasks.join(", ")}`);
  }

  return [...new Set(errors)].sort();
}

function parseSpecBacklog(specMarkdown) {
  const rows = new Map();

  for (const line of specMarkdown.split("\n")) {
    if (!/^\| BL-\d{3} \|/.test(line)) {
      continue;
    }

    const cells = line.split("|").map((cell) => cell.trim());
    rows.set(cells[1], cells[6]);
  }

  return rows;
}

export function validateTaskSpecParity(taskMarkdown, specMarkdown) {
  const errors = [];
  const cards = parseTaskCards(taskMarkdown).filter(({ id }) =>
    id.startsWith("BL-"),
  );
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const specRows = parseSpecBacklog(specMarkdown);

  for (const card of cards) {
    if (!specRows.has(card.id)) {
      errors.push(`${card.id}:${card.line} missing-spec-backlog-row`);
      continue;
    }

    const taskDependencies = expandDependencyExpression(
      card.fields.Dipendenze?.[0] ?? "—",
    ).sort();
    const specDependencies = expandDependencyExpression(
      specRows.get(card.id),
    ).sort();

    if (taskDependencies.join("|") !== specDependencies.join("|")) {
      errors.push(`${card.id}:${card.line} spec-dependency-mismatch`);
    }

    const references = card.fields["Riferimenti obbligatori"]?.[0] ?? "";

    if (!references.includes(`§31 \`${card.id}\``)) {
      errors.push(`${card.id}:${card.line} missing-self-spec-reference`);
    }
  }

  for (const taskId of specRows.keys()) {
    if (!cardsById.has(taskId)) {
      errors.push(`${taskId} missing-task-card`);
    }
  }

  return errors.sort();
}

export function validateTaskDocuments(taskMarkdown, specMarkdown) {
  return [
    ...validateTaskGraph(taskMarkdown),
    ...validateTaskSpecParity(taskMarkdown, specMarkdown),
  ].sort();
}
