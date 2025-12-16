import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { metricsService } from './services/metrics.service';
import routes from './routes';
import { env } from './config/env';

const app = express();

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

// Internal Monitoring Endpoint (Admin Only - simplified protection for now)
app.get('/api/admin/metrics', (req, res) => {
  // In prod, check for Admin Header or Auth. 
  // For now, simple exposure as requested.
  res.json(metricsService.getAllMetrics());
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

export default app;
