/**
 * Supabase Mock Factory
 * Provides comprehensive mocking for Supabase client operations
 */

export interface MockSupabaseResponse<T = any> {
  data: T | null;
  error: any | null;
}

export class SupabaseMock {
  private mockData: Map<string, any> = new Map();
  private mockErrors: Map<string, any> = new Map();

  /**
   * Set mock return value for a table operation
   */
  setReturnValue(table: string, operation: string, response: MockSupabaseResponse): void {
    const key = `${table}:${operation}`;
    this.mockData.set(key, response);
  }

  /**
   * Set mock error for a table operation
   */
  setError(table: string, operation: string, error: any): void {
    const key = `${table}:${operation}`;
    this.mockErrors.set(key, { data: null, error });
  }

  /**
   * Get mock response for a table operation
   */
  private getResponse(table: string, operation: string): MockSupabaseResponse {
    const key = `${table}:${operation}`;

    if (this.mockErrors.has(key)) {
      return this.mockErrors.get(key);
    }

    if (this.mockData.has(key)) {
      return this.mockData.get(key);
    }

    return { data: null, error: null };
  }

  /**
   * Create a chainable mock for Supabase client
   */
  createMock() {
    let currentTable = "";
    let currentOperation = "";

    const mock = {
      from: jest.fn((table: string) => {
        currentTable = table;
        return mock;
      }),
      select: jest.fn((columns?: string) => {
        currentOperation = "select";
        return mock;
      }),
      insert: jest.fn((data: any) => {
        currentOperation = "insert";
        return mock;
      }),
      update: jest.fn((data: any) => {
        currentOperation = "update";
        return mock;
      }),
      delete: jest.fn(() => {
        currentOperation = "delete";
        return mock;
      }),
      upsert: jest.fn((data: any) => {
        currentOperation = "upsert";
        return mock;
      }),
      eq: jest.fn((column: string, value: any) => mock),
      neq: jest.fn((column: string, value: any) => mock),
      gt: jest.fn((column: string, value: any) => mock),
      gte: jest.fn((column: string, value: any) => mock),
      lt: jest.fn((column: string, value: any) => mock),
      lte: jest.fn((column: string, value: any) => mock),
      like: jest.fn((column: string, pattern: string) => mock),
      ilike: jest.fn((column: string, pattern: string) => mock),
      is: jest.fn((column: string, value: any) => mock),
      in: jest.fn((column: string, values: any[]) => mock),
      contains: jest.fn((column: string, value: any) => mock),
      containedBy: jest.fn((column: string, value: any) => mock),
      range: jest.fn((from: number, to: number) => mock),
      order: jest.fn((column: string, options?: any) => mock),
      limit: jest.fn((count: number) => mock),
      single: jest.fn(() => {
        const response = this.getResponse(currentTable, currentOperation);
        return Promise.resolve(response);
      }),
      maybeSingle: jest.fn(() => {
        const response = this.getResponse(currentTable, currentOperation);
        return Promise.resolve(response);
      }),
      then: jest.fn((resolve) => {
        const response = this.getResponse(currentTable, currentOperation);
        return Promise.resolve(response).then(resolve);
      }),
    };

    return mock;
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.mockData.clear();
    this.mockErrors.clear();
  }
}

/**
 * Create a new Supabase mock instance
 */
export const createSupabaseMock = () => {
  const mockInstance = new SupabaseMock();
  const mock = mockInstance.createMock();

  return {
    supabase: mock,
    mockInstance,
    setReturnValue: mockInstance.setReturnValue.bind(mockInstance),
    setError: mockInstance.setError.bind(mockInstance),
    reset: mockInstance.reset.bind(mockInstance),
  };
};

/**
 * Quick helper to create simple mocked responses
 */
export const createMockResponse = <T = any>(
  data: T | null,
  error: any | null = null
): MockSupabaseResponse<T> => ({
  data,
  error,
});
