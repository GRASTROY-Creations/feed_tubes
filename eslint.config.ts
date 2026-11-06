import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["build/**", "dist/**", "node_modules/**", "web-ext-config.mjs"],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "no-unsanitized": noUnsanitized,
    },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // Empty strings deliberately mean "missing" throughout the subscription model.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["tests/**/*.ts", "scripts/**/*.ts", "eslint.config.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  eslintConfigPrettier
);
