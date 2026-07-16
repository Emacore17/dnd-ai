import process from "node:process";

import {
  RuntimeConfigurationError,
  parseApiRuntimeConfig,
  parseMigrationRuntimeConfig,
  parseWebRuntimeConfig,
  parseWorkerRuntimeConfig,
  type ConfigurationService,
  type RuntimeEnvironment,
} from "./runtime-config.js";

function isConfigurationService(value: string): value is ConfigurationService {
  return (
    value === "api" ||
    value === "migration" ||
    value === "web" ||
    value === "worker"
  );
}

function validateServiceConfiguration(
  service: ConfigurationService,
): RuntimeEnvironment {
  switch (service) {
    case "api":
      return parseApiRuntimeConfig(process.env).environment;
    case "migration":
      return parseMigrationRuntimeConfig(process.env).environment;
    case "web":
      return parseWebRuntimeConfig(process.env).environment;
    case "worker":
      return parseWorkerRuntimeConfig(process.env).environment;
  }
}

const service = process.argv[2] ?? "";

if (!isConfigurationService(service)) {
  process.stderr.write("Usage: runtime-config <api|migration|web|worker>\n");
  process.exitCode = 2;
} else {
  try {
    const environment = validateServiceConfiguration(service);
    process.stdout.write(
      `Runtime configuration valid: ${service} (${environment})\n`,
    );
  } catch (error) {
    const message =
      error instanceof RuntimeConfigurationError
        ? error.message
        : `Runtime configuration check failed for ${service}`;
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
