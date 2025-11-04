import { test as base } from "@playwright/test";

/**
 * Authenticated user fixture for E2E tests
 */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  token: string;
  name: string;
};

type CustomFixtures = {
  authenticatedUser: AuthenticatedUser;
};

export const test = base.extend<CustomFixtures>({
  authenticatedUser: async ({ page }, use) => {
    // Mock authenticated user
    const mockUser: AuthenticatedUser = {
      userId: "test-user-e2e-123",
      email: "test-e2e@example.com",
      token: "mock-jwt-token-e2e",
      name: "Test User",
    };

    // Set up authentication state
    await page.goto("/");

    // Inject auth token into localStorage/cookies
    await page.evaluate((user) => {
      localStorage.setItem("auth-token", user.token);
      localStorage.setItem("user", JSON.stringify(user));
    }, mockUser);

    // Provide the authenticated user to the test
    await use(mockUser);
  },
});

export { expect } from "@playwright/test";
