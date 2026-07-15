import { readdir, readFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  CONTRACT_VERSION,
  createContractArtifacts,
} from "../packages/contracts/dist/index.js";
import {
  compareContractArtifactFiles,
  normalizeContractArtifactPath,
  renderContractArtifactFiles,
} from "./lib/contract-artifact-policy.mjs";
import {
  compareContractCompatibilityBaseline,
  readContractArtifactsAtCommit,
  resolveContractCompatibilityBase,
} from "./lib/contract-compatibility-policy.mjs";
import { assertOwnedPathChain } from "./lib/owned-path-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const generatedRoot = path.join(
  repositoryRoot,
  "packages",
  "contracts",
  "generated",
);
const contractsRoot = path.dirname(generatedRoot);
const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

function resolveOwnedArtifactPath(relativePath) {
  const safePath = normalizeContractArtifactPath(relativePath);
  const absolutePath = path.resolve(generatedRoot, ...safePath.split("/"));
  const relativeToRoot = path.relative(generatedRoot, absolutePath);

  if (
    relativeToRoot === "" ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    throw new Error(`generated artifact escapes owned root: ${safePath}`);
  }

  return absolutePath;
}

async function collectObservedFiles(directory = generatedRoot, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    },
  );
  const files = new Map();

  if (entries.length > 0) {
    await assertOwnedPathChain(repositoryRoot, directory, {
      allowMissing: false,
    });
  }

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const relativePath = path.posix.join(prefix, entry.name);
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(
        `generated artifacts cannot contain symlinks: ${relativePath}`,
      );
    }

    if (entry.isDirectory()) {
      await assertOwnedPathChain(repositoryRoot, entryPath, {
        allowMissing: false,
      });
      for (const [childPath, content] of await collectObservedFiles(
        entryPath,
        relativePath,
      )) {
        files.set(childPath, content);
      }
      continue;
    }

    if (!entry.isFile()) {
      throw new Error(`unsupported generated artifact entry: ${relativePath}`);
    }

    const safePath = normalizeContractArtifactPath(relativePath);
    await assertOwnedPathChain(repositoryRoot, entryPath, {
      allowMissing: false,
      finalType: "file",
    });
    const content = await readFile(entryPath);

    if (content.byteLength > MAX_ARTIFACT_BYTES) {
      throw new Error(`generated artifact exceeds size limit: ${safePath}`);
    }

    files.set(safePath, content.toString("utf8"));
  }

  return files;
}

async function assertGeneratedRootIsOwned() {
  await assertOwnedPathChain(repositoryRoot, contractsRoot, {
    allowMissing: false,
  });
  await assertOwnedPathChain(repositoryRoot, generatedRoot);
}

async function writeExpectedFiles(expectedFiles, observedFiles) {
  await assertGeneratedRootIsOwned();

  for (const relativePath of observedFiles.keys()) {
    if (!expectedFiles.has(relativePath)) {
      const unexpectedPath = resolveOwnedArtifactPath(relativePath);
      await assertOwnedPathChain(repositoryRoot, unexpectedPath, {
        allowMissing: false,
        finalType: "file",
      });
      await rm(unexpectedPath, { force: true });
    }
  }

  for (const [relativePath, content] of expectedFiles) {
    const outputPath = resolveOwnedArtifactPath(relativePath);
    const outputDirectory = path.dirname(outputPath);

    await assertOwnedPathChain(repositoryRoot, outputDirectory);
    await mkdir(outputDirectory, { recursive: true });
    await assertOwnedPathChain(repositoryRoot, outputDirectory, {
      allowMissing: false,
    });
    await assertOwnedPathChain(repositoryRoot, outputPath, {
      finalType: "file",
    });
    await writeFile(outputPath, content, "utf8");
  }
}

function printFailure(errors) {
  console.error("contract-artifacts: FAIL");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

async function main() {
  const mode = process.argv[2];

  if (!["--write", "--check"].includes(mode) || process.argv.length !== 3) {
    console.error("usage: node scripts/generate-contracts.mjs --write|--check");
    process.exitCode = 1;
    return;
  }

  const expectedFiles = renderContractArtifactFiles(createContractArtifacts());
  const compatibilityBase = await resolveContractCompatibilityBase(
    repositoryRoot,
    process.env.CONTRACT_BASE_REF,
  );
  const publishedFiles = await readContractArtifactsAtCommit(
    repositoryRoot,
    compatibilityBase,
  );
  const compatibilityErrors = compareContractCompatibilityBaseline(
    publishedFiles,
    expectedFiles,
  );

  if (compatibilityErrors.length > 0) {
    printFailure(compatibilityErrors);
    process.exitCode = 1;
    return;
  }

  await assertGeneratedRootIsOwned();
  let observedFiles = await collectObservedFiles();

  if (mode === "--write") {
    await writeExpectedFiles(expectedFiles, observedFiles);
    await assertGeneratedRootIsOwned();
    observedFiles = await collectObservedFiles();
  }

  const errors = compareContractArtifactFiles(expectedFiles, observedFiles);

  if (errors.length > 0) {
    printFailure(errors);
    process.exitCode = 1;
    return;
  }

  const action = mode === "--write" ? "WROTE" : "PASS";
  console.log(
    `contract-artifacts: ${action} (${expectedFiles.size} files, api-contract-v${CONTRACT_VERSION})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
