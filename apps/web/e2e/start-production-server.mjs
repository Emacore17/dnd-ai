import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(e2eDirectory, "..");
const standaloneWebDirectory = path.join(
  webDirectory,
  ".next",
  "standalone",
  "apps",
  "web",
);
const sourceStaticDirectory = path.join(webDirectory, ".next", "static");
const targetStaticDirectory = path.join(
  standaloneWebDirectory,
  ".next",
  "static",
);

await rm(targetStaticDirectory, { force: true, recursive: true });
await mkdir(path.dirname(targetStaticDirectory), { recursive: true });
await cp(sourceStaticDirectory, targetStaticDirectory, { recursive: true });

process.env.HOSTNAME ??= "127.0.0.1";
process.env.PORT ??= "3100";

createRequire(import.meta.url)(path.join(standaloneWebDirectory, "server.js"));
