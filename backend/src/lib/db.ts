import { Pool } from 'pg';
import { env } from '../config/env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,                       // Increased from default 10 for concurrent batches
  idleTimeoutMillis: 30000,      // 30s idle timeout
  connectionTimeoutMillis: 10000, // 10s connection timeout
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;
