import { test, expect } from "../fixtures/auth";
import { mockGmailSyncResponse, mockTransactions } from "../fixtures/mock-data";

/**
 * E2E Test Suite: Gmail Sync Flow
 *
 * Test Cases:
 * 1. Click sync button → spinner shows → success toast
 * 2. New transactions appear in list
 * 3. Duplicate emails don't create duplicate transactions
 * 4. Last sync timestamp updates
 */
test.describe("Gmail Sync Flow", () => {
  test.beforeEach(async ({ page, authenticatedUser }) => {
    // Mock API endpoints
    await page.route("**/api/gmail/sync", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockGmailSyncResponse),
      });
    });

    await page.route("**/api/services/update-budget", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, alerts: [] }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, reminders: [] }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTransactions),
      });
    });

    // Navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("should show spinner and success toast on sync", async ({ page }) => {
    // Find and click sync button
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await expect(syncButton).toBeVisible();

    // Click the sync button
    await syncButton.click();

    // Verify spinner appears
    await expect(
      page
        .locator('[data-testid="sync-spinner"]')
        .or(page.locator(".animate-spin"))
    ).toBeVisible({ timeout: 2000 });

    // Verify button text changes to "Syncing Gmail..."
    await expect(syncButton).toHaveText(/syncing gmail/i);
    await expect(syncButton).toBeDisabled();

    // Wait for sync to complete and verify success toast
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Verify toast shows transaction count
    await expect(page.locator("text=/3 new transactions/i")).toBeVisible();

    // Verify button returns to normal state
    await expect(syncButton).toBeEnabled();
    await expect(syncButton).toHaveText(/sync gmail/i);
  });

  test("should update last sync timestamp after successful sync", async ({
    page,
  }) => {
    // Click sync button
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Wait for sync to complete
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Verify last sync timestamp is displayed
    const lastSyncText = page.locator("text=/last synced:/i");
    await expect(lastSyncText).toBeVisible({ timeout: 5000 });

    // Extract and verify timestamp format
    const timestampText = await lastSyncText.textContent();
    expect(timestampText).toMatch(/last synced: \d{1,2}:\d{2}:\d{2}/i);
  });

  test("should display new transactions in list after sync", async ({
    page,
  }) => {
    // Take initial transaction count
    const transactionList = page
      .locator('[data-testid="transaction-list"]')
      .or(page.locator("table tbody tr"));

    // Click sync button
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Wait for sync to complete
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Wait for transactions to refresh
    await page.waitForTimeout(2000);

    // Verify transactions are displayed
    await expect(transactionList.first()).toBeVisible({ timeout: 5000 });

    // Verify specific transaction details appear
    await expect(page.locator("text=/Amazon Purchase/i")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.locator("text=/1,?250.50/i")).toBeVisible({
      timeout: 3000,
    });
  });

  test("should prevent duplicate transactions from same email", async ({
    page,
  }) => {
    // First sync
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(2000);

    // Mock sync response with duplicates
    await page.route("**/api/gmail/sync", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockGmailSyncResponse,
          summary: {
            ...mockGmailSyncResponse.summary,
            newTransactions: 0,
            duplicatesSkipped: 3,
          },
        }),
      });
    });

    // Second sync (should skip duplicates)
    await page.waitForTimeout(1000);
    await syncButton.click();
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Verify toast shows 0 new transactions
    await expect(page.locator("text=/0 new transactions/i")).toBeVisible();
  });

  test("should handle sync errors gracefully", async ({ page }) => {
    // Mock error response
    await page.route("**/api/gmail/sync", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Gmail API rate limit exceeded",
        }),
      });
    });

    // Click sync button
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Verify error toast appears
    await expect(
      page.locator("text=/gmail api rate limit exceeded/i")
    ).toBeVisible({
      timeout: 10000,
    });

    // Verify button returns to normal state
    await expect(syncButton).toBeEnabled();
  });

  test("should handle Gmail not connected state", async ({ page }) => {
    // Mock Gmail not connected response
    await page.route("**/api/gmail/sync", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: "Gmail not connected",
        }),
      });
    });

    // Click sync button
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Verify error message
    await expect(page.locator("text=/gmail not connected/i")).toBeVisible({
      timeout: 10000,
    });
  });
});
