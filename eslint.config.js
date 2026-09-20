import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    // A disable directive that suppresses nothing is stale and should fail CI.
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript ESLint rules
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-deprecated": "error",

      // General ESLint rules
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // Production sources log through the structured logger in src/utils.
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    // Only the Zod-backed configs may read the environment.
    files: ["src/**/*.ts"],
    ignores: ["src/configs/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read environment variables through the Zod-backed configs in src/configs/ instead of process.env.",
        },
      ],
    },
  },
  {
    // The LLM service is wired by its composition root only: the
    // announcements-notify worker startup. Production modules must not import
    // its values or types.
    files: ["src/**/*.ts"],
    ignores: [
      "src/api/services/llm/**",
      "src/workers/announcements/notify/startup.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/api/services/llm", "**/api/services/llm/**"],
              message:
                "Import the LLM service only in src/workers/announcements/notify/startup.ts and inject it; other production modules must not import its values or types.",
            },
          ],
        },
      ],
    },
  },
  {
    // Test doubles routinely return promises without awaiting, and the
    // node:test runner tracks top-level test() promises itself.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "*.js",
      "drizzle.config.ts",
      "scripts/**",
    ],
  }
);
