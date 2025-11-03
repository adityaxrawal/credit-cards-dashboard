import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Test utilities for rendering components with providers
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

export const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1]
) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// Mock data generators
export const mockCreditCard = {
  id: "1",
  name: "Test Credit Card",
  lastFour: "1234",
  type: "Visa",
  creditLimit: 50000,
  currentBalance: 15000,
  availableCredit: 35000,
  apr: 18.99,
  billingCycle: 15,
  paymentDueDate: "2024-12-15",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

export const mockTransaction = {
  id: "1",
  cardId: "1",
  merchantName: "Test Merchant",
  amount: 100.5,
  category: "Food & Dining",
  transactionDate: "2024-01-15T10:30:00Z",
  description: "Test transaction",
  status: "completed" as const,
  createdAt: "2024-01-15T10:30:00Z",
};

export const mockBudget = {
  id: "1",
  category: "Food & Dining",
  monthlyLimit: 2000,
  currentSpent: 850,
  month: 1,
  year: 2024,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z",
};

export const mockUser = {
  id: "1",
  email: "test@example.com",
  name: "Test User",
  picture: "https://example.com/avatar.jpg",
  emailVerified: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

// Re-export testing library utilities
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
