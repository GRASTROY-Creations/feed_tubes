import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        browser: "readonly",
      },
    },
    plugins: {
      "no-unsanitized": noUnsanitized,
    },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
    },
  },
  eslintConfigPrettier,
];
