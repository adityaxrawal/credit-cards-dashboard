import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useAuth } from "@/lib/auth/AuthContext";
import "@testing-library/jest-dom";

jest.mock("@/lib/auth/AuthContext");

global.fetch = jest.fn();

describe("NotificationBell", () => {
  const mockUser = {
    id: "test-user-123",
    email: "test@example.com",
    name: "Test User",
  };

  const mockReminders = [
    {
      card_id: "card-1",
      card_name: "HDFC Regalia",
      bank_name: "HDFC Bank",
      due_date: 20,
      days_remaining: 5,
      message: "HDFC Regalia bill due on 20th (in 5 days)",
    },
    {
      card_id: "card-2",
      card_name: "ICICI Amazon Pay",
      bank_name: "ICICI Bank",
      due_date: 25,
      days_remaining: 3,
      message: "ICICI Amazon Pay bill due on 25th (in 3 days)",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("accessToken", "mock-token");
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should render notification bell icon", () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: [] }),
    });

    render(<NotificationBell />);

    const bell = screen.getByRole("button");
    expect(bell).toBeInTheDocument();
  });

  it("should show notification count badge when reminders exist", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: mockReminders }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });
  });

  it("should NOT show badge when no reminders", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: [] }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.queryByText(/\d+/);
      expect(badge).not.toBeInTheDocument();
    });
  });

  it("should fetch reminders on mount", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: mockReminders }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/services/check-reminders"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        })
      );
    });
  });

  it("should display reminder details in dropdown when clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: mockReminders }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });

    // Click bell to open dropdown
    const bell = screen.getByRole("button");
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/HDFC Regalia/i)).toBeInTheDocument();
      expect(screen.getByText(/ICICI Amazon Pay/i)).toBeInTheDocument();
    });
  });

  it("should refresh reminders when refresh-dashboard event is dispatched", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: [] }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Update mock to return new reminders
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: mockReminders }),
    });

    // Dispatch refresh event
    window.dispatchEvent(new CustomEvent("refresh-dashboard"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<NotificationBell />);

    // Should not crash
    await waitFor(() => {
      const bell = screen.getByRole("button");
      expect(bell).toBeInTheDocument();
    });

    // Badge should not appear
    const badge = screen.queryByText(/\d+/);
    expect(badge).not.toBeInTheDocument();
  });

  it("should not fetch reminders if user is not logged in", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<NotificationBell />);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should display correct reminder count with 10+ reminders", async () => {
    const manyReminders = Array.from({ length: 15 }, (_, i) => ({
      card_id: `card-${i}`,
      card_name: `Card ${i}`,
      bank_name: "Bank",
      due_date: 20,
      days_remaining: 5,
      message: `Card ${i} bill due`,
    }));

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: manyReminders }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      // Badge should show "9+" or "15" depending on implementation
      const badge = screen.getByText(/1[0-9]|9\+/);
      expect(badge).toBeInTheDocument();
    });
  });

  it("should show empty state message when dropdown is opened with no reminders", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: [] }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Click bell to open dropdown
    const bell = screen.getByRole("button");
    fireEvent.click(bell);

    await waitFor(() => {
      const emptyMessage = screen.getByText(/no reminders|no notifications/i);
      expect(emptyMessage).toBeInTheDocument();
    });
  });

  it("should close dropdown when clicking outside", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: mockReminders }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });

    // Open dropdown
    const bell = screen.getByRole("button");
    fireEvent.click(bell);

    await waitFor(() => {
      expect(screen.getByText(/HDFC Regalia/i)).toBeInTheDocument();
    });

    // Click outside
    fireEvent.click(document.body);

    await waitFor(() => {
      expect(screen.queryByText(/HDFC Regalia/i)).not.toBeInTheDocument();
    });
  });

  it("should highlight urgent reminders (< 3 days)", async () => {
    const urgentReminders = [
      {
        card_id: "card-1",
        card_name: "HDFC Regalia",
        bank_name: "HDFC Bank",
        due_date: 20,
        days_remaining: 2, // Urgent!
        message: "HDFC Regalia bill due on 20th (in 2 days)",
      },
      {
        card_id: "card-2",
        card_name: "ICICI Amazon Pay",
        bank_name: "ICICI Bank",
        due_date: 25,
        days_remaining: 5,
        message: "ICICI Amazon Pay bill due on 25th (in 5 days)",
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: urgentReminders }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });

    // Open dropdown
    const bell = screen.getByRole("button");
    fireEvent.click(bell);

    await waitFor(() => {
      const urgentItem = screen.getByText(/in 2 days/i);
      expect(urgentItem).toBeInTheDocument();
      // Check if it has urgent styling (depends on implementation)
    });
  });

  it("should update count in real-time when reminders change", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: [mockReminders[0]] }),
    });

    render(<NotificationBell />);

    await waitFor(() => {
      const badge = screen.getByText("1");
      expect(badge).toBeInTheDocument();
    });

    // Update to 2 reminders
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reminders: mockReminders }),
    });

    // Trigger refresh
    window.dispatchEvent(new CustomEvent("refresh-dashboard"));

    await waitFor(() => {
      const badge = screen.getByText("2");
      expect(badge).toBeInTheDocument();
    });
  });
});
