import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
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

// Rate Limiting (per spec Section 8: 100 req/15min)
app.use('/api', apiLimiter);

// Logging & Parsing
app.use(morgan('dev'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// Error Handling
app.use(errorHandler);

export default app;
