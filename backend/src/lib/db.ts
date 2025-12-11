import { Pool } from 'pg';
import { env } from '../config/env';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 20000, // Close idle clients after 20s (Supabase pooler timeout is 60s)
  connectionTimeoutMillis: 10000, // 10s connection timeout
  max: 10, // Limit max connections to avoid pool exhaustion
  allowExitOnIdle: false, // Keep pool alive even when idle
});

// Log pool status periodically in development
if (env.NODE_ENV === 'development') {
  setInterval(() => {
    logger.debug('[DB Pool] Status', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  }, 60000); // Every minute
}

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

// Handle pool connect events
pool.on('connect', (client) => {
  logger.debug('[DB Pool] New client connected');
});

pool.on('remove', (client) => {
  logger.debug('[DB Pool] Client removed from pool');
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
    // Check if it's a connection error that might benefit from retry
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

export default pool;

