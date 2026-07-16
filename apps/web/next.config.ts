import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: repositoryRoot,
  turbopack: { root: repositoryRoot },
} satisfies NextConfig;

export default nextConfig;
