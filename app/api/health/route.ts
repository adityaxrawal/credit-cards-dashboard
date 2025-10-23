import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Redis } from '@upstash/redis';

/**
 * Health check endpoint for monitoring system status
 * 
 * @description Performs comprehensive health checks on all critical system components
 * @returns JSON response with health status and individual component checks
 * 
 * @example
 * ```bash
 * curl https://your-domain.com/api/health
 * ```
 * 
 * Response format:
 * ```json
 * {
 *   "status": "healthy" | "unhealthy",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "checks": {
 *     "database": true,
 *     "redis": true,
 *     "env": true
 *   },
 *   "details": {
 *     "database": "Connected to Supabase",
 *     "redis": "Connected to Upstash Redis",
 *     "env": "All required environment variables loaded"
 *   }
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  const checks = {
    database: false,
    redis: false,
    env: false
  };
  
  const details: Record<string, string> = {};
  
  try {
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'ENCRYPTION_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length === 0) {
      checks.env = true;
      details.env = 'All required environment variables loaded';
    } else {
      details.env = `Missing environment variables: ${missingEnvVars.join(', ')}`;
    }
    
    // Check Supabase database connectivity
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .single();
      
      if (!error) {
        checks.database = true;
        details.database = 'Connected to Supabase';
      } else {
        details.database = `Database error: ${error.message}`;
      }
    } catch (dbError) {
      details.database = `Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`;
    }
    
    // Check Redis connectivity
    try {
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        
        const pingResult = await redis.ping();
        
        if (pingResult === 'PONG') {
          checks.redis = true;
          details.redis = 'Connected to Upstash Redis';
        } else {
          details.redis = 'Redis ping failed';
        }
      } else {
        details.redis = 'Redis configuration missing';
      }
    } catch (redisError) {
      details.redis = `Redis connection failed: ${redisError instanceof Error ? redisError.message : 'Unknown error'}`;
    }
    
    // Determine overall health status
    const isHealthy = Object.values(checks).every(check => check === true);
    const responseTime = Date.now() - startTime;
    
    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy' as const,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks,
      details,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
    
    return NextResponse.json(
      response,
      { 
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        checks,
        details: {
          ...details,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}