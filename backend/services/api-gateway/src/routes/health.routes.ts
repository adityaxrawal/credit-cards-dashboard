import { Router, Request, Response } from 'express';
import { supabase } from 'shared/database/supabase';
import redis from 'shared/cache/redis';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint to verify API and dependencies status
 */
router.get('/', async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown',
      cache: 'unknown',
    },
  };

  try {
    // Check Supabase connection
    const { error: dbError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    health.services.database = dbError ? 'error' : 'ok';

    // Check Redis connection
    try {
      await redis.ping();
      health.services.cache = 'ok';
    } catch (redisError) {
      health.services.cache = 'error';
    }

    // Determine overall status
    const allServicesOk = Object.values(health.services).every(s => s === 'ok');
    health.status = allServicesOk ? 'ok' : 'degraded';

    const statusCode = allServicesOk ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    health.status = 'error';
    res.status(503).json(health);
  }
});

export default router;
