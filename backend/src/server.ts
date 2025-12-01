import 'dotenv/config';
import app from './app';
import pool from './lib/db';
import { env } from './config/env';

const PORT = env.PORT || 8000;

const startServer = async () => {
  try {
    // Test DB connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer()
