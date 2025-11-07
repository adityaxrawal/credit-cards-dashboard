/**
 * Security Level System
 * Defines security levels and route protection rules
 */

export type SecurityLevel =
  | "public"
  | "authenticated"
  | "gmailConnected"
  | "admin";

/**
 * User context interface for security checks
 */
export interface UserSecurityContext {
  id: string;
  email: string;
  name: string;
  gmailConnected: boolean;
  isAdmin?: boolean;
}

/**
 * Route security configuration
 * Maps pathname patterns to required security levels
 */
export const ROUTE_SECURITY_MAP: Record<string, SecurityLevel> = {
  // Public routes (no auth required)
  "/": "public",
  "/login": "public",
  "/auth/callback": "public",
  "/error": "public",
  "/not-found": "public",

  // Authenticated routes (requires login)
  "/dashboard": "authenticated",
  "/settings": "authenticated",
  "/cards": "authenticated",
  "/profile": "authenticated",

  // Gmail-connected routes (requires Gmail connection)
  "/transactions": "gmailConnected",
  "/analytics": "gmailConnected",
  "/budget": "gmailConnected",
  "/bills": "gmailConnected",
  "/reports": "gmailConnected",
  "/rewards": "gmailConnected",
  "/recurring": "gmailConnected",
  "/notifications": "gmailConnected",

  // Admin routes
  "/admin": "admin",
};

/**
 * Get required security level for a given pathname
 * @param pathname - The pathname to check
 * @returns The required security level
 */
export function getRequiredSecurityLevel(pathname: string): SecurityLevel {
  // Exact match first
  if (pathname in ROUTE_SECURITY_MAP) {
    return ROUTE_SECURITY_MAP[pathname];
  }

  // Check for prefix matches (e.g., /dashboard/overview matches /dashboard)
  for (const [route, level] of Object.entries(ROUTE_SECURITY_MAP)) {
    if (pathname.startsWith(route + "/")) {
      return level;
    }
  }

  // Default to authenticated for unknown routes
  return "authenticated";
}

/**
 * Check if user has required security level
 * @param userContext - Current user context (null if not authenticated)
 * @param requiredLevel - Required security level
 * @returns True if user has required level
 */
export function hasSecurityLevel(
  userContext: UserSecurityContext | null,
  requiredLevel: SecurityLevel
): boolean {
  // Public routes allow everyone
  if (requiredLevel === "public") {
    return true;
  }

  // All other levels require authentication
  if (!userContext) {
    return false;
  }

  // Check specific levels
  switch (requiredLevel) {
    case "authenticated":
      return true; // Already checked userContext exists

    case "gmailConnected":
      return userContext.gmailConnected;

    case "admin":
      return userContext.isAdmin === true;

    default:
      return false;
  }
}

/**
 * Assert that user has required security level
 * Throws error if user doesn't have access
 * @param userContext - Current user context
 * @param requiredLevel - Required security level
 * @throws Error if access denied
 */
export function assertHasLevel(
  userContext: UserSecurityContext | null,
  requiredLevel: SecurityLevel
): asserts userContext is UserSecurityContext {
  if (!hasSecurityLevel(userContext, requiredLevel)) {
    const levelDescriptions: Record<SecurityLevel, string> = {
      public: "Public access",
      authenticated: "Authentication",
      gmailConnected: "Gmail connection",
      admin: "Admin privileges",
    };

    throw new Error(
      `Access denied: ${levelDescriptions[requiredLevel]} required`
    );
  }
}

/**
 * Get redirect path for missing security level
 * @param requiredLevel - The security level that is missing
 * @param currentPath - The current path (for next redirect)
 * @returns The path to redirect to
 */
export function getSecurityRedirectPath(
  requiredLevel: SecurityLevel,
  currentPath?: string
): string {
  const nextParam = currentPath
    ? `?next=${encodeURIComponent(currentPath)}`
    : "";

  switch (requiredLevel) {
    case "authenticated":
    case "gmailConnected":
    case "admin":
      return `/login${nextParam}`;

    default:
      return "/";
  }
}

/**
 * Get Gmail connection redirect path
 * @param currentPath - The current path (for next redirect)
 * @returns The path to redirect to for connecting Gmail
 */
export function getGmailConnectPath(currentPath?: string): string {
  const nextParam = currentPath
    ? `?next=${encodeURIComponent(currentPath)}`
    : "";
  return `/settings/gmail-connect${nextParam}`;
}

/**
 * Security level hierarchy (lower index = lower security)
 */
const SECURITY_HIERARCHY: SecurityLevel[] = [
  "public",
  "authenticated",
  "gmailConnected",
  "admin",
];

/**
 * Compare two security levels
 * @returns positive if level1 > level2, negative if level1 < level2, 0 if equal
 */
export function compareSecurityLevels(
  level1: SecurityLevel,
  level2: SecurityLevel
): number {
  return (
    SECURITY_HIERARCHY.indexOf(level1) - SECURITY_HIERARCHY.indexOf(level2)
  );
}
