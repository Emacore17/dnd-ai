import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export const WORKSPACE_POLICY = Object.freeze({
  "@dnd-ai/config": [],
  "@dnd-ai/contracts": [],
  "@dnd-ai/domain": [],
  "@dnd-ai/rules": ["@dnd-ai/domain"],
  "@dnd-ai/ai": ["@dnd-ai/contracts", "@dnd-ai/domain"],
  "@dnd-ai/persistence": ["@dnd-ai/contracts", "@dnd-ai/domain"],
  "@dnd-ai/observability": [],
  "@dnd-ai/testing": [
    "@dnd-ai/contracts",
    "@dnd-ai/domain",
    "@dnd-ai/rules",
    "@dnd-ai/ai",
    "@dnd-ai/persistence",
    "@dnd-ai/observability",
  ],
  "@dnd-ai/web": ["@dnd-ai/contracts", "@dnd-ai/observability"],
  "@dnd-ai/api": [
    "@dnd-ai/config",
    "@dnd-ai/contracts",
    "@dnd-ai/domain",
    "@dnd-ai/rules",
    "@dnd-ai/ai",
    "@dnd-ai/persistence",
    "@dnd-ai/observability",
  ],
  "@dnd-ai/worker": [
    "@dnd-ai/config",
    "@dnd-ai/contracts",
    "@dnd-ai/domain",
    "@dnd-ai/rules",
    "@dnd-ai/ai",
    "@dnd-ai/persistence",
    "@dnd-ai/observability",
  ],
});

function isInside(parentDirectory, candidatePath) {
  const relativePath = path.relative(parentDirectory, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== "..")
  );
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    },
  );
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)));
    } else if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name))
    ) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectModuleSpecifiers(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

async function discoverPackage(packageDirectory, workspaceRoot) {
  const manifestPath = path.join(packageDirectory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const dependencies = DEPENDENCY_FIELDS.flatMap((field) =>
    Object.keys(manifest[field] ?? {}),
  );
  const sourceImports = [];

  for (const filePath of await listSourceFiles(
    path.join(packageDirectory, "src"),
  )) {
    const sourceText = await readFile(filePath, "utf8");

    for (const specifier of collectModuleSpecifiers(sourceText, filePath)) {
      sourceImports.push({
        file: path.relative(workspaceRoot, filePath).replaceAll(path.sep, "/"),
        specifier,
        escapesPackage:
          specifier.startsWith(".") &&
          !isInside(
            packageDirectory,
            path.resolve(path.dirname(filePath), specifier),
          ),
      });
    }
  }

  return {
    name: manifest.name,
    directory: path
      .relative(workspaceRoot, packageDirectory)
      .replaceAll(path.sep, "/"),
    dependencies,
    sourceImports,
  };
}

export async function discoverWorkspace(rootDirectory) {
  const packages = [];

  for (const parentName of ["apps", "packages"]) {
    const parentDirectory = path.join(rootDirectory, parentName);
    const entries = await readdir(parentDirectory, {
      withFileTypes: true,
    }).catch((error) => {
      if (error.code === "ENOENT") {
        return [];
      }

      throw error;
    });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      packages.push(
        await discoverPackage(
          path.join(parentDirectory, entry.name),
          rootDirectory,
        ),
      );
    }
  }

  return packages;
}

function workspaceTarget(specifier, workspaceNames) {
  return workspaceNames.find(
    (name) => specifier === name || specifier.startsWith(`${name}/`),
  );
}

function findCycle(graph) {
  const visited = new Set();
  const active = new Set();
  const pathStack = [];

  function visit(node) {
    if (active.has(node)) {
      const cycleStart = pathStack.indexOf(node);
      return [...pathStack.slice(cycleStart), node];
    }

    if (visited.has(node)) {
      return null;
    }

    visited.add(node);
    active.add(node);
    pathStack.push(node);

    for (const dependency of graph.get(node) ?? []) {
      const cycle = visit(dependency);

      if (cycle) {
        return cycle;
      }
    }

    pathStack.pop();
    active.delete(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = visit(node);

    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export function validateWorkspaceBoundaries(
  packages,
  policy = WORKSPACE_POLICY,
) {
  const errors = [];
  const packageNames = packages
    .map(({ name }) => name)
    .sort((left, right) => right.length - left.length);
  const packageNameSet = new Set(packageNames);
  const graph = new Map(packageNames.map((name) => [name, new Set()]));

  if (packageNameSet.size !== packageNames.length) {
    errors.push(
      "duplicate-package-name: workspace package names must be unique",
    );
  }

  for (const currentPackage of packages) {
    const allowedTargets = new Set(policy[currentPackage.name] ?? []);

    if (!(currentPackage.name in policy)) {
      errors.push(`missing-policy: ${currentPackage.name}`);
      continue;
    }

    const relationships = [
      ...currentPackage.dependencies.map((specifier) => ({
        kind: "dependency",
        specifier,
      })),
      ...currentPackage.sourceImports.map((sourceImport) => ({
        kind: "import",
        ...sourceImport,
      })),
    ];

    for (const relationship of relationships) {
      if (relationship.escapesPackage) {
        errors.push(
          `cross-package-relative-import: ${currentPackage.name} ${relationship.file} -> ${relationship.specifier}`,
        );
        continue;
      }

      const target = workspaceTarget(relationship.specifier, packageNames);

      if (!target) {
        continue;
      }

      graph.get(currentPackage.name)?.add(target);

      if (!allowedTargets.has(target)) {
        errors.push(
          `forbidden-${relationship.kind}: ${currentPackage.name} -> ${target}`,
        );
      }
    }
  }

  const cycle = findCycle(graph);

  if (cycle) {
    errors.push(`dependency-cycle: ${cycle.join(" -> ")}`);
  }

  return [...new Set(errors)].sort();
}
