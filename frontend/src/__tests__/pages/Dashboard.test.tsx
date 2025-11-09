import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "@/app/(dashboard)/dashboard/page";

// Mock dependencies
jest.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-123", email: "test@example.com", full_name: "Test User" },
    isAuthenticated: true,
    loading: false,
  }),
}));

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    get: jest.fn((url) => {
      if (url.includes("/cards")) {
        return Promise.resolve({
          data: [
            {
              id: "card-001",
              card_name: "HDFC Regalia",
              bank_name: "HDFC Bank",
              credit_limit: 50000,
              current_outstanding: 12500,
              is_active: true,
            },
          ],
        });
      }
      if (url.includes("/transactions")) {
        return Promise.resolve({
          data: [
            {
              id: "txn-001",
              amount: 2500,
              merchant_name: "Amazon",
              category: "shopping",
              transaction_date: "2024-01-15T10:30:00Z",
            },
          ],
        });
      }
      if (url.includes("/budgets")) {
        return Promise.resolve({
          data: [
            {
              id: "budget-001",
              category: "shopping",
              budget_limit: 10000,
              total_spent: 5000,
            },
          ],
        });
      }
      if (url.includes("/alerts")) {
        return Promise.resolve({
          data: [
            {
              id: "alert-001",
              type: "budget_threshold",
              message: "Budget limit reached",
              is_read: false,
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
  },
}));

describe("Dashboard Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );
  };

  it("should render dashboard with all key sections", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Check for key dashboard elements
    expect(
      screen.getByText(/credit cards/i) || screen.getByText(/cards/i)
    ).toBeInTheDocument();
  });

  it("should display credit card summary", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/HDFC Regalia/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/12,500/i) || screen.getByText(/12500/i)
    ).toBeInTheDocument();
  });

  it("should display recent transactions", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Amazon/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/2,500/i) || screen.getByText(/2500/i)
    ).toBeInTheDocument();
  });

  it("should display budget widget", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/budget/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/shopping/i)).toBeInTheDocument();
  });

  it("should show unread alerts", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(/alert/i) || screen.getByText(/notification/i)
      ).toBeInTheDocument();
    });
  });

  it("should display loading state initially", () => {
    const { container } = renderDashboard();

    // Check for loading indicators (skeletons, spinners, etc.)
    expect(
      container.querySelector("[data-loading]") ||
        container.querySelector(".animate-pulse")
    ).toBeTruthy();
  });

  it("should handle API errors gracefully", async () => {
    const { apiClient } = require("@/lib/api-client");
    apiClient.get.mockRejectedValueOnce(new Error("API Error"));

    renderDashboard();

    await waitFor(() => {
      // Should show error state or fallback UI
      expect(
        screen.queryByText(/error/i) || screen.queryByText(/failed/i)
      ).toBeTruthy();
    });
  });

  it("should auto-refresh data when tab is active", async () => {
    const { apiClient } = require("@/lib/api-client");
    const getSpy = jest.spyOn(apiClient, "get");

    renderDashboard();

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalled();
    });

    // Simulate visibility change
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "visible",
    });

    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(getSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("should pause auto-refresh when tab is inactive", async () => {
    const { apiClient } = require("@/lib/api-client");
    const getSpy = jest.spyOn(apiClient, "get");

    renderDashboard();

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalled();
    });

    const initialCallCount = getSpy.mock.calls.length;

    // Simulate tab becoming hidden
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "hidden",
    });

    document.dispatchEvent(new Event("visibilitychange"));

    // Wait a bit and verify no new calls
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(getSpy.mock.calls.length).toBe(initialCallCount);
  });

  it("should navigate to card details when card is clicked", async () => {
    const { useRouter } = require("next/navigation");
    const mockPush = jest.fn();
    useRouter.mockReturnValue({ push: mockPush });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/HDFC Regalia/i)).toBeInTheDocument();
    });

    const cardElement = screen.getByText(/HDFC Regalia/i);
    fireEvent.click(cardElement.closest("button") || cardElement);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/cards/"));
    });
  });
});
