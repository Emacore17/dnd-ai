import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextConfig from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import pluginSecurity from "eslint-plugin-security";
import typeScriptEslint from "typescript-eslint";

const scopedNextConfig = [...nextConfig, ...nextTypeScript]
  .filter((config) => !config.ignores)
  .map((config) => ({
    ...config,
    files: (config.files ?? ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"]).map(
      (pattern) => `apps/web/${pattern}`,
    ),
  }));

const productionSecurityConfig = {
  ...pluginSecurity.configs.recommended,
  files: [
    "apps/**/*.{js,jsx,mjs,ts,tsx,mts,cts}",
    "packages/**/*.{js,jsx,mjs,ts,tsx,mts,cts}",
  ],
};

// CI scripts intentionally validate dynamic paths and keyed workflow data. Their
// dedicated boundary, artifact, policy and negative-path tests cover those sinks.
const scriptSecurityConfig = {
  name: "security/scripts",
  files: ["scripts/**/*.mjs"],
  plugins: pluginSecurity.configs.recommended.plugins,
  rules: Object.fromEntries(
    Object.entries(pluginSecurity.configs.recommended.rules).filter(
      ([ruleName]) =>
        ![
          "security/detect-non-literal-fs-filename",
          "security/detect-non-literal-regexp",
          "security/detect-object-injection",
        ].includes(ruleName),
    ),
  ),
};

export default defineConfig([
  eslint.configs.recommended,
  ...typeScriptEslint.configs.recommended,
  productionSecurityConfig,
  scriptSecurityConfig,
  ...scopedNextConfig,
  {
    files: ["apps/web/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    // This project uses the App Router and has no legacy pages directory.
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/dist/**",
    "**/next-env.d.ts",
    "**/node_modules/**",
  ]),
]);
