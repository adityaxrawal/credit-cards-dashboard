/**
 * Database Configuration
 * Supabase database settings
 */

export const databaseConfig = {
  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  postgres: {
    connectionString: process.env.DATABASE_URL || "",
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "10", 10),
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 2000,
  },

  // Query optimization
  queryTimeout: 30000, // 30 seconds
  statementTimeout: 60000, // 60 seconds
} as const;

export type DatabaseConfig = typeof databaseConfig;
