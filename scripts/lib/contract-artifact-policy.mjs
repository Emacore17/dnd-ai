import path from "node:path";

const GENERATED_ARTIFACT_PATTERN =
  // The bounded character classes contain no ambiguous backtracking path.
  // eslint-disable-next-line security/detect-unsafe-regex
  /^v[1-9][0-9]*\/(?:[a-z0-9][a-z0-9.-]*\/)*[a-z0-9][a-z0-9.-]*\.json$/u;

function jsonPath(parentPath, key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)
    ? `${parentPath}.${key}`
    : `${parentPath}[${JSON.stringify(key)}]`;
}

function canonicalizeJson(value, currentPath, activeObjects) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`non-finite number at ${currentPath}`);
    }

    return value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`non-JSON value at ${currentPath}`);
  }

  if (activeObjects.has(value)) {
    throw new TypeError(`cyclic JSON value at ${currentPath}`);
  }

  activeObjects.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((child, index) =>
        canonicalizeJson(child, `${currentPath}[${index}]`, activeObjects),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`non-JSON value at ${currentPath}`);
    }

    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalizeJson(
            value[key],
            jsonPath(currentPath, key),
            activeObjects,
          ),
        ]),
    );
  } finally {
    activeObjects.delete(value);
  }
}

export function renderCanonicalJson(value) {
  const canonical = canonicalizeJson(value, "$", new WeakSet());

  return `${JSON.stringify(canonical, null, 2)}\n`;
}

export function normalizeContractArtifactPath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    !GENERATED_ARTIFACT_PATTERN.test(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.includes("\\")
  ) {
    throw new Error(`invalid generated artifact path: ${String(relativePath)}`);
  }

  return relativePath;
}

function normalizeFileMap(files, label) {
  if (!(files instanceof Map)) {
    throw new TypeError(`${label} contract artifact files must be a Map`);
  }

  const normalized = new Map();

  for (const [relativePath, content] of files) {
    const safePath = normalizeContractArtifactPath(relativePath);

    if (typeof content !== "string") {
      throw new TypeError(
        `${label} artifact content must be text: ${safePath}`,
      );
    }

    normalized.set(safePath, content);
  }

  return normalized;
}

export function renderContractArtifactFiles(artifacts) {
  if (
    typeof artifacts !== "object" ||
    artifacts === null ||
    Array.isArray(artifacts)
  ) {
    throw new TypeError("contract artifacts must be an object");
  }

  return new Map(
    Object.entries(artifacts)
      .map(([relativePath, value]) => [
        normalizeContractArtifactPath(relativePath),
        renderCanonicalJson(value),
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function compareContractArtifactFiles(expectedFiles, observedFiles) {
  const expected = normalizeFileMap(expectedFiles, "expected");
  const observed = normalizeFileMap(observedFiles, "observed");
  const errors = [];

  for (const relativePath of [...expected.keys()].sort()) {
    if (!observed.has(relativePath)) {
      errors.push(`missing: ${relativePath}`);
    }
  }

  for (const relativePath of [...expected.keys()].sort()) {
    if (
      observed.has(relativePath) &&
      observed.get(relativePath) !== expected.get(relativePath)
    ) {
      errors.push(`stale: ${relativePath}`);
    }
  }

  for (const relativePath of [...observed.keys()].sort()) {
    if (!expected.has(relativePath)) {
      errors.push(`unexpected: ${relativePath}`);
    }
  }

  return errors;
}
