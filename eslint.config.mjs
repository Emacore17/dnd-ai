import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import typeScriptEslint from "typescript-eslint";

const scopedNextConfig = [...nextConfig, ...nextTypeScript]
  .filter((config) => !config.ignores)
  .map((config) => ({
    ...config,
    files: (config.files ?? ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"]).map(
      (pattern) => `apps/web/${pattern}`
    )
  }));

export default defineConfig([
  eslint.configs.recommended,
  ...typeScriptEslint.configs.recommended,
  ...scopedNextConfig,
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  },
  globalIgnores([
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "**/node_modules/**"
  ])
]);
