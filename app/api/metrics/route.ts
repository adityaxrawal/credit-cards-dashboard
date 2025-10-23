import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Redis } from '@upstash/redis';

/**
 * Metrics endpoint for system monitoring and analytics
 * 
 * @description Provides system metrics including user counts, transaction data, and queue status
 * @requires Admin API key in Authorization header
 * @returns JSON response with system metrics
 * 
 * @example
 * ```bash
 * curl -H "Authorization: Bearer your-admin-api-key" https://your-domain.com/api/metrics
 * ```
 * 
 * Response format:
 * ```json
 * {
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "system": {
 *     "uptime": "2h 30m",
 *     "memory": { "used": "150MB", "total": "512MB" },
 *     "environment": "production"
 *   },
 *   "database": {
 *     "totalUsers": 150,
 *     "totalCards": 300,
 *     "totalTransactions": 5000,
 *     "totalStatements": 120
 *   },
 *   "realtime": {
 *     "activeConnections": 25,
 *     "totalEvents": 1500
 *   },
 *   "queue": {
 *     "pendingJobs": 5,
 *     "completedJobs": 2500,
 *     "failedJobs": 10
 *   }
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const adminApiKey = process.env.ADMIN_API_KEY;
    
    if (!adminApiKey) {
      return NextResponse.json(
        { error: 'Admin API key not configured' },
        { status: 500 }
      );
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }
    
    const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (providedKey !== adminApiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 403 }
      );
    }
    
    // Initialize metrics object
    const metrics = {
      timestamp: new Date().toISOString(),
      responseTime: 0,
      system: {
        uptime: process.uptime ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : 'N/A',
        memory: process.memoryUsage ? {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
        } : { used: 'N/A', total: 'N/A', rss: 'N/A' },
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform
      },
      database: {
        totalUsers: 0,
        totalCards: 0,
        totalTransactions: 0,
        totalStatements: 0,
        totalSpendingLimits: 0,
        totalCardPerks: 0
      },
      realtime: {
        activeConnections: 0,
        totalEvents: 0
      },
      queue: {
        pendingJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        queueLength: 0
      }
    };
    
    // Get database metrics
    try {
      const supabase = createAdminClient();
      
      // Get user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      metrics.database.totalUsers = userCount || 0;
      
      // Get card count
      const { count: cardCount } = await supabase
        .from('credit_cards')
        .select('*', { count: 'exact', head: true });
      metrics.database.totalCards = cardCount || 0;
      
      // Get current transactions count
      const { count: currentTransactionCount } = await supabase
        .from('current_transactions')
        .select('*', { count: 'exact', head: true });
      
      // Get statement transactions count
      const { count: statementTransactionCount } = await supabase
        .from('statement_transactions')
        .select('*', { count: 'exact', head: true });
      
      metrics.database.totalTransactions = (currentTransactionCount || 0) + (statementTransactionCount || 0);
      
      // Get statements count
      const { count: statementCount } = await supabase
        .from('statements')
        .select('*', { count: 'exact', head: true });
      metrics.database.totalStatements = statementCount || 0;
      
      // Get spending limits count
      const { count: spendingLimitCount } = await supabase
        .from('spending_limits')
        .select('*', { count: 'exact', head: true });
      metrics.database.totalSpendingLimits = spendingLimitCount || 0;
      
      // Get card perks count
      const { count: cardPerkCount } = await supabase
        .from('card_perks')
        .select('*', { count: 'exact', head: true });
      metrics.database.totalCardPerks = cardPerkCount || 0;
      
    } catch (dbError) {
      console.error('Database metrics error:', dbError);
      // Continue with other metrics even if database fails
    }
    
    // Get Redis/Queue metrics
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        
        // Get queue length
        const queueLength = await redis.llen('processing_queue') || 0;
        metrics.queue.queueLength = queueLength;
        
        // Get job statistics (if stored in Redis)
        const completedJobs = await redis.get('stats:completed_jobs') || 0;
        const failedJobs = await redis.get('stats:failed_jobs') || 0;
        
        metrics.queue.completedJobs = Number(completedJobs);
        metrics.queue.failedJobs = Number(failedJobs);
        metrics.queue.pendingJobs = queueLength;
        
        // Get active SSE connections count (if stored in Redis)
        const activeConnections = await redis.get('stats:active_connections') || 0;
        metrics.realtime.activeConnections = Number(activeConnections);
        
        // Get total events count (if stored in Redis)
        const totalEvents = await redis.get('stats:total_events') || 0;
        metrics.realtime.totalEvents = Number(totalEvents);
        
      }
    } catch (redisError) {
      console.error('Redis metrics error:', redisError);
      // Continue with other metrics even if Redis fails
    }
    
    // Calculate response time
    metrics.responseTime = Date.now() - startTime;
    
    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}