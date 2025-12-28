/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Transform node_modules that are ESM-only (like pdfjs-dist)
  transformIgnorePatterns: [
    "node_modules/(?!(pdfjs-dist)/)"
  ],
  moduleNameMapper: {
    // Handle specific imports if necessary
  }
};
