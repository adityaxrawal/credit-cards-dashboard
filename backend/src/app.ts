import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error.middleware';
import routes from './routes';
import { env } from './config/env';

const app = express();

// Middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));
// Filter out GET /api/gmail/jobs/* logs to reduce noise
app.use(morgan('dev', {
  skip: (req, res) => req.method === 'GET' && req.url.startsWith('/api/gmail/jobs/')
}));
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
