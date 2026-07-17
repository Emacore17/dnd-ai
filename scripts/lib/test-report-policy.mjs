import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { assertOwnedPathChain } from "./owned-path-policy.mjs";
import { scanSecretBuffer } from "./secret-scanner.mjs";
import { TEST_LANES, resolveTestLane } from "./test-lane-policy.mjs";

const REPORT_SCHEMA_VERSION = "testing-foundation-v1";
const MAX_REPORT_BYTES = 5 * 1024 * 1024;
const JUNIT_FILE_NAME = "junit.xml";
const COVERAGE_FILE_NAME = "coverage.lcov";
const LCOV_PREFIXES = Object.freeze([
  "BRDA:",
  "BRF:",
  "BRH:",
  "DA:",
  "FN:",
  "FNDA:",
  "FNF:",
  "FNH:",
  "LF:",
  "LH:",
  "SF:",
  "TN:",
]);

function fail(reason) {
  throw new Error(`test-report: ${reason}`);
}

function assertBoundedText(source, kind) {
  if (
    typeof source !== "string" ||
    source.length === 0 ||
    Buffer.byteLength(source) > MAX_REPORT_BYTES ||
    source.includes("\0")
  ) {
    fail(`invalid-${kind}`);
  }
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function encodeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function readXmlAttribute(openingTag, name) {
  const marker = `${name}="`;
  const start = openingTag.indexOf(marker);

  if (start === -1) {
    return null;
  }

  const valueStart = start + marker.length;
  const valueEnd = openingTag.indexOf('"', valueStart);
  if (valueEnd === -1) {
    fail("invalid-junit");
  }

  return decodeXml(openingTag.slice(valueStart, valueEnd));
}

function hasCredentialAuthority(value) {
  const lowered = value.toLowerCase();

  for (const scheme of ["http", "https", "postgres", "postgresql", "redis"]) {
    const marker = `${scheme}://`;
    const markerIndex = lowered.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const authorityStart = markerIndex + marker.length;
    const authorityEndCandidates = ["/", "?", "#"]
      .map((separator) => lowered.indexOf(separator, authorityStart))
      .filter((index) => index !== -1);
    const authorityEnd =
      authorityEndCandidates.length === 0
        ? lowered.length
        : Math.min(...authorityEndCandidates);
    const authority = lowered.slice(authorityStart, authorityEnd);
    const atIndex = authority.lastIndexOf("@");

    if (atIndex > 0 && authority.slice(0, atIndex).includes(":")) {
      return true;
    }
  }

  return false;
}

function assertNoSensitiveContent(content, filePath) {
  const lowered = content.toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) {
    fail("remote-content");
  }
  if (
    hasCredentialAuthority(content) ||
    scanSecretBuffer(Buffer.from(content, "utf8"), filePath).length > 0
  ) {
    fail("sensitive-content");
  }
}

function isTaskCharacter(character) {
  return character >= "A" && character <= "Z";
}

function parseExplicitTestId(name) {
  const separator = name.indexOf(":");
  if (separator === -1) {
    return null;
  }

  const candidate = name.slice(0, separator);
  const dash = candidate.indexOf("-");
  if (dash < 2 || dash > 8 || candidate.length !== dash + 4) {
    return null;
  }

  for (const character of candidate.slice(0, dash)) {
    if (!isTaskCharacter(character)) {
      return null;
    }
  }

  for (const character of candidate.slice(dash + 1)) {
    if (character < "0" || character > "9") {
      return null;
    }
  }

  const slug = name.slice(separator + 1);
  if (
    slug.length === 0 ||
    slug.startsWith("-") ||
    slug.endsWith("-") ||
    slug.includes("--")
  ) {
    fail("invalid-test-id");
  }

  for (const character of slug) {
    const isLowercase = character >= "a" && character <= "z";
    const isDigit = character >= "0" && character <= "9";
    if (!isLowercase && !isDigit && character !== "-") {
      fail("invalid-test-id");
    }
  }

  return Object.freeze({ id: name, taskId: candidate });
}

function parseJUnit(source, { knownTaskIds, lane }) {
  assertBoundedText(source, "junit");
  if (
    !Array.isArray(knownTaskIds) ||
    knownTaskIds.some((taskId) => typeof taskId !== "string") ||
    typeof lane !== "string" ||
    !source.includes("<testsuites") ||
    !source.includes("</testsuites>")
  ) {
    fail("invalid-junit");
  }

  const cases = [];
  const explicitIds = new Set();
  let cursor = 0;

  while (true) {
    const start = source.indexOf("<testcase ", cursor);
    if (start === -1) {
      break;
    }

    const openingEnd = source.indexOf(">", start);
    if (openingEnd === -1) {
      fail("invalid-junit");
    }

    const openingTag = source.slice(start, openingEnd + 1);
    const selfClosing = openingTag.endsWith("/>");
    let block = openingTag;
    if (!selfClosing) {
      const closingStart = source.indexOf("</testcase>", openingEnd + 1);
      const nextTestcase = source.indexOf("<testcase ", openingEnd + 1);
      const suitesClose = source.indexOf("</testsuites>", openingEnd + 1);
      if (
        closingStart === -1 ||
        (nextTestcase !== -1 && nextTestcase < closingStart) ||
        (suitesClose !== -1 && suitesClose < closingStart)
      ) {
        fail("invalid-junit");
      }

      block = source.slice(start, closingStart + "</testcase>".length);
      cursor = closingStart + "</testcase>".length;
    } else {
      cursor = openingEnd + 1;
    }

    const name = readXmlAttribute(openingTag, "name");
    if (name === null || name.length === 0 || name.length > 512) {
      fail("invalid-junit");
    }

    const explicit = parseExplicitTestId(name);
    if (explicit !== null) {
      if (!knownTaskIds.includes(explicit.taskId)) {
        fail("unknown-task-id");
      }
      if (explicitIds.has(explicit.id)) {
        fail("duplicate-test-id");
      }
      explicitIds.add(explicit.id);
    }

    const failed =
      readXmlAttribute(openingTag, "failure") !== null ||
      block.includes("<failure");
    const skipped =
      !failed &&
      (readXmlAttribute(openingTag, "skipped") !== null ||
        block.includes("<skipped"));
    cases.push(Object.freeze({ failed, name, skipped }));
  }

  if (cases.length === 0) {
    fail("invalid-junit");
  }

  return Object.freeze(
    cases.sort((left, right) => left.name.localeCompare(right.name)),
  );
}

function renderJUnit(cases, lane) {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<testsuites lane="${encodeXml(lane)}">`,
  ];

  for (const testCase of cases) {
    const opening = `  <testcase name="${encodeXml(testCase.name)}" time="0" classname="${encodeXml(lane)}"`;
    if (testCase.failed) {
      lines.push(`${opening}>`);
      lines.push('    <failure message="test failed"/>');
      lines.push("  </testcase>");
    } else if (testCase.skipped) {
      lines.push(`${opening}>`);
      lines.push("    <skipped/>");
      lines.push("  </testcase>");
    } else {
      lines.push(`${opening}/>`);
    }
  }

  lines.push("</testsuites>");
  return `${lines.join("\n")}\n`;
}

export function normalizeJUnitReport(source, options) {
  const cases = parseJUnit(source, options);
  const normalized = renderJUnit(cases, options.lane);
  assertNoSensitiveContent(normalized, JUNIT_FILE_NAME);
  return normalized;
}

function normalizeSourcePath(sourcePath, repositoryRoot) {
  if (sourcePath.length === 0 || sourcePath.includes("\0")) {
    fail("invalid-lcov-path");
  }

  const normalizedInput = sourcePath.replaceAll("\\", "/");
  const absolutePath = path.isAbsolute(sourcePath)
    ? path.resolve(sourcePath)
    : path.resolve(repositoryRoot, ...normalizedInput.split("/"));
  const relativePath = path.relative(
    path.resolve(repositoryRoot),
    absolutePath,
  );
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    fail("invalid-lcov-path");
  }

  const portablePath = relativePath.replaceAll(path.sep, "/");
  if (!portablePath.startsWith("packages/testing/dist/")) {
    fail("invalid-lcov-path");
  }

  return portablePath;
}

function lcovLineRank(line) {
  const order = [
    "TN:",
    "SF:",
    "FN:",
    "FNDA:",
    "FNF:",
    "FNH:",
    "BRDA:",
    "BRF:",
    "BRH:",
    "DA:",
    "LF:",
    "LH:",
  ];
  return order.findIndex((prefix) => line.startsWith(prefix));
}

function compareLcovLines(left, right) {
  const rankDifference = lcovLineRank(left) - lcovLineRank(right);
  if (rankDifference !== 0) {
    return rankDifference;
  }

  const leftPrefixEnd = left.indexOf(":") + 1;
  const rightPrefixEnd = right.indexOf(":") + 1;
  const leftValue = left.slice(leftPrefixEnd);
  const rightValue = right.slice(rightPrefixEnd);
  const leftNumber = Number.parseInt(leftValue.split(",", 1)[0], 10);
  const rightNumber = Number.parseInt(rightValue.split(",", 1)[0], 10);
  if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) {
    return leftNumber - rightNumber || left.localeCompare(right);
  }

  return left.localeCompare(right);
}

export function normalizeLcovReport(source, { repositoryRoot }) {
  assertBoundedText(source, "lcov");
  if (typeof repositoryRoot !== "string" || repositoryRoot.length === 0) {
    fail("invalid-lcov");
  }

  const records = [];
  let current = [];
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    if (line === "end_of_record") {
      if (current.length === 0) {
        fail("invalid-lcov");
      }
      records.push(current);
      current = [];
      continue;
    }
    if (!LCOV_PREFIXES.some((prefix) => line.startsWith(prefix))) {
      fail("invalid-lcov");
    }
    current.push(line);
  }
  if (current.length > 0 || records.length === 0) {
    fail("invalid-lcov");
  }

  const normalizedRecords = records.map((record) => {
    const sourceLines = record.filter((line) => line.startsWith("SF:"));
    if (sourceLines.length !== 1) {
      fail("invalid-lcov");
    }

    const normalizedPath = normalizeSourcePath(
      sourceLines[0].slice("SF:".length),
      repositoryRoot,
    );
    const lines = record
      .filter((line) => !line.startsWith("SF:"))
      .concat(`SF:${normalizedPath}`)
      .sort(compareLcovLines);
    return Object.freeze({ lines, sourcePath: normalizedPath });
  });
  normalizedRecords.sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath),
  );

  const normalized = `${normalizedRecords
    .flatMap((record) => [...record.lines, "end_of_record"])
    .join("\n")}\n`;
  assertNoSensitiveContent(normalized, COVERAGE_FILE_NAME);
  return normalized;
}

function validateOptions({ commit, repositoryRoot, requiredLanes }) {
  if (
    typeof repositoryRoot !== "string" ||
    repositoryRoot.length === 0 ||
    typeof commit !== "string" ||
    commit.length !== 40 ||
    [...commit].some(
      (character) =>
        !(
          (character >= "0" && character <= "9") ||
          (character >= "a" && character <= "f")
        ),
    ) ||
    !Array.isArray(requiredLanes) ||
    requiredLanes.length === 0 ||
    new Set(requiredLanes).size !== requiredLanes.length
  ) {
    fail("invalid-options");
  }

  for (const lane of requiredLanes) {
    resolveTestLane(lane);
  }

  const lanes = Object.keys(TEST_LANES).filter((lane) =>
    requiredLanes.includes(lane),
  );
  return Object.freeze({
    commit,
    lanes,
    repositoryRoot: path.resolve(repositoryRoot),
  });
}

async function readRegularOwnedFile(repositoryRoot, filePath) {
  await assertOwnedPathChain(repositoryRoot, filePath, {
    allowMissing: false,
    finalType: "file",
  });
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_REPORT_BYTES) {
    fail("invalid-report-file");
  }

  return readFile(filePath, "utf8");
}

function countCases(junit, lane, knownTaskIds) {
  const cases = parseJUnit(junit, { knownTaskIds, lane });
  return Object.freeze({
    failed: cases.filter((testCase) => testCase.failed).length,
    passed: cases.filter((testCase) => !testCase.failed && !testCase.skipped)
      .length,
    skipped: cases.filter((testCase) => testCase.skipped).length,
    total: cases.length,
  });
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function aggregateTests(counts) {
  return Object.freeze(
    counts.reduce(
      (total, current) => ({
        failed: total.failed + current.failed,
        passed: total.passed + current.passed,
        skipped: total.skipped + current.skipped,
        total: total.total + current.total,
      }),
      { failed: 0, passed: 0, skipped: 0, total: 0 },
    ),
  );
}

async function collectPreparedReports(options) {
  const taskIds = [
    ...new Set(
      options.lanes.flatMap((lane) => resolveTestLane(lane).ownerTaskIds),
    ),
  ].sort();
  const files = [];
  const counts = [];

  for (const lane of options.lanes) {
    const sourceDirectory = path.join(
      options.repositoryRoot,
      "test-results",
      REPORT_SCHEMA_VERSION,
      lane,
    );
    const junitSource = await readRegularOwnedFile(
      options.repositoryRoot,
      path.join(sourceDirectory, JUNIT_FILE_NAME),
    );
    const junit = normalizeJUnitReport(junitSource, {
      knownTaskIds: taskIds,
      lane,
    });
    counts.push(countCases(junit, lane, taskIds));
    files.push({ content: junit, path: `${lane}/${JUNIT_FILE_NAME}` });

    if (lane === "unit") {
      const coverageSource = await readRegularOwnedFile(
        options.repositoryRoot,
        path.join(sourceDirectory, COVERAGE_FILE_NAME),
      );
      files.push({
        content: normalizeLcovReport(coverageSource, {
          repositoryRoot: options.repositoryRoot,
        }),
        path: `${lane}/${COVERAGE_FILE_NAME}`,
      });
    }
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({ counts, files, taskIds });
}

export async function prepareTestReportArtifact(rawOptions) {
  const options = validateOptions(rawOptions);
  const artifactDirectory = path.join(
    options.repositoryRoot,
    "artifacts",
    "testing",
  );
  await assertOwnedPathChain(options.repositoryRoot, artifactDirectory);
  const prepared = await collectPreparedReports(options);

  await rm(artifactDirectory, { force: true, recursive: true });
  await mkdir(artifactDirectory, { recursive: true });
  await assertOwnedPathChain(options.repositoryRoot, artifactDirectory, {
    allowMissing: false,
  });

  const manifestFiles = [];
  for (const file of prepared.files) {
    const destination = path.join(artifactDirectory, ...file.path.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, "utf8");
    manifestFiles.push(
      Object.freeze({
        bytes: Buffer.byteLength(file.content),
        path: file.path,
        sha256: hash(file.content),
      }),
    );
  }

  const manifest = Object.freeze({
    commit: options.commit,
    files: Object.freeze(manifestFiles),
    lanes: Object.freeze([...options.lanes]),
    schemaVersion: REPORT_SCHEMA_VERSION,
    taskIds: Object.freeze(prepared.taskIds),
    tests: aggregateTests(prepared.counts),
  });
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  assertNoSensitiveContent(serialized, "manifest.json");
  await writeFile(
    path.join(artifactDirectory, "manifest.json"),
    serialized,
    "utf8",
  );
  return manifest;
}

async function listArtifactFiles(directory, relativeDirectory = "") {
  const entries = await readdir(path.join(directory, relativeDirectory), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const relativePath = path
      .join(relativeDirectory, entry.name)
      .replaceAll(path.sep, "/");
    if (entry.isSymbolicLink()) {
      fail("invalid-artifact-link");
    }
    if (entry.isDirectory()) {
      files.push(...(await listArtifactFiles(directory, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      fail("invalid-artifact-entry");
    }
  }
  return files.sort();
}

export async function verifyTestReportArtifact(rawOptions) {
  const options = validateOptions(rawOptions);
  const artifactDirectory = path.join(
    options.repositoryRoot,
    "artifacts",
    "testing",
  );
  await assertOwnedPathChain(options.repositoryRoot, artifactDirectory, {
    allowMissing: false,
  });
  const errors = [];
  let manifest;

  try {
    const serialized = await readRegularOwnedFile(
      options.repositoryRoot,
      path.join(artifactDirectory, "manifest.json"),
    );
    assertNoSensitiveContent(serialized, "manifest.json");
    manifest = JSON.parse(serialized);
  } catch {
    return Object.freeze(["test-report: invalid-manifest"]);
  }

  if (
    manifest.schemaVersion !== REPORT_SCHEMA_VERSION ||
    manifest.commit !== options.commit ||
    JSON.stringify(manifest.lanes) !== JSON.stringify(options.lanes) ||
    !Array.isArray(manifest.files) ||
    !Array.isArray(manifest.taskIds)
  ) {
    errors.push("test-report: manifest-mismatch");
  }

  const expectedPaths = [
    "manifest.json",
    ...(Array.isArray(manifest.files)
      ? manifest.files.map((file) => file.path)
      : []),
  ].sort();
  const actualPaths = await listArtifactFiles(artifactDirectory);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    errors.push("test-report: artifact-file-set-mismatch");
  }

  if (Array.isArray(manifest.files)) {
    for (const file of manifest.files) {
      try {
        if (
          typeof file.path !== "string" ||
          file.path.includes("..") ||
          path.isAbsolute(file.path)
        ) {
          fail("invalid-artifact-path");
        }
        const content = await readRegularOwnedFile(
          options.repositoryRoot,
          path.join(artifactDirectory, ...file.path.split("/")),
        );
        assertNoSensitiveContent(content, file.path);
        if (
          Buffer.byteLength(content) !== file.bytes ||
          hash(content) !== file.sha256
        ) {
          errors.push(`test-report: checksum-mismatch:${file.path}`);
        }
      } catch {
        errors.push(`test-report: invalid-artifact-file:${file.path}`);
      }
    }
  }

  return Object.freeze([...new Set(errors)].sort());
}
