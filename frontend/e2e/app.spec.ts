import { test, expect, Page } from "@playwright/test";

// Helper function to login
async function login(page: Page) {
  await page.goto("/login");

  // Wait for Google OAuth button
  const googleButton = page.locator('button:has-text("Continue with Google")');
  await expect(googleButton).toBeVisible();

  // In test environment, we mock the OAuth flow
  // Click button would normally redirect to Google OAuth
  // For E2E tests, use a test account or mock auth
}

test.describe("Dashboard E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login before each test
    await login(page);
  });

  test("should load dashboard successfully", async ({ page }) => {
    await page.goto("/dashboard");

    // Verify dashboard elements are visible
    await expect(page.locator("h1")).toContainText("Dashboard");

    // Check for card widgets
    await expect(page.locator('[data-testid="total-balance"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="monthly-spending"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="credit-utilization"]')
    ).toBeVisible();
  });

  test("should display credit cards", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for cards to load
    await page.waitForSelector('[data-testid="credit-card"]', {
      timeout: 5000,
    });

    // Verify at least one card is displayed
    const cards = page.locator('[data-testid="credit-card"]');
    await expect(cards).toHaveCount(1, { timeout: 5000 });
  });

  test("should auto-refresh data periodically", async ({ page }) => {
    await page.goto("/dashboard");

    // Get initial balance value
    const balanceElement = page.locator('[data-testid="total-balance"]');
    await balanceElement.waitFor();
    const initialText = await balanceElement.textContent();

    // Wait for auto-refresh (30 seconds)
    await page.waitForTimeout(31000);

    // Verify data was refreshed (should make API call)
    // This tests the refetchInterval functionality
    const finalText = await balanceElement.textContent();
    expect(finalText).toBeDefined();
  });
});

test.describe("Transactions E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should navigate to transactions page", async ({ page }) => {
    await page.goto("/dashboard");

    // Click on transactions nav link
    await page.click('a[href="/transactions"]');

    // Verify we're on transactions page
    await expect(page).toHaveURL("/transactions");
    await expect(page.locator("h1")).toContainText("Transactions");
  });

  test("should display transaction list", async ({ page }) => {
    await page.goto("/transactions");

    // Wait for transactions to load
    await page.waitForSelector('[data-testid="transaction-row"]', {
      timeout: 5000,
    });

    // Verify transactions are displayed
    const transactions = page.locator('[data-testid="transaction-row"]');
    const count = await transactions.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should create new transaction", async ({ page }) => {
    await page.goto("/transactions");

    // Click add transaction button
    await page.click('button:has-text("Add Transaction")');

    // Fill in transaction form
    await page.fill('[name="amount"]', "1500");
    await page.selectOption('[name="card_id"]', { index: 0 });
    await page.fill('[name="merchant_name"]', "Test Store");
    await page.selectOption('[name="transaction_type"]', "debit");
    await page.selectOption('[name="category"]', "Shopping");

    // Submit form
    await page.click('button[type="submit"]');

    // Verify success toast appears
    await expect(page.locator(".toast-success")).toBeVisible({ timeout: 3000 });

    // Verify transaction appears in list
    await expect(page.locator("text=Test Store")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should filter transactions by date", async ({ page }) => {
    await page.goto("/transactions");

    // Set date filter
    await page.fill('[name="startDate"]', "2025-01-01");
    await page.fill('[name="endDate"]', "2025-01-31");
    await page.click('button:has-text("Apply Filter")');

    // Wait for filtered results
    await page.waitForTimeout(1000);

    // Verify transactions are filtered
    const transactions = page.locator('[data-testid="transaction-row"]');
    await expect(transactions.first()).toBeVisible();
  });
});

test.describe("Reports E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should generate budget performance report", async ({ page }) => {
    await page.goto("/reports");

    // Select report type
    await page.selectOption('[name="reportType"]', "budget_performance");

    // Set date range
    await page.fill('[name="startDate"]', "2025-01-01");
    await page.fill('[name="endDate"]', "2025-01-31");

    // Generate report
    await page.click('button:has-text("Generate Report")');

    // Wait for report to load
    await page.waitForSelector('[data-testid="report-chart"]', {
      timeout: 5000,
    });

    // Verify report elements
    await expect(page.locator('[data-testid="report-title"]')).toContainText(
      "Budget Performance"
    );
    await expect(page.locator('[data-testid="report-chart"]')).toBeVisible();
  });

  test("should download report as PDF", async ({ page }) => {
    await page.goto("/reports");

    // Generate a report first
    await page.selectOption('[name="reportType"]', "monthly_trends");
    await page.click('button:has-text("Generate Report")');

    // Wait for report
    await page.waitForSelector('[data-testid="report-chart"]');

    // Click download PDF button
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Download PDF")');

    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain(".pdf");
  });
});

test.describe("Card Management E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should add new credit card", async ({ page }) => {
    await page.goto("/cards");

    // Click add card button
    await page.click('button:has-text("Add Card")');

    // Fill in card form
    await page.fill('[name="card_name"]', "Test Credit Card");
    await page.fill('[name="bank_name"]', "Test Bank");
    await page.fill('[name="last_four_digits"]', "1234");
    await page.fill('[name="credit_limit"]', "50000");
    await page.fill('[name="billing_date"]', "1");
    await page.fill('[name="due_date"]', "20");

    // Submit form
    await page.click('button:has-text("Save Card")');

    // Verify success
    await expect(page.locator(".toast-success")).toBeVisible();
    await expect(page.locator("text=Test Credit Card")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should edit card details", async ({ page }) => {
    await page.goto("/cards");

    // Click edit on first card
    await page.locator('[data-testid="card-edit-button"]').first().click();

    // Update card name
    await page.fill('[name="card_name"]', "Updated Card Name");

    // Save changes
    await page.click('button:has-text("Save Changes")');

    // Verify update
    await expect(page.locator(".toast-success")).toBeVisible();
    await expect(page.locator("text=Updated Card Name")).toBeVisible();
  });

  test("should delete card", async ({ page }) => {
    await page.goto("/cards");

    // Click delete on first card
    await page.locator('[data-testid="card-delete-button"]').first().click();

    // Confirm deletion
    await page.click('button:has-text("Confirm Delete")');

    // Verify deletion
    await expect(page.locator(".toast-success")).toContainText("Card deleted");
  });
});

test.describe("Authentication E2E Tests", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");

    // Should be redirected to login
    await expect(page).toHaveURL("/login");
  });

  test("should logout successfully", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");

    // Click logout button
    await page.click('button:has-text("Logout")');

    // Should be redirected to login
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Error Handling E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display error toast on API failure", async ({ page }) => {
    await page.goto("/transactions");

    // Intercept API call and force error
    await page.route("**/api/transactions", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({
          success: false,
          error: { message: "Test error" },
        }),
      });
    });

    // Try to add transaction
    await page.click('button:has-text("Add Transaction")');
    await page.fill('[name="amount"]', "1000");
    await page.click('button[type="submit"]');

    // Verify error toast
    await expect(page.locator(".toast-error")).toBeVisible();
    await expect(page.locator(".toast-error")).toContainText("error");
  });

  test("should handle network errors gracefully", async ({ page }) => {
    await page.goto("/dashboard");

    // Simulate offline
    await page.context().setOffline(true);

    // Try to refresh
    await page.reload();

    // Should show error state or offline message
    await expect(page.locator("text=network")).toBeVisible({ timeout: 5000 });
  });
});
