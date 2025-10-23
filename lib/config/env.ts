/**
 * Environment Configuration and Validation
 * 
 * This module validates all required environment variables at runtime
 * and provides a typed configuration object for the application.
 */

export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
  };
  upstash: {
    redisUrl: string;
    redisToken: string;
    qstashToken: string;
  };
  app: {
    url: string;
    encryptionKey: string;
  };
}

/**
 * Validates that a required environment variable exists and is not empty
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please check your .env.local file and ensure ${name} is set.`
    );
  }
  return value.trim();
}

/**
 * Validates optional environment variable with fallback
 */
function optionalEnv(name: string, fallback: string = ''): string {
  const value = process.env[name];
  return value?.trim() || fallback;
}

/**
 * Validates and creates the application configuration object
 */
function createConfig(): AppConfig {
  try {
    // Validate Supabase configuration
    const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    // Validate Google OAuth configuration
    const googleClientId = requireEnv('GOOGLE_CLIENT_ID');
    const googleClientSecret = requireEnv('GOOGLE_CLIENT_SECRET');

    // Validate Upstash configuration
    const upstashRedisUrl = requireEnv('UPSTASH_REDIS_REST_URL');
    const upstashRedisToken = requireEnv('UPSTASH_REDIS_REST_TOKEN');
    const upstashQstashToken = requireEnv('QSTASH_TOKEN');

    // Validate application configuration
    const appUrl = requireEnv('NEXT_PUBLIC_URL');
    const encryptionKey = requireEnv('ENCRYPTION_KEY');

    // Validate encryption key format (should be 32-character hex string)
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error(
        'ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes). ' +
        'Generate one using: openssl rand -hex 32'
      );
    }

    // Validate URL formats
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !supabaseUrl.startsWith('https://')) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL');
    }

    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      throw new Error('NEXT_PUBLIC_URL must be a valid HTTP/HTTPS URL');
    }

    if (!upstashRedisUrl.startsWith('https://')) {
      throw new Error('UPSTASH_REDIS_REST_URL must be a valid HTTPS URL');
    }

    return {
      supabase: {
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        serviceRoleKey: supabaseServiceRoleKey,
      },
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
      upstash: {
        redisUrl: upstashRedisUrl,
        redisToken: upstashRedisToken,
        qstashToken: upstashQstashToken,
      },
      app: {
        url: appUrl,
        encryptionKey: encryptionKey,
      },
    };
  } catch (error) {
    console.error('❌ Environment Configuration Error:', error);
    throw error;
  }
}

/**
 * Validated application configuration
 * This will throw an error if any required environment variables are missing
 */
export const config: AppConfig = createConfig();

/**
 * Helper function to check if we're in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Helper function to check if we're in production mode
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Helper function to check if we're in test mode
 */
export const isTest = process.env.NODE_ENV === 'test';

/**
 * Log configuration status (without sensitive values)
 */
if (isDevelopment) {
  console.log('✅ Environment configuration loaded successfully');
  console.log('📊 Configuration status:', {
    supabase: {
      url: config.supabase.url,
      hasAnonKey: !!config.supabase.anonKey,
      hasServiceRoleKey: !!config.supabase.serviceRoleKey,
    },
    google: {
      hasClientId: !!config.google.clientId,
      hasClientSecret: !!config.google.clientSecret,
    },
    upstash: {
      url: config.upstash.redisUrl,
      hasRedisToken: !!config.upstash.redisToken,
      hasQstashToken: !!config.upstash.qstashToken,
    },
    app: {
      url: config.app.url,
      hasEncryptionKey: !!config.app.encryptionKey,
    },
  });
}