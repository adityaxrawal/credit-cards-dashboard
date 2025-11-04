import { test, expect } from "../fixtures/auth";
import { mockBudget, mockAlerts, mockReminders } from "../fixtures/mock-data";

/**
 * E2E Test Suite: Frontend-Triggered Services
 *
 * Test Cases:
 * 1. After sync, budget updates automatically
 * 2. Alerts appear as toasts if budget > 80%
 * 3. Reminders shown in notification bell
 * 4. Analytics charts refresh with new data
 */
test.describe("Frontend-Triggered Services", () => {
  test.beforeEach(async ({ page, authenticatedUser }) => {
    // Mock Gmail sync success
    await page.route("**/api/gmail/sync", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          summary: {
            emailsScanned: 25,
            newTransactions: 5,
            duplicatesSkipped: 0,
            processingTime: "2.5s",
          },
        }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("should auto-update budget after Gmail sync", async ({ page }) => {
    // Mock budget update service
    const budgetRequests: any[] = [];
    await page.route("**/api/services/update-budget", async (route) => {
      budgetRequests.push(route.request().method());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          budget: {
            limit: 30000,
            spent: 25500,
            remaining: 4500,
            percentage: "85.00",
            status: "warning",
          },
        }),
      });
    });

    // Mock other services
    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, alerts: [] }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, reminders: [] }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Trigger Gmail sync
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Wait for sync completion
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Verify budget update was called
    await page.waitForTimeout(2000);
    expect(budgetRequests.length).toBeGreaterThan(0);

    // Verify budget display updates (if visible on dashboard)
    const budgetWidget = page
      .locator('[data-testid="budget-widget"]')
      .or(page.locator("text=/budget/i"));
    await expect(budgetWidget.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show alert toast when budget exceeds 80%", async ({ page }) => {
    // Mock budget at 85%
    await page.route("**/api/services/update-budget", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          budget: {
            limit: 30000,
            spent: 25500,
            remaining: 4500,
            percentage: "85.00",
            status: "warning",
          },
        }),
      });
    });

    // Mock alert service with warning
    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          alerts: [
            {
              id: "alert-1",
              alert_type: "budget_warning",
              priority: "medium",
              title: "Budget Warning",
              message:
                "You've used 85% of your monthly budget (₹25,500 / ₹30,000)",
            },
          ],
        }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, reminders: [] }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Trigger sync
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Wait for sync and verify alert toast
    await expect(page.locator("text=/budget warning/i")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator("text=/85% of your monthly budget/i")
    ).toBeVisible();
  });

  test("should show alert toast when budget exceeds 100%", async ({ page }) => {
    await page.route("**/api/services/update-budget", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          budget: {
            limit: 30000,
            spent: 31500,
            remaining: -1500,
            percentage: "105.00",
            status: "exceeded",
          },
        }),
      });
    });

    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          alerts: [
            {
              alert_type: "budget_exceeded",
              priority: "high",
              title: "Budget Exceeded",
              message:
                "You've exceeded your monthly budget of ₹30,000. Current spending: ₹31,500",
            },
          ],
        }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, reminders: [] }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    await expect(page.locator("text=/budget exceeded/i")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should show reminders in notification bell", async ({ page }) => {
    await page.route("**/api/services/update-budget", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, budget: mockBudget }),
      });
    });

    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, alerts: [] }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          reminders: mockReminders,
        }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Trigger sync
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Wait for sync
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Verify reminder toast appears
    await expect(page.locator("text=/upcoming bill reminders/i")).toBeVisible({
      timeout: 15000,
    });

    // Verify notification bell shows count
    const notificationBell = page
      .locator('[data-testid="notification-bell"]')
      .or(
        page
          .locator('button:has-text("Bell")')
          .or(page.locator(".notification-badge"))
      );

    await expect(notificationBell.first()).toBeVisible({ timeout: 5000 });
  });

  test("should refresh analytics after sync", async ({ page }) => {
    const analyticsRequests: any[] = [];

    await page.route("**/api/services/update-budget", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, alerts: [] }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, reminders: [] }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      analyticsRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          message: "Analytics cache refreshed",
          keysInvalidated: 4,
        }),
      });
    });

    // Mock analytics data endpoint
    await page.route("**/api/analytics/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          totalSpent: 25500,
          categoryBreakdown: [
            { category: "Shopping", amount: 10000 },
            { category: "Dining", amount: 8000 },
            { category: "Groceries", amount: 7500 },
          ],
        }),
      });
    });

    // Trigger sync
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });

    // Verify analytics refresh was called
    await page.waitForTimeout(2000);
    expect(analyticsRequests.length).toBeGreaterThan(0);
  });

  test("should handle service failures gracefully", async ({ page }) => {
    await page.route("**/api/services/update-budget", async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({
          success: false,
          error: "Budget update failed",
        }),
      });
    });

    await page.route("**/api/services/check-alerts", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, alerts: [] }),
      });
    });

    await page.route("**/api/services/check-reminders", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, reminders: [] }),
      });
    });

    await page.route("**/api/services/refresh-analytics", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Trigger sync
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Sync should still complete even if one service fails
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });
  });
});
