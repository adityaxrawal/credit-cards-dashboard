import 'dotenv/config';
import app from './app';
import pool from './lib/db';
import { env } from './config/env';
import { HealthChecker } from './utils/health';
import { shutdownHandler } from './utils/shutdown';

const PORT = env.PORT || 8000;

const startServer = async () => {
  try {
    console.log('🔍 Running startup health checks...');
    const health = await new HealthChecker().checkAll();

    if (health.status === 'unhealthy') {
      console.error('❌ Critical services unavailable:', JSON.stringify(health, null, 2));
      process.exit(1);
    }

    if (health.status === 'degraded') {
      console.warn('⚠️ Some services degraded, starting anyway:', JSON.stringify(health, null, 2));
    } else {
      console.log('✅ All services healthy');
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => shutdownHandler.shutdown('SIGTERM', server));
    process.on('SIGINT', () => shutdownHandler.shutdown('SIGINT', server));

  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};

startServer();
