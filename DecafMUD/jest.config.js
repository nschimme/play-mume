module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom', // Use jsdom for browser-like environment
  roots: ['<rootDir>/src/ts'], // Point Jest to the TypeScript source directory
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'src/ts/tsconfig.json', // Point to your tsconfig
    }],
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    "src/ts/**/*.ts",
    "!src/ts/**/*.d.ts", // Exclude declaration files
    "!src/ts/tests/**", // Exclude test files themselves from coverage
  ],
  // Setup file to run before each test file
  // setupFilesAfterEnv: ['<rootDir>/src/ts/tests/setupTests.ts'], // if you need setup files
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig.json paths)
    // Example: '^@/(.*)$': '<rootDir>/src/ts/$1'
  }
};
