import { test, expect } from "../fixtures/auth";

/**
 * E2E Test Suite: Auto-Sync and Cold Start Handling
 *
 * Test Cases:
 * 1. Dashboard loads → auto-sync if >30 min since last sync
 * 2. Silent sync in background
 * 3. Toast notification on completion
 * 4. Cold start handling with loading state
 */
test.describe("Auto-Sync and Cold Start", () => {
  test("should auto-sync when dashboard loads after 30+ minutes", async ({
    page,
    authenticatedUser,
  }) => {
    // Mock last sync timestamp (35 minutes ago)
    const lastSyncTime = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    await page.route("**/api/users/*/last-sync", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          lastSync: lastSyncTime,
        }),
      });
    });

    let autoSyncTriggered = false;
    await page.route("**/api/gmail/sync", async (route) => {
      autoSyncTriggered = true;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          summary: {
            emailsScanned: 10,
            newTransactions: 2,
            duplicatesSkipped: 0,
            processingTime: "1.5s",
          },
        }),
      });
    });

    // Mock service endpoints
    await page.route("**/api/services/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Load dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Wait and verify auto-sync was triggered
    await page.waitForTimeout(3000);
    expect(autoSyncTriggered).toBe(true);

    // Verify toast notification appears
    await expect(page.locator("text=/auto-sync|sync complete/i")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should NOT auto-sync if last sync was within 30 minutes", async ({
    page,
    authenticatedUser,
  }) => {
    // Mock last sync timestamp (15 minutes ago)
    const lastSyncTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    await page.route("**/api/users/*/last-sync", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          lastSync: lastSyncTime,
        }),
      });
    });

    let autoSyncTriggered = false;
    await page.route("**/api/gmail/sync", async (route) => {
      autoSyncTriggered = true;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/services/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Load dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Wait and verify auto-sync was NOT triggered
    await page.waitForTimeout(3000);
    expect(autoSyncTriggered).toBe(false);
  });

  test("should handle cold start with loading state", async ({
    page,
    authenticatedUser,
  }) => {
    // Mock slow API response (simulating cold start)
    await page.route("**/api/**", async (route) => {
      await page.waitForTimeout(5000); // 5 second delay
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate to dashboard
    await page.goto("/dashboard");

    // Verify loading state appears
    const loader = page
      .locator('[data-testid="loading-spinner"]')
      .or(page.locator("text=/loading/i"));
    await expect(loader.first()).toBeVisible({ timeout: 2000 });

    // Verify page eventually loads
    await page.waitForLoadState("networkidle", { timeout: 60000 });
  });

  test("should show cold start message on timeout", async ({
    page,
    authenticatedUser,
  }) => {
    // Mock extremely slow response (simulating Render cold start)
    await page.route("**/api/gmail/sync", async (route) => {
      await page.waitForTimeout(50000); // 50 seconds (exceeds 45s timeout)
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/services/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Navigate and trigger sync
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Verify timeout error message appears
    await expect(
      page.locator("text=/service starting up|please try again|cold start/i")
    ).toBeVisible({ timeout: 50000 });
  });

  test("should handle silent background sync gracefully", async ({
    page,
    authenticatedUser,
  }) => {
    const lastSyncTime = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    await page.route("**/api/users/*/last-sync", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ lastSync: lastSyncTime }),
      });
    });

    await page.route("**/api/gmail/sync", async (route) => {
      // Silent sync - no immediate user feedback
      await page.waitForTimeout(2000);
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          summary: {
            emailsScanned: 15,
            newTransactions: 1,
            duplicatesSkipped: 0,
            processingTime: "1.8s",
          },
        }),
      });
    });

    await page.route("**/api/services/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Load dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should be interactive while background sync happens
    await expect(page.locator("h1, h2")).toBeVisible();

    // Toast should appear after sync completes
    await expect(page.locator("text=/sync|complete/i")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should recover from failed auto-sync", async ({
    page,
    authenticatedUser,
  }) => {
    const lastSyncTime = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    await page.route("**/api/users/*/last-sync", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ lastSync: lastSyncTime }),
      });
    });

    // Mock auto-sync failure
    let syncAttempts = 0;
    await page.route("**/api/gmail/sync", async (route) => {
      syncAttempts++;
      if (syncAttempts === 1) {
        // First attempt fails
        await route.fulfill({
          status: 500,
          body: JSON.stringify({
            success: false,
            error: "Network error",
          }),
        });
      } else {
        // Manual retry succeeds
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            success: true,
            summary: {
              emailsScanned: 10,
              newTransactions: 2,
              duplicatesSkipped: 0,
              processingTime: "1.5s",
            },
          }),
        });
      }
    });

    await page.route("**/api/services/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Load dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Auto-sync fails silently (no error toast in background)
    await page.waitForTimeout(3000);

    // User can manually retry
    const syncButton = page.getByRole("button", { name: /sync gmail/i });
    await syncButton.click();

    // Manual sync succeeds
    await expect(page.locator("text=/sync complete/i")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should update dashboard data after background sync", async ({
    page,
    authenticatedUser,
  }) => {
    const lastSyncTime = new Date(Date.now() - 35 * 60 * 1000).toISOString();

    await page.route("**/api/users/*/last-sync", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ lastSync: lastSyncTime }),
      });
    });

    await page.route("**/api/gmail/sync", async (route) => {
      await page.waitForTimeout(2000);
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          summary: {
            emailsScanned: 20,
            newTransactions: 3,
            duplicatesSkipped: 0,
            processingTime: "2.0s",
          },
        }),
      });
    });

    await page.route("**/api/services/**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    // Mock updated transactions
    await page.route("**/api/transactions**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([
          {
            id: "new-txn-1",
            amount: 1500,
            description: "New Transaction After Sync",
            transaction_date: new Date().toISOString(),
          },
        ]),
      });
    });

    // Load dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Wait for background sync to complete
    await expect(page.locator("text=/sync|complete/i")).toBeVisible({
      timeout: 15000,
    });

    // Verify dashboard data refreshes
    await page.waitForTimeout(2000);

    // Check for refreshed content (custom event should trigger re-fetch)
    await expect(page.locator("text=/transaction/i")).toBeVisible();
  });
});
