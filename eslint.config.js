import js from "@eslint/js";
import globals from "globals";

/**
 * Configuration ESLint (flat config) — PersonaDLE.
 *
 * Objectif : attraper les vraies erreurs (variables non définies, code mort,
 * fautes de frappe) sans imposer un style rigide (Prettier gère le format).
 * Démarrage volontairement permissif : la plupart des nits sont en `warn`,
 * seuls les bugs probables sont en `error`.
 */
export default [
  {
    ignores: [
      "node_modules/**",
      "graphify-out/**",
      "PersonaDLE_Update_Documentation/**",
      "Bot_Alibaba/**",
      "tests-e2e/**",
      "**/*.min.js",
    ],
  },

  js.configs.recommended,

  // ── Code applicatif : navigateur, modules ES ────────────────────────────────
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        // Libs chargées via <script> CDN dans les pages HTML
        html2canvas: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-constant-condition": ["warn", { checkLoops: false }],
      "no-prototype-builtins": "off",
    },
  },

  // ── Scripts Node + config ───────────────────────────────────────────────────
  {
    files: ["scripts/**/*.js", "*.config.js", "*.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // ── Service worker ──────────────────────────────────────────────────────────
  {
    files: ["sw.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.serviceworker },
    },
  },

  // ── Tests Vitest ────────────────────────────────────────────────────────────
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
  },
];
