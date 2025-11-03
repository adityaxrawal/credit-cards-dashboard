// Test setup file
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent"; // Suppress logs during tests
process.env.ENCRYPTION_KEY = "test_encryption_key_32_bytes_test";
process.env.JWT_SECRET = "test_jwt_secret_32_bytes_long_test";
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test_service_key";
process.env.GOOGLE_CLIENT_ID = "test_client_id";
process.env.GOOGLE_CLIENT_SECRET = "test_client_secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/callback";
process.env.GMAIL_MOCK_MODE = "true";

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to keep test output clean
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
