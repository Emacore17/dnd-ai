import { z } from "zod";

import { CONTRACT_CATALOG, type ContractCatalogEntry } from "./catalog.js";
import { createIdentityOpenApiPaths } from "./operations.js";
import {
  CONTRACT_ID_NAMESPACE,
  CONTRACT_MAJOR_VERSION,
  CONTRACT_VERSION,
  JSON_SCHEMA_DIALECT,
  OPENAPI_SCHEMA_DIALECT,
  OPENAPI_VERSION,
} from "./version.js";

const CONTRACT_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/u;
// The bounded character classes contain no ambiguous backtracking path.
// eslint-disable-next-line security/detect-unsafe-regex
const CONTRACT_FILE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.schema\.json$/u;
const ALLOWED_KINDS = new Set(["request", "response", "event", "ai_output"]);

type JsonRecord = Record<string, unknown>;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function validateCatalog(catalog: readonly ContractCatalogEntry[]): void {
  const names = new Set<string>();
  const fileNames = new Set<string>();

  for (const entry of catalog) {
    if (!CONTRACT_NAME_PATTERN.test(entry.name)) {
      throw new Error(`invalid contract name: ${entry.name}`);
    }

    if (!CONTRACT_FILE_PATTERN.test(entry.fileName)) {
      throw new Error(`invalid contract filename: ${entry.fileName}`);
    }

    if (!ALLOWED_KINDS.has(entry.kind)) {
      throw new Error(`invalid contract kind: ${entry.kind}`);
    }

    if (names.has(entry.name)) {
      throw new Error(`duplicate contract name: ${entry.name}`);
    }

    if (fileNames.has(entry.fileName)) {
      throw new Error(`duplicate contract filename: ${entry.fileName}`);
    }

    names.add(entry.name);
    fileNames.add(entry.fileName);
  }
}

function createJsonSchema(entry: ContractCatalogEntry): JsonRecord {
  const generated = z.toJSONSchema(entry.schema, {
    target: "draft-2020-12",
    io: "input",
    cycles: "ref",
    reused: "ref",
    unrepresentable: "throw",
  });

  return {
    ...generated,
    $id: `${CONTRACT_ID_NAMESPACE}:${entry.name}`,
    $schema: JSON_SCHEMA_DIALECT,
    title: entry.name,
    "x-dnd-ai-contract-kind": entry.kind,
    "x-dnd-ai-contract-version": CONTRACT_VERSION,
  };
}

function rebaseOpenApiReferences(
  value: unknown,
  componentRoot: string,
): unknown {
  if (Array.isArray(value)) {
    return value.map((child) => rebaseOpenApiReferences(child, componentRoot));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (
        key === "$ref" &&
        typeof child === "string" &&
        child.startsWith("#")
      ) {
        return [key, `${componentRoot}${child.slice(1)}`];
      }

      return [key, rebaseOpenApiReferences(child, componentRoot)];
    }),
  );
}

function rebaseOpenApiRecord(
  value: JsonRecord,
  componentRoot: string,
): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      rebaseOpenApiReferences(child, componentRoot),
    ]),
  );
}

function createOpenApiComponent(
  contractName: string,
  schema: JsonRecord,
): JsonRecord {
  const component = rebaseOpenApiRecord(
    schema,
    `#/components/schemas/${contractName}`,
  );

  Reflect.deleteProperty(component, "$id");
  Reflect.deleteProperty(component, "$schema");
  return component;
}

export function createContractArtifacts(
  catalog: readonly ContractCatalogEntry[] = CONTRACT_CATALOG,
): Readonly<Record<string, unknown>> {
  validateCatalog(catalog);

  const generatedSchemas = catalog.map((entry) => ({
    entry,
    schema: createJsonSchema(entry),
  }));
  const manifest = {
    schemaVersion: "contract-artifact-manifest-v1",
    contractVersion: CONTRACT_VERSION,
    jsonSchemaDialect: JSON_SCHEMA_DIALECT,
    openapi: "openapi.json",
    schemas: generatedSchemas.map(({ entry, schema }) => ({
      name: entry.name,
      kind: entry.kind,
      file: `schemas/${entry.fileName}`,
      id: schema.$id,
    })),
  };
  const componentSchemas = Object.fromEntries(
    generatedSchemas.map(({ entry, schema }) => [
      entry.name,
      createOpenApiComponent(entry.name, schema),
    ]),
  );
  const openapi = {
    openapi: OPENAPI_VERSION,
    jsonSchemaDialect: OPENAPI_SCHEMA_DIALECT,
    info: {
      title: "AI Adventure API Contracts",
      version: CONTRACT_VERSION,
      description:
        "Contratti versionati e operazioni identity implementate dal task proprietario BL-005.",
    },
    paths: createIdentityOpenApiPaths(),
    components: { schemas: componentSchemas },
    "x-dnd-ai-contract-version": CONTRACT_VERSION,
  };
  const artifacts: Record<string, unknown> = {
    [`${CONTRACT_MAJOR_VERSION}/manifest.json`]: manifest,
    [`${CONTRACT_MAJOR_VERSION}/openapi.json`]: openapi,
  };

  for (const { entry, schema } of generatedSchemas) {
    artifacts[`${CONTRACT_MAJOR_VERSION}/schemas/${entry.fileName}`] = schema;
  }

  return deepFreeze(artifacts);
}
