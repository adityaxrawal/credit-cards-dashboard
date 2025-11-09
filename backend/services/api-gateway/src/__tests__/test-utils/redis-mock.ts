/**
 * Redis Mock
 * In-memory Redis client mock for testing
 */

export class RedisMock {
  private store: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();

  get = jest.fn(async (key: string): Promise<string | null> => {
    // Check if key has expired
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.store.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  });

  set = jest.fn(async (key: string, value: string, options?: any): Promise<"OK"> => {
    this.store.set(key, value);

    // Handle EX option (expiration in seconds)
    if (options?.EX) {
      const expirationTime = Date.now() + options.EX * 1000;
      this.expirations.set(key, expirationTime);
    }

    return "OK";
  });

  del = jest.fn(async (key: string | string[]): Promise<number> => {
    const keys = Array.isArray(key) ? key : [key];
    let deleted = 0;

    keys.forEach((k) => {
      if (this.store.has(k)) {
        this.store.delete(k);
        this.expirations.delete(k);
        deleted++;
      }
    });

    return deleted;
  });

  exists = jest.fn(async (key: string): Promise<number> => {
    return this.store.has(key) ? 1 : 0;
  });

  expire = jest.fn(async (key: string, seconds: number): Promise<number> => {
    if (!this.store.has(key)) {
      return 0;
    }
    const expirationTime = Date.now() + seconds * 1000;
    this.expirations.set(key, expirationTime);
    return 1;
  });

  ttl = jest.fn(async (key: string): Promise<number> => {
    const expiration = this.expirations.get(key);
    if (!expiration) {
      return -1; // No expiration set
    }
    const remaining = Math.floor((expiration - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2; // -2 means expired
  });

  keys = jest.fn(async (pattern: string): Promise<string[]> => {
    const regex = new RegExp(pattern.replace("*", ".*"));
    return Array.from(this.store.keys()).filter((key) => regex.test(key));
  });

  flushall = jest.fn(async (): Promise<"OK"> => {
    this.store.clear();
    this.expirations.clear();
    return "OK";
  });

  /**
   * Helper to get the current store state (for testing)
   */
  getStore(): Map<string, string> {
    return new Map(this.store);
  }

  /**
   * Helper to directly set a value (bypassing mocks for setup)
   */
  directSet(key: string, value: string): void {
    this.store.set(key, value);
  }

  /**
   * Reset the mock
   */
  reset(): void {
    this.store.clear();
    this.expirations.clear();
    jest.clearAllMocks();
  }
}

/**
 * Create a new Redis mock instance
 */
export const createRedisMock = (): RedisMock => {
  return new RedisMock();
};
