import 'dotenv/config';
import app from './app';
import pool from './lib/db';
import { env } from './config/env';
import { createServer } from 'http';
import { initializeWebSocket } from './services/webSocketService';
import { registerAll } from './services/classification';

const PORT = env.PORT || 8000;

const startServer = async () => {
  try {
    // Test DB connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    // Register all classifiers and extractors
    registerAll();
    console.log('✅ Classifiers and Extractors registered');

    const server = createServer(app);

    // Initialize WebSocket
    const io = initializeWebSocket(server);
    (global as any).ioServer = io;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
