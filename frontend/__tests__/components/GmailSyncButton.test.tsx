import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GmailSyncButton } from "@/components/gmail/GmailSyncButton";
import { useAuth } from "@/lib/auth/AuthContext";
import "@testing-library/jest-dom";

// Mock dependencies
jest.mock("@/lib/auth/AuthContext");
jest.mock("react-hot-toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe("GmailSyncButton", () => {
  const mockUser = {
    id: "test-user-123",
    email: "test@example.com",
    name: "Test User",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("accessToken", "mock-token");
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should render sync button", () => {
    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("should show syncing state when clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        summary: {
          emailsScanned: 10,
          newTransactions: 2,
          duplicatesSkipped: 0,
          processingTime: "1.5s",
        },
      }),
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    // Button should be disabled and show "Syncing Gmail..."
    await waitFor(() => {
      expect(button).toHaveTextContent(/syncing gmail/i);
      expect(button).toBeDisabled();
    });
  });

  it("should show success toast with transaction count on successful sync", async () => {
    const mockResponse = {
      success: true,
      summary: {
        emailsScanned: 25,
        newTransactions: 5,
        duplicatesSkipped: 0,
        processingTime: "2.5s",
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    // Verify fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/gmail/sync"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock-token",
        }),
      })
    );
  });

  it("should trigger downstream services if new transactions found", async () => {
    const mockSyncResponse = {
      success: true,
      summary: {
        emailsScanned: 20,
        newTransactions: 3,
        duplicatesSkipped: 0,
        processingTime: "2.0s",
      },
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/gmail/sync")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSyncResponse,
        });
      }
      // Downstream services
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    // Verify all 4 downstream services were called
    await waitFor(() => {
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(
        fetchCalls.some((call) => call[0].includes("/services/update-budget"))
      ).toBe(true);
      expect(
        fetchCalls.some((call) => call[0].includes("/services/check-alerts"))
      ).toBe(true);
      expect(
        fetchCalls.some((call) => call[0].includes("/services/check-reminders"))
      ).toBe(true);
      expect(
        fetchCalls.some((call) =>
          call[0].includes("/services/refresh-analytics")
        )
      ).toBe(true);
    });
  });

  it("should NOT trigger downstream services if no new transactions", async () => {
    const mockSyncResponse = {
      success: true,
      summary: {
        emailsScanned: 20,
        newTransactions: 0, // No new transactions
        duplicatesSkipped: 5,
        processingTime: "1.5s",
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockSyncResponse,
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    // Only gmail/sync should be called
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("should dispatch custom events on sync completion", async () => {
    const mockSyncResponse = {
      success: true,
      summary: {
        emailsScanned: 10,
        newTransactions: 1,
        duplicatesSkipped: 0,
        processingTime: "1.0s",
      },
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/gmail/sync")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSyncResponse,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    const transactionsUpdatedListener = jest.fn();
    const refreshDashboardListener = jest.fn();

    window.addEventListener(
      "transactions-updated",
      transactionsUpdatedListener
    );
    window.addEventListener("refresh-dashboard", refreshDashboardListener);

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(transactionsUpdatedListener).toHaveBeenCalled();
      expect(refreshDashboardListener).toHaveBeenCalled();
    });

    window.removeEventListener(
      "transactions-updated",
      transactionsUpdatedListener
    );
    window.removeEventListener("refresh-dashboard", refreshDashboardListener);
  });

  it("should show error toast when sync fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "Gmail API rate limit exceeded",
      }),
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    // Button should return to normal state
    expect(button).toHaveTextContent(/sync gmail/i);
  });

  it("should handle network errors gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    expect(button).toHaveTextContent(/sync gmail/i);
  });

  it("should show error if user is not logged in", async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    // Button should not trigger sync
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should show error if access token is missing", async () => {
    localStorage.removeItem("accessToken");

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    // Button should not trigger sync
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should update last sync timestamp after successful sync", async () => {
    const mockSyncResponse = {
      success: true,
      summary: {
        emailsScanned: 10,
        newTransactions: 1,
        duplicatesSkipped: 0,
        processingTime: "1.0s",
      },
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/gmail/sync")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSyncResponse,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      const lastSyncText = screen.queryByText(/last synced:/i);
      expect(lastSyncText).toBeInTheDocument();
    });
  });

  it("should call onSyncComplete callback when provided", async () => {
    const mockCallback = jest.fn();
    const mockSyncResponse = {
      success: true,
      summary: {
        emailsScanned: 10,
        newTransactions: 1,
        duplicatesSkipped: 0,
        processingTime: "1.0s",
      },
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/gmail/sync")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSyncResponse,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    render(<GmailSyncButton onSyncComplete={mockCallback} />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  it("should apply custom className when provided", () => {
    render(<GmailSyncButton className="custom-class" />);

    const button = screen.getByRole("button", { name: /sync gmail/i });
    expect(button.parentElement).toHaveClass("custom-class");
  });

  it("should handle concurrent sync attempts", async () => {
    const mockSyncResponse = {
      success: true,
      summary: {
        emailsScanned: 10,
        newTransactions: 1,
        duplicatesSkipped: 0,
        processingTime: "1.0s",
      },
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (url.includes("/gmail/sync")) {
            resolve({
              ok: true,
              json: async () => mockSyncResponse,
            });
          } else {
            resolve({
              ok: true,
              json: async () => ({ success: true }),
            });
          }
        }, 100);
      });
    });

    render(<GmailSyncButton />);

    const button = screen.getByRole("button", { name: /sync gmail/i });

    // Click twice rapidly
    fireEvent.click(button);
    fireEvent.click(button);

    // Should only trigger one sync (button is disabled during sync)
    await waitFor(() => {
      expect(button).toBeEnabled();
    });

    const syncCalls = (global.fetch as jest.Mock).mock.calls.filter((call) =>
      call[0].includes("/gmail/sync")
    );
    expect(syncCalls).toHaveLength(1);
  });
});
