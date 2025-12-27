import 'dotenv/config';
import app from './app';
import pool from './lib/db';
import { env } from './config/env';
import { createServer } from 'http';
import { initializeWebSocket } from './services/alerts/WebSocketService';
import { registerAll } from './services/transactions/classification';

const PORT = env.PORT || 8000;

const startServer = async () => {
  try {
    console.log('[Startup] Initializing server...');

    // Test DB connection
    console.log('[Startup] Testing Database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ [Startup] Database connected successfully');

    // Register all classifiers and extractors
    console.log('[Startup] Registering classifiers and extractors...');
    registerAll();
    console.log('✅ [Startup] Classifiers and Extractors registered');

    const server = createServer(app);

    // Initialize WebSocket
    console.log('[Startup] Initializing WebSockets...');
    const io = initializeWebSocket(server);
    (global as any).ioServer = io;
    console.log('✅ [Startup] WebSockets initialized');

    server.listen(PORT, () => {
      console.log(`🚀 [Startup] Server running on port ${PORT}`);
      console.log(`👉 [Startup] Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ [Startup] Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
