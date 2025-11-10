/**
 * Cache Key Utilities - Unified cache key generation
 *
 * Enforces standard naming convention: cache:{module}:{userId}:{resource}:{...parts}
 * This ensures consistency across all Redis cache operations in the system.
 */

/**
 * Normalizes module names to lowercase kebab-case
 * @param moduleName - Module name to normalize
 * @returns Normalized module name
 *
 * @example
 * normalizeModuleName('Analytics') // => 'analytics'
 * normalizeModuleName('AI_Insights') // => 'ai-insights'
 * normalizeModuleName('gmail.sync') // => 'gmail-sync'
 */
export function normalizeModuleName(moduleName: string): string {
  return moduleName
    .replace(/[._\s]/g, "-") // Replace dots, underscores, spaces with hyphens
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Convert camelCase to kebab-case
    .toLowerCase();
}

/**
 * Generates a standardized cache key
 * @param module - Module name (will be normalized to kebab-case)
 * @param userId - User ID (string or number)
 * @param resource - Resource identifier
 * @param parts - Additional parts to append to the key
 * @returns Formatted cache key
 *
 * @example
 * cacheKey('analytics', '123', 'metrics') // => 'cache:analytics:123:metrics'
 * cacheKey('transactions', 456, 'list', '2024-01', 'card-1')
 * // => 'cache:transactions:456:list:2024-01:card-1'
 */
export function cacheKey(
  module: string,
  userId: string | number,
  resource: string,
  ...parts: (string | number)[]
): string {
  const normalizedModule = normalizeModuleName(module);
  const baseParts = ["cache", normalizedModule, String(userId), resource];

  if (parts.length > 0) {
    baseParts.push(...parts.map((p) => String(p)));
  }

  return baseParts.join(":");
}

/**
 * Generates a cache key for user session data
 */
export function sessionKey(userId: string | number): string {
  return `session:${userId}`;
}

/**
 * Generates a cache key for user-specific module data
 */
export function userModuleKey(module: string, userId: string | number): string {
  return cacheKey(module, userId, "data");
}

/**
 * Generates a pattern for invalidating all keys for a user in a module
 */
export function userModulePattern(module: string, userId: string | number): string {
  const normalizedModule = normalizeModuleName(module);
  return `cache:${normalizedModule}:${userId}:*`;
}

/**
 * Generates a pattern for invalidating all keys in a module
 */
export function modulePattern(module: string): string {
  const normalizedModule = normalizeModuleName(module);
  return `cache:${normalizedModule}:*`;
}
