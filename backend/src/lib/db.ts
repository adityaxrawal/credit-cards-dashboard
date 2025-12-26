import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';
import logger from '../utils/infrastructure/logger';
import { isConnectionError } from '../utils/validation/errorTypeGuards';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 60000, // Close idle clients after 60s
  connectionTimeoutMillis: 10000, // 10s connection timeout
  max: 50, // Increased for batch processing (was 20)
  min: 5, // Keep minimum connections ready
  allowExitOnIdle: false, // Keep pool alive even when idle
  statement_timeout: 30000, // Kill queries after 30s
  idle_in_transaction_session_timeout: 10000, // Kill idle transactions after 10s
});

// Log pool status periodically in development
if (env.NODE_ENV === 'development') {
  setInterval(() => {
    // Only log if we have active clients to reduce empty noise
    if (pool.totalCount > 0) {
      logger.debug('[DB Pool] Status', {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      });
    }
  }, 60000); // Every minute
}

// Production pool monitoring - check for exhaustion
setInterval(() => {
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const waiting = pool.waitingCount;

  if (total > 0) {
    const utilization = ((total - idle) / 50) * 100; // max is 50

    // Alert if pool is > 80% utilized
    if (utilization > 80) {
      logger.warn('[DB Pool] High utilization warning', {
        utilization: `${utilization.toFixed(1)}%`,
        total,
        idle,
        waiting,
        active: total - idle
      });
    }

    // Alert if requests are waiting for connections
    if (waiting > 0) {
      logger.error('[DB Pool] Connection exhaustion - requests waiting', {
        waiting,
        total,
        idle
      });
    }
  }
}, 30000); // Check every 30s

// Handle unexpected errors on idle clients
pool.on('error', (err, client) => {
  // Common Supabase pooler errors - log but don't crash
  const isConnectionReset = err.message?.includes('Connection terminated') ||
    err.message?.includes('ECONNRESET') ||
    err.message?.includes('connection unexpectedly closed') ||
    err.message?.includes('DbHandler exited');

  if (isConnectionReset) {
    logger.warn('⚠️ DB connection was reset by server (normal for cloud DBs)', {
      message: err.message
    });
  } else {
    logger.error('❌ Unexpected error on idle client', err);
  }
  // Don't exit process - pool will automatically reconnect
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development') {
      logger.debug(`Executed query`, { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error: any) {
    // ... existing error handling ...
    const isTransientError = error.code === 'ECONNRESET' ||
      error.code === '57P01' || // admin_shutdown
      error.code === '57P02' || // crash_shutdown  
      error.code === '57P03';   // cannot_connect_now

    if (isTransientError) {
      logger.warn('⚠️ Transient DB error, connection will be retried on next query', {
        code: error.code,
        text: text.substring(0, 50)
      });
    } else {
      logger.error('Error executing query', { text: text.substring(0, 100), error: error.message });
    }
    throw error;
  }
};

export const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
};

/**
 * Execute a database operation with retry logic and exponential backoff
 * @param fn - Function that receives a PoolClient and returns a Promise
 * @param options - Configuration options
 * @returns The result of the function
 */
export async function executeWithRetry<T>(
  fn: (client: PoolClient) => Promise<T>,
  options?: {
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelayMs = options?.retryDelayMs ?? 1000;
  const timeoutMs = options?.timeoutMs ?? 30000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let client: PoolClient | null = null;
    try {
      // Get connection with timeout
      client = await Promise.race([
        pool.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Connection acquisition timeout')), timeoutMs / 2)
        ),
      ]);

      // Execute operation with timeout
      const result = await Promise.race([
        fn(client),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        ),
      ]);

      return result;
    } catch (error) {
      const err = error as Error;
      const isRecoverable =
        err.message.includes('connection') ||
        err.message.includes('timeout') ||
        err.message.includes('ECONNRESET') ||
        isConnectionError(error);

      if (isRecoverable && attempt < maxRetries - 1) {
        const delay = retryDelayMs * Math.pow(2, attempt); // Exponential backoff
        logger.warn(`[DB] Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`, {
          error: err.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      logger.error(`[DB] Operation failed after ${attempt + 1} attempts`, { error: err.message });
      throw error;
    } finally {
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          logger.warn('[DB] Error releasing client', releaseError);
        }
      }
    }
  }

  throw new Error(`Database operation failed after ${maxRetries} retries`);
}

/**
 * Execute a transaction with retry logic
 */
export async function executeTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  options?: { maxRetries?: number }
): Promise<T> {
  return executeWithRetry(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }, options);
}

export default pool;

