/**
 * Database Connection Pool Configuration
 * Phase 6: Backend Performance Optimization
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface PoolConfig {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

const poolConfig: PoolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  min: parseInt(process.env.DB_POOL_MIN || "5", 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: parseInt(
    process.env.DB_CONNECTION_TIMEOUT || "5000",
    10
  ),
};

class DatabasePool {
  private static instance: DatabasePool;
  private client: SupabaseClient;
  private connectionCount = 0;

  private constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      {
        db: {
          schema: "public",
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            "x-connection-pool": "true",
          },
        },
      }
    );

    console.log("✅ Database connection pool initialized", poolConfig);
  }

  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  public getClient(): SupabaseClient {
    this.connectionCount++;
    return this.client;
  }

  public getConnectionCount(): number {
    return this.connectionCount;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from("users")
        .select("count")
        .limit(1)
        .single();

      return !error;
    } catch {
      return false;
    }
  }
}

export const dbPool = DatabasePool.getInstance();
export const supabase = dbPool.getClient();
