module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.ts'],
  testTimeout: 60000, // 60 seconds for E2E tests
  maxWorkers: 1, // Run E2E tests sequentially
};
