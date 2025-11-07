/**
 * CSRF Protection Utilities
 * For state-changing client-side POST requests
 * Uses double-submit cookie pattern
 */

/**
 * Generate a random CSRF token
 */
export function generateCsrfToken(): string {
  // Generate a random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Set CSRF token in cookie
 */
export function setCsrfToken(token: string): void {
  if (typeof document === "undefined") {
    return;
  }

  // Set cookie with SameSite=Lax for CSRF protection
  document.cookie = `csrf-token=${token}; Path=/; SameSite=Lax; Secure`;
}

/**
 * Get or create CSRF token
 * Returns existing token from cookie or generates a new one
 */
export function getOrCreateCsrfToken(): string {
  let token = getCsrfToken();

  if (!token) {
    token = generateCsrfToken();
    setCsrfToken(token);
  }

  return token;
}

/**
 * Clear CSRF token
 */
export function clearCsrfToken(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = "csrf-token=; Path=/; Max-Age=0";
}

/**
 * Hook to use CSRF token in React components
 */
export function useCsrfToken(): string {
  return getOrCreateCsrfToken();
}
