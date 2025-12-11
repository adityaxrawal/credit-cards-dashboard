module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.bench\\.(ts|js)$', // Exclude benchmark tests (timing-sensitive)
  ],
  modulePathIgnorePatterns: ['dist/'],
};
