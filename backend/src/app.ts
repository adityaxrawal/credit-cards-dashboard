import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { errorHandler } from './shared/middleware/error.middleware';
import { apiLimiter } from './shared/middleware/rateLimit.middleware';
import { metricsMiddleware } from './shared/middleware/metrics.middleware';
import { metricsService } from './modules/analytics/metrics.service';
import routes from './routes';
import { env } from './shared/config/env';

import { csrfProtection, csrfErrorHandler } from './shared/middleware/csrf.middleware';
import { CleanupService } from './services/infrastructure/CleanupService';

import * as Sentry from '@sentry/node';

// Initialize background services
CleanupService.startCleanupCron();
import { SchedulerService } from './modules/reports/scheduler.service';
SchedulerService.getInstance().init();


// Initialize Sentry
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
}

const app = express();

// Sentry Request Handler (must be first)
if (env.SENTRY_DSN) {
  app.use((Sentry as any).Handlers.requestHandler());
}

// Serve static files (including .well-known)
app.use(express.static('public'));

// Security Middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));

// Monitoring Middleware (Before Rate Limit to catch everything)
app.use(metricsMiddleware);

// Rate Limiting (per spec Section 8: 100 req/15min)
app.use('/api', apiLimiter);

// Logging & Parsing
app.use(morgan('dev', {
  skip: (req, res) => {
    // Skip logging for polling endpoints if they return 304 (Not Modified)
    if (req.originalUrl.includes('/api/gmail/jobs/') && res.statusCode === 304) {
      return true;
    }
    return false;
  }
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [DEBUG] Request Body Logger
app.use((req, res, next) => {
  if (req.path.includes('/api')) {
    console.log(`[DEBUG] ${req.method} ${req.path}`);
    if (Object.keys(req.body).length > 0) {
      // Create a copy to mask sensitive fields
      const logBody = { ...req.body };
      if (logBody.password) logBody.password = '***';
      if (logBody.token) logBody.token = '***'; // Mask token if present in body
      console.log('[DEBUG] Request Body:', JSON.stringify(logBody, null, 2));
    }
  }
  next();
});

// CSRF Protection (Must be after cookie/body parsers)
// Conditionally apply: Skip for webhook paths if any, or specific non-browser APIs if needed
app.use(csrfProtection);

// Internal Monitoring Endpoint (Admin Only - simplified protection for now)
app.get('/api/admin/metrics', (req, res) => {
  // In prod, check for Admin Header or Auth. 
  // For now, simple exposure as requested.
  res.json(metricsService.getAllMetrics());
});

// CSRF Token Endpoint
app.get('/api/csrf-token', (req, res) => {
  res.json({
    success: true,
    data: { csrfToken: req.csrfToken() }
  });
});

// Comprehensive Health Check
app.get('/health', async (req, res) => {
  const { performHealthCheck } = await import('./shared/utils/healthCheck');
  const health = await performHealthCheck();

  const statusCode = health.status === 'healthy' ? 200 : (health.status === 'degraded' ? 200 : 503);
  res.status(statusCode).json(health);
});

// Detailed Health Check (for monitoring tools)
app.get('/health/detailed', async (req, res) => {
  const { performHealthCheck, getSystemMetrics, getDatabaseStats } = await import('./shared/utils/healthCheck');

  const [health, systemMetrics, dbStats] = await Promise.all([
    performHealthCheck(),
    Promise.resolve(getSystemMetrics()),
    getDatabaseStats()
  ]);

  res.json({
    ...health,
    system: systemMetrics,
    database: dbStats
  });
});

// API Routes
app.use('/api', routes);

// 404 Catch-All for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'The requested API endpoint does not exist'
  });
});

// Error Handling
app.use(csrfErrorHandler);
if (env.SENTRY_DSN) {
  app.use((Sentry as any).Handlers.errorHandler());
}
app.use(errorHandler);

export default app;
