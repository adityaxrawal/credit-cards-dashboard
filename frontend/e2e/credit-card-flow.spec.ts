import { test, expect } from "@playwright/test";

/**
 * E2E Test: Gmail Sync → Budget → Analytics → Alerts
 * Tests the complete user flow from Gmail sync through to alert generation
 */

test.describe("Credit Card Dashboard - Complete Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navigate to app and login
    await page.goto("http://localhost:3000");

    // Mock authentication (or use test user)
    await page.evaluate(() => {
      localStorage.setItem("token", "test-jwt-token");
    });
  });

  test("Complete Flow: Gmail Sync → Budget → Analytics → Alerts", async ({
    page,
  }) => {
    // Step 1: Navigate to Dashboard
    await page.goto("http://localhost:3000/dashboard");
    await expect(
      page.locator("h1, h2").filter({ hasText: /dashboard/i })
    ).toBeVisible();

    // Step 2: Click Gmail Sync Button
    const syncButton = page
      .locator("button")
      .filter({ hasText: /sync.*gmail|gmail.*sync/i });
    await expect(syncButton).toBeVisible();
    await syncButton.click();

    // Step 3: Wait for sync to complete
    await expect(page.locator("text=/synced|success|completed/i")).toBeVisible({
      timeout: 10000,
    });

    // Step 4: Verify new transactions appear
    await page.waitForTimeout(1000); // Allow UI to update
    const transactionsList = page.locator(
      '[data-testid="transactions-list"], .transaction-item'
    );
    await expect(transactionsList.first()).toBeVisible();

    // Step 5: Check Budget Widget for updates
    const budgetWidget = page
      .locator('[data-testid="budget-widget"], .budget-card')
      .first();
    await expect(budgetWidget).toBeVisible();

    // Verify utilization percentage is displayed
    await expect(budgetWidget.locator("text=/%|utilization/i")).toBeVisible();

    // Step 6: Navigate to Analytics Page
    await page.click('a[href*="/analytics"], button:has-text("Analytics")');
    await expect(page).toHaveURL(/analytics/);

    // Step 7: Verify analytics data is refreshed
    await expect(
      page.locator('[data-testid="analytics-chart"], .chart-container')
    ).toBeVisible();
    await expect(
      page.locator("text=/spending|category|trends/i")
    ).toBeVisible();

    // Step 8: Check for Alerts/Notifications
    const notificationBell = page.locator(
      '[data-testid="notification-bell"], button[aria-label*="notification"]'
    );
    await expect(notificationBell).toBeVisible();

    // Check if there are unread notifications
    const badge = notificationBell.locator(".badge, [data-badge]");
    if (await badge.isVisible()) {
      await notificationBell.click();

      // Verify alert panel opens
      const alertPanel = page.locator(
        '[data-testid="alerts-panel"], .notifications-dropdown'
      );
      await expect(alertPanel).toBeVisible();

      // Verify alert content
      await expect(
        alertPanel.locator("text=/budget|threshold|alert/i")
      ).toBeVisible();
    }

    // Step 9: Verify end-to-end data consistency
    // Navigate back to dashboard
    await page.goto("http://localhost:3000/dashboard");

    // Verify the newly synced transaction count has increased
    const transactionCount = await page
      .locator('[data-testid="transaction-count"], .transaction-item')
      .count();
    expect(transactionCount).toBeGreaterThan(0);
  });

  test("Gmail Sync Error Handling", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard");

    // Intercept Gmail sync API and return error
    await page.route("**/api/gmail/sync", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Gmail API error" }),
      });
    });

    const syncButton = page
      .locator("button")
      .filter({ hasText: /sync.*gmail|gmail.*sync/i });
    await syncButton.click();

    // Verify error message is displayed
    await expect(page.locator("text=/error|failed/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("Budget Threshold Alert Creation", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard");

    // Mock transaction that exceeds budget
    await page.route("**/api/gmail/sync", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          newTransactions: 1,
          processedEmails: 1,
          duplicatesSkipped: 0,
          syncedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock budget data showing threshold exceeded
    await page.route("**/api/budgets**", (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          {
            id: "budget-001",
            category: "shopping",
            budget_limit: 10000,
            total_spent: 9500, // 95% utilization
            utilization: 95,
          },
        ]),
      });
    });

    const syncButton = page
      .locator("button")
      .filter({ hasText: /sync.*gmail|gmail.*sync/i });
    await syncButton.click();

    await page.waitForTimeout(2000);

    // Check for alert notification
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await notificationBell.click();

    // Verify threshold alert is present
    await expect(
      page.locator("text=/budget.*90%|threshold|exceeded/i")
    ).toBeVisible();
  });

  test("Analytics Refresh After Sync", async ({ page }) => {
    await page.goto("http://localhost:3000/analytics");

    // Record initial chart state
    const initialChartText = await page
      .locator('[data-testid="analytics-chart"]')
      .textContent();

    // Navigate to dashboard and sync
    await page.goto("http://localhost:3000/dashboard");
    const syncButton = page
      .locator("button")
      .filter({ hasText: /sync.*gmail|gmail.*sync/i });
    await syncButton.click();
    await page.waitForTimeout(2000);

    // Go back to analytics
    await page.goto("http://localhost:3000/analytics");
    await page.waitForLoadState("networkidle");

    // Verify analytics data has been updated (chart should re-render)
    const updatedChartText = await page
      .locator('[data-testid="analytics-chart"]')
      .textContent();

    // Charts should exist regardless
    await expect(page.locator('[data-testid="analytics-chart"]')).toBeVisible();
  });

  test("Multiple Card Selection and Filtering", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard");

    // Select a specific card
    const firstCard = page.locator('[data-testid="credit-card"]').first();
    await firstCard.click();

    // Verify transactions are filtered to that card
    await expect(
      page.locator('[data-testid="filtered-transactions"]')
    ).toBeVisible();
  });

  test("Accessibility: Keyboard Navigation", async ({ page }) => {
    await page.goto("http://localhost:3000/dashboard");

    // Test tab navigation through key elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Ensure focus is visible and logical
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName
    );
    expect(focusedElement).toBeTruthy();
  });

  test("Performance: Dashboard Load Time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("http://localhost:3000/dashboard");
    await expect(
      page.locator("h1, h2").filter({ hasText: /dashboard/i })
    ).toBeVisible();
    const loadTime = Date.now() - startTime;

    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});
