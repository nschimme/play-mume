import globals from "globals";
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

export default [
  {
    // Global ignores: these files will not be linted at all.
    ignores: [
      "node_modules/",
      ".git/",
      "DecafMUD/", // External library/submodule
      "dist/",     // Build output
      "build/",    // Common build output folder
      "docs/",     // Documentation files, if any
      "coverage/", // Coverage reports
      "sw.js",     // Service worker file, exclude from TS project linting for now
    ],
  },

  // ESLint's recommended base rules (good defaults for JavaScript)
  // Apply this first.
  js.configs.recommended,

  // Main configuration object for JavaScript and TypeScript files
  // This will override rules from js.configs.recommended if specified.
  {
    files: ["**/*.{js,ts}"], // Apply to both .js and .ts files
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser, // Use the TypeScript parser
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module", // Allows for the use of imports
        project: "./tsconfig.json", // Specify tsconfig.json for rules that require type information
        // tsconfigRootDir: __dirname, // Enables ESLint to find tsconfig.json relative to eslint.config.mjs
                                     // Only needed if ESLint can't find it automatically.
      },
      globals: {
        ...globals.browser, // For browser global variables (window, document, etc.)
        ...globals.node,    // For Node.js global variables and Node.js scoping (process, require, etc.)
        // Custom globals based on previous lint output:
        '$': 'readonly',
        'jQuery': 'readonly',
        'JQueryDeferred': 'readonly',
        'JQueryPromise': 'readonly',
        'JQueryXHR': 'readonly',
        'PIXI': 'readonly',
        'DecafMUD': 'readonly',
        'SparkMD5': 'readonly',
        'requirejs': 'readonly', // From example, might not be needed
        'define': 'readonly',    // From example, might not be needed
      },
    },
    rules: {
      // Start with TypeScript ESLint's recommended rules (contains many useful TS checks)
      ...tsPlugin.configs.recommended.rules,

      // Custom rules or overrides for the project:
      "no-unused-vars": "off", // Base rule disabled in favor of TypeScript version
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn", // Discourage use of 'any'
      "@typescript-eslint/explicit-function-return-type": "off", // As per original .eslintrc.js example
      "@typescript-eslint/no-namespace": "warn", // Downgraded from error to warning for now

      // General JavaScript / Best Practice Rules (some might be in js.configs.recommended already)
      "no-undef": "off", // Disabled for .ts files; TypeScript compiler handles this better.
                         // For .js files not parsed by ts-parser, js.configs.recommended will enable it.
      "no-prototype-builtins": "warn", // Downgraded from error
      "no-control-regex": "warn",      // Downgraded from error
      "no-duplicate-case": "error",    // Catches bugs in switch statements
      "no-case-declarations": "warn",  // Best practice for switch case scope

      // Add or adjust more rules as needed based on team preferences and project requirements
      // "no-console": "warn", // Example: to discourage console.log in production code
    },
  },

  // ESLint's recommended base rules (good defaults for JavaScript)
  // Prettier configuration (disables conflicting ESLint style rules)
  // This MUST BE THE LAST configuration in the array.
  eslintConfigPrettier,
];
