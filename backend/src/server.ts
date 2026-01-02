import 'dotenv/config';
import app from './app';
import pool from './shared/database/db';
import { env } from './shared/config/env';
import { createServer } from 'http';
import { initializeWebSocket } from './modules/alerts/websocket.service';
import { registerAll } from './modules/transactions/services/classification';
import { dbWriteQueueManager } from './services/infrastructure/DbWriteQueueManager';
import logger from './shared/utils/infrastructure/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const PORT = env.PORT || 8000;

const startServer = async () => {
  try {
    logger.info('[Startup] Initializing server...');

    // Test DB connection
    logger.info('[Startup] Testing Database connection...');
    await pool.query('SELECT NOW()');
    logger.info('✅ [Startup] Database connected successfully');

    // Register all classifiers and extractors
    logger.info('[Startup] Registering classifiers and extractors...');
    registerAll();
    logger.info('✅ [Startup] Classifiers and Extractors registered');

    const server = createServer(app);

    // Initialize WebSocket
    // Initialize WebSocket
    logger.info('[Startup] Initializing WebSockets...');
    const io = initializeWebSocket(server);
    (global as any).ioServer = io;
    logger.info('✅ [Startup] WebSockets initialized');

    server.listen(PORT, () => {
      logger.info(`🚀 [Startup] Server running on port ${PORT}`);
      logger.info(`👉 [Startup] Environment: ${env.NODE_ENV}`);
    });

    // Graceful Shutdown Logic
    const shutdown = async (signal: string) => {
      logger.info(`\n[${signal}] Received. Starting graceful shutdown...`);

      // 1. Stop accepting new connections
      server.close(() => {
        logger.info('✅ [Shutdown] HTTP server closed');
      });

      try {
        // 2. Drain write queues (Critical for data integrity)
        logger.info('[Shutdown] Draining DB write queues...');
        await dbWriteQueueManager.drain();
        logger.info('✅ [Shutdown] Write queues drained');

        // 3. Close DB Connection
        logger.info('[Shutdown] Closing DB pool...');
        await pool.end();
        logger.info('✅ [Shutdown] DB pool closed');

        logger.info('👋 [Shutdown] Goodbye!');
        process.exit(0);
      } catch (error) {
        logger.error('❌ [Shutdown] Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ [Startup] Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
// touch
