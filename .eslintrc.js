module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2021, // or "latest" or a specific year like 2016 to match our tsconfig target
    sourceType: 'module',
    project: './tsconfig.json', // Required for some TypeScript rules
  },
  env: {
    browser: true, // Assuming this is a browser project based on HTML files
    node: true, // For build scripts and configuration files if any
    es6: true, // Enables ES6 globals
  },
  ignorePatterns: [
    "dist/", // Ignore the output directory
    "node_modules/",
    "DecafMUD/", // Ignoring submodule
    "resources/", // Ignoring resources
    "*.d.ts" // Ignoring declaration files from linting by default
  ],
  rules: {
    // Add any initial rule customizations here if needed.
    // For example, to turn off a specific rule:
    // 'no-console': 'off',
    "@typescript-eslint/no-unused-vars": [
      "warn", // or "error"
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ]
  },
  overrides: [
    {
      files: ['*.js'], // Apply this override to all JavaScript files
      parserOptions: {
        project: null, // Do not use tsconfig.json for JS files
      },
      rules: {
        // You might want to disable certain TypeScript-specific rules for JS files if they cause issues
        '@typescript-eslint/no-var-requires': 'off', // Example: if you use require() in JS files
      }
    }
  ]
};
