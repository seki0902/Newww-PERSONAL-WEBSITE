import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const eslintConfig = defineConfig([
  globalIgnores(["node_modules/**", "dist/**", "outputs/**", "test-results/**", "playwright-report/**"]),
  {
    files: ["src/**/*.{ts,tsx}", "tests/**/*.ts", "functions/**/*.ts", "*.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/**/*.{js,mjs}", "server/**/*.mjs", "tools/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/**/*.{ts,tsx}", "functions/**/*.ts"],
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" },
  },
]);

export default eslintConfig;
