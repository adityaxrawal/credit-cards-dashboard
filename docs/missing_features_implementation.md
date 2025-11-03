# Missing Features Implementation Guide

**Complete End-to-End Implementation Plan**  
**Generated:** November 3, 2025  
**Version:** 1.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Pre-Implementation Setup](#pre-implementation-setup)
3. [Phase 1: Critical Backend Services](#phase-1-critical-backend-services)
4. [Phase 2: Authentication & Security](#phase-2-authentication--security)
5. [Phase 3: Database & Migrations](#phase-3-database--migrations)
6. [Phase 4: Email Integration Pipeline](#phase-4-email-integration-pipeline)
7. [Phase 5: Frontend API Integration](#phase-5-frontend-api-integration)
8. [Phase 6: Advanced Features](#phase-6-advanced-features)
9. [Phase 7: Testing Implementation](#phase-7-testing-implementation)
10. [Phase 8: Deployment & CI/CD](#phase-8-deployment--cicd)
11. [Phase 9: Monitoring & Optimization](#phase-9-monitoring--optimization)
12. [Implementation Checklist](#implementation-checklist)

---

## 🎯 Overview

This guide provides step-by-step instructions to implement all missing features identified in the Credit Card Dashboard project. Each section includes:

- **Detailed implementation steps**
- **Complete code examples**
- **Configuration instructions**
- **Testing procedures**
- **Verification steps**

### Implementation Timeline

- **Critical Features (Weeks 1-4):** Backend services, authentication, database
- **Email Integration (Weeks 5-8):** Gmail pipeline, regex-based transaction extraction
- **Frontend Integration (Weeks 9-10):** Connect UI to APIs
- **Advanced Features (Weeks 11-13):** Data-driven analytics, reports
- **Testing & QA (Weeks 14-15):** Comprehensive testing
- **Deployment (Week 16):** Production deployment

---

## 🚀 Pre-Implementation Setup

### 1. Environment Setup

#### Install Required Dependencies

```bash
# Backend - API Gateway
cd backend/services/api-gateway
npm install puppeteer pdf-parse sharp
npm install -D @types/puppeteer

# Backend - Shared
cd ../../shared
npm install winston bull ioredis

# Frontend
cd ../../../frontend
npm install @tanstack/react-query axios react-hot-toast
npm install framer-motion recharts
npm install @headlessui/react @heroicons/react
```

#### Create Missing Environment Files

```bash
# Root .env
cat > .env << 'EOF'
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
DATABASE_URL=your_database_url

# Redis
REDIS_URL=your_redis_url
UPSTASH_REDIS_REST_URL=your_rest_url
UPSTASH_REDIS_REST_TOKEN=your_token

# Auth
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
ENCRYPTION_KEY=your_32_byte_hex_encryption_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Google Cloud
GCP_PROJECT_ID=your_gcp_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Services
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
API_GATEWAY_PORT=3001
GMAIL_SERVICE_PORT=3004
ALERT_SERVICE_PORT=3005
ANALYTICS_SERVICE_PORT=3006
EXTRACTION_SERVICE_PORT=3007

NODE_ENV=development
ENABLE_BACKGROUND_JOBS=true
EOF

# Backend API Gateway .env
cp .env backend/services/api-gateway/.env

# Frontend .env.local
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EOF
```

#### Generate Encryption Key

```bash
# Generate 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output to ENCRYPTION_KEY in .env
```

---

## 🔧 Phase 1: Critical Backend Services

### 1.1 Implement Alert Service

Create the complete alert service microservice.

#### File: `backend/services/alert-service/package.json`

```json
{
  "name": "alert-service",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.0",
    "ioredis": "^5.3.2",
    "nodemailer": "^6.9.7",
    "twilio": "^4.19.0",
    "bull": "^4.12.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/nodemailer": "^6.4.14",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.2"
  }
}
```

#### File: `backend/services/alert-service/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### File: `backend/services/alert-service/src/index.ts`

```typescript
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { alertQueue } from "./queue/alert-queue";
import { setupWorker } from "./workers/alert-worker";
import { logger } from "./utils/logger";
import alertRoutes from "./routes/alert.routes";

dotenv.config();

const app: Application = express();
const PORT = process.env.ALERT_SERVICE_PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "alert-service",
    timestamp: new Date().toISOString(),
    queue: {
      active: alertQueue.getActiveCount(),
      waiting: alertQueue.getWaitingCount(),
      completed: alertQueue.getCompletedCount(),
      failed: alertQueue.getFailedCount(),
    },
  });
});

// Routes
app.use("/alerts", alertRoutes);

// Start worker
setupWorker();

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`Alert Service running on port ${PORT}`);
  });
}

export default app;
```

#### File: `backend/services/alert-service/src/utils/logger.ts`

```typescript
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "alert-service" },
  transports: [
    new winston.transports.File({
      filename: "logs/alert-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/alert-combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}
```

#### File: `backend/services/alert-service/src/types/alert.types.ts`

```typescript
export interface Alert {
  id: string;
  user_id: string;
  type: AlertType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: AlertChannel[];
  status: "pending" | "sent" | "failed" | "dismissed";
  created_at: string;
  sent_at?: string;
  read_at?: string;
}

export type AlertType =
  | "budget_exceeded"
  | "budget_warning"
  | "bill_due"
  | "large_transaction"
  | "unusual_activity"
  | "card_expiring"
  | "subscription_renewal"
  | "payment_failed"
  | "credit_limit_reached"
  | "duplicate_transaction";

export type AlertChannel = "email" | "sms" | "push" | "in_app";

export interface AlertPreferences {
  user_id: string;
  budget_alerts: boolean;
  bill_reminders: boolean;
  transaction_alerts: boolean;
  security_alerts: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  minimum_transaction_amount?: number;
}

export interface AlertQueueJob {
  alert: Alert;
  preferences: AlertPreferences;
  userEmail: string;
  userPhone?: string;
}
```

#### File: `backend/services/alert-service/src/queue/alert-queue.ts`

```typescript
import Queue from "bull";
import Redis from "ioredis";
import { AlertQueueJob } from "../types/alert.types";

const redisConfig = {
  redis: process.env.REDIS_URL || "redis://localhost:6379",
};

export const alertQueue = new Queue<AlertQueueJob>("alerts", redisConfig);

// Queue event handlers
alertQueue.on("completed", (job, result) => {
  console.log(`Alert ${job.id} completed:`, result);
});

alertQueue.on("failed", (job, err) => {
  console.error(`Alert ${job?.id} failed:`, err);
});

alertQueue.on("error", (error) => {
  console.error("Queue error:", error);
});
```

#### File: `backend/services/alert-service/src/workers/alert-worker.ts`

```typescript
import { alertQueue } from "../queue/alert-queue";
import { AlertQueueJob } from "../types/alert.types";
import { sendEmailAlert } from "../services/email.service";
import { sendSMSAlert } from "../services/sms.service";
import { sendPushAlert } from "../services/push.service";
import { saveInAppAlert } from "../services/in-app.service";
import { logger } from "../utils/logger";

export function setupWorker() {
  alertQueue.process(5, async (job) => {
    const { alert, preferences, userEmail, userPhone } = job.data;

    logger.info(`Processing alert ${alert.id} for user ${alert.user_id}`);

    const results = {
      email: null as any,
      sms: null as any,
      push: null as any,
      in_app: null as any,
    };

    try {
      // Check quiet hours
      if (isQuietHours(preferences)) {
        logger.info(`Quiet hours active, queuing alert for later`);
        return { status: "deferred", results };
      }

      // Send through enabled channels
      const promises: Promise<any>[] = [];

      if (alert.channels.includes("email") && preferences.email_enabled) {
        promises.push(
          sendEmailAlert(userEmail, alert)
            .then((result) => {
              results.email = result;
              return result;
            })
            .catch((error) => {
              logger.error(`Email alert failed: ${error.message}`);
              results.email = { error: error.message };
              throw error;
            })
        );
      }

      if (
        alert.channels.includes("sms") &&
        preferences.sms_enabled &&
        userPhone
      ) {
        promises.push(
          sendSMSAlert(userPhone, alert)
            .then((result) => {
              results.sms = result;
              return result;
            })
            .catch((error) => {
              logger.error(`SMS alert failed: ${error.message}`);
              results.sms = { error: error.message };
            })
        );
      }

      if (alert.channels.includes("push") && preferences.push_enabled) {
        promises.push(
          sendPushAlert(alert.user_id, alert)
            .then((result) => {
              results.push = result;
              return result;
            })
            .catch((error) => {
              logger.error(`Push alert failed: ${error.message}`);
              results.push = { error: error.message };
            })
        );
      }

      if (alert.channels.includes("in_app")) {
        promises.push(
          saveInAppAlert(alert)
            .then((result) => {
              results.in_app = result;
              return result;
            })
            .catch((error) => {
              logger.error(`In-app alert failed: ${error.message}`);
              results.in_app = { error: error.message };
            })
        );
      }

      await Promise.allSettled(promises);

      logger.info(`Alert ${alert.id} processed successfully`);
      return { status: "sent", results };
    } catch (error) {
      logger.error(`Alert ${alert.id} failed:`, error);
      throw error;
    }
  });

  logger.info("Alert worker started");
}

function isQuietHours(preferences: any): boolean {
  if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = preferences.quiet_hours_start
    .split(":")
    .map(Number);
  const [endHour, endMinute] = preferences.quiet_hours_end
    .split(":")
    .map(Number);

  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    return currentTime >= startTime || currentTime <= endTime;
  }
}
```

#### File: `backend/services/alert-service/src/services/email.service.ts`

```typescript
import nodemailer from "nodemailer";
import { Alert } from "../types/alert.types";
import { logger } from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmailAlert(
  email: string,
  alert: Alert
): Promise<any> {
  try {
    const htmlContent = generateEmailHTML(alert);

    const info = await transporter.sendMail({
      from: `"Credit Card Tracker" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `🔔 ${alert.title}`,
      html: htmlContent,
    });

    logger.info(`Email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    logger.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
}

function generateEmailHTML(alert: Alert): string {
  const severityColors = {
    low: "#10B981",
    medium: "#F59E0B",
    high: "#EF4444",
    critical: "#DC2626",
  };

  const color = severityColors[alert.severity];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${alert.title}</h2>
        </div>
        <div class="content">
          <p>${alert.message}</p>
          ${
            alert.data
              ? `<pre>${JSON.stringify(alert.data, null, 2)}</pre>`
              : ""
          }
          <a href="${process.env.FRONTEND_URL}/alerts/${
    alert.id
  }" class="button">View Details</a>
        </div>
        <div class="footer">
          <p>Credit Card Tracker - Automated Alert System</p>
          <p><a href="${
            process.env.FRONTEND_URL
          }/settings">Manage Alert Preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
```

#### File: `backend/services/alert-service/src/services/sms.service.ts`

```typescript
import twilio from "twilio";
import { Alert } from "../types/alert.types";
import { logger } from "../utils/logger";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMSAlert(phone: string, alert: Alert): Promise<any> {
  try {
    if (!process.env.TWILIO_PHONE_NUMBER) {
      logger.warn("Twilio not configured, skipping SMS");
      return { success: false, error: "SMS not configured" };
    }

    const message = `${alert.title}\n\n${alert.message}\n\nView: ${process.env.FRONTEND_URL}/alerts/${alert.id}`;

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    logger.info(`SMS sent to ${phone}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    logger.error(`Failed to send SMS to ${phone}:`, error);
    throw error;
  }
}
```

#### File: `backend/services/alert-service/src/services/push.service.ts`

```typescript
import { Alert } from "../types/alert.types";
import { logger } from "../utils/logger";

// Placeholder for push notification service (Firebase, OneSignal, etc.)
export async function sendPushAlert(
  userId: string,
  alert: Alert
): Promise<any> {
  try {
    // TODO: Implement push notification service
    logger.info(`Push notification would be sent to user ${userId}`);

    // Example Firebase implementation:
    // const message = {
    //   notification: {
    //     title: alert.title,
    //     body: alert.message,
    //   },
    //   data: {
    //     alertId: alert.id,
    //     type: alert.type,
    //   },
    //   token: userDeviceToken,
    // };
    //
    // const response = await admin.messaging().send(message);

    return { success: true, message: "Push notification placeholder" };
  } catch (error: any) {
    logger.error(`Failed to send push notification to user ${userId}:`, error);
    throw error;
  }
}
```

#### File: `backend/services/alert-service/src/services/in-app.service.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { Alert } from "../types/alert.types";
import { logger } from "../utils/logger";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function saveInAppAlert(alert: Alert): Promise<any> {
  try {
    const { data, error } = await supabase
      .from("alerts")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", alert.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`In-app alert saved for alert ${alert.id}`);
    return { success: true, data };
  } catch (error: any) {
    logger.error(`Failed to save in-app alert ${alert.id}:`, error);
    throw error;
  }
}
```

#### File: `backend/services/alert-service/src/routes/alert.routes.ts`

```typescript
import { Router, Request, Response } from "express";
import { alertQueue } from "../queue/alert-queue";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * POST /alerts/trigger
 * Trigger a new alert
 */
router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const { user_id, type, severity, title, message, data, channels } =
      req.body;

    // Create alert in database
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .insert([
        {
          user_id,
          type,
          severity: severity || "medium",
          title,
          message,
          data,
          channels: channels || ["email", "in_app"],
          status: "pending",
        },
      ])
      .select()
      .single();

    if (alertError) throw alertError;

    // Get user preferences and contact info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email, phone, alert_preferences")
      .eq("id", user_id)
      .single();

    if (userError) throw userError;

    // Add to queue
    await alertQueue.add({
      alert,
      preferences: user.alert_preferences || {},
      userEmail: user.email,
      userPhone: user.phone,
    });

    res.json({ success: true, alert });
  } catch (error: any) {
    console.error("Error triggering alert:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /alerts/queue/stats
 * Get queue statistics
 */
router.get("/queue/stats", async (_req: Request, res: Response) => {
  try {
    const [active, waiting, completed, failed] = await Promise.all([
      alertQueue.getActiveCount(),
      alertQueue.getWaitingCount(),
      alertQueue.getCompletedCount(),
      alertQueue.getFailedCount(),
    ]);

    res.json({
      success: true,
      stats: {
        active,
        waiting,
        completed,
        failed,
        total: active + waiting + completed + failed,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

#### File: `backend/services/alert-service/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3005

CMD ["npm", "start"]
```

### 1.2 Implement Analytics Service

Create the analytics microservice for computing metrics and insights.

#### File: `backend/services/analytics-service/package.json`

```json
{
  "name": "analytics-service",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.0",
    "ioredis": "^5.3.2",
    "bull": "^4.12.0",
    "date-fns": "^2.30.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.2"
  }
}
```

#### File: `backend/services/analytics-service/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### File: `backend/services/analytics-service/src/index.ts`

```typescript
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { setupWorker } from "./workers/analytics-worker";
import { logger } from "./utils/logger";
import analyticsRoutes from "./routes/analytics.routes";

dotenv.config();

const app: Application = express();
const PORT = process.env.ANALYTICS_SERVICE_PORT || 3006;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "analytics-service",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/analytics", analyticsRoutes);

// Start worker
setupWorker();

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`Analytics Service running on port ${PORT}`);
  });
}

export default app;
```

#### File: `backend/services/analytics-service/src/workers/analytics-worker.ts`

```typescript
import cron from "node-cron";
import { computeUserAnalytics } from "../services/analytics-compute.service";
import { cacheAnalytics } from "../services/cache.service";
import { logger } from "../utils/logger";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export function setupWorker() {
  // Compute analytics every hour
  cron.schedule("0 * * * *", async () => {
    logger.info("Starting analytics computation job");

    try {
      // Get all active users
      const { data: users, error } = await supabase
        .from("users")
        .select("id")
        .eq("is_active", true);

      if (error) throw error;

      for (const user of users || []) {
        try {
          const analytics = await computeUserAnalytics(user.id);
          await cacheAnalytics(user.id, analytics);
          logger.info(`Analytics computed for user ${user.id}`);
        } catch (error: any) {
          logger.error(
            `Failed to compute analytics for user ${user.id}:`,
            error
          );
        }
      }

      logger.info("Analytics computation completed");
    } catch (error) {
      logger.error("Analytics computation job failed:", error);
    }
  });

  logger.info("Analytics worker scheduled (runs hourly)");
}
```

#### File: `backend/services/analytics-service/src/services/analytics-compute.service.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachMonthOfInterval,
  subYears,
  startOfYear,
} from "date-fns";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function computeUserAnalytics(userId: string) {
  const now = new Date();

  const analytics = {
    userId,
    computedAt: now.toISOString(),
    currentMonth: await computeMonthlyAnalytics(userId, now),
    previousMonth: await computeMonthlyAnalytics(userId, subMonths(now, 1)),
    currentWeek: await computeWeeklyAnalytics(userId, now),
    yearToDate: await computeYearToDateAnalytics(userId, now),
    categoryBreakdown: await computeCategoryBreakdown(userId, now),
    merchantAnalysis: await computeMerchantAnalysis(userId, now),
    cardUtilization: await computeCardUtilization(userId, now),
    spendingTrends: await computeSpendingTrends(userId, now),
    insights: await generateInsights(userId, now),
  };

  return analytics;
}

async function computeMonthlyAnalytics(userId: string, date: Date) {
  const startDate = startOfMonth(date);
  const endDate = endOfMonth(date);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
    .lte("transaction_date", format(endDate, "yyyy-MM-dd"));

  if (!transactions || transactions.length === 0) {
    return {
      totalSpent: 0,
      totalEarned: 0,
      netCashflow: 0,
      transactionCount: 0,
      averageTransaction: 0,
      topCategory: null,
      topMerchant: null,
    };
  }

  const debits = transactions.filter((t) => t.amount < 0);
  const credits = transactions.filter((t) => t.amount > 0);

  const totalSpent = Math.abs(debits.reduce((sum, t) => sum + t.amount, 0));
  const totalEarned = credits.reduce((sum, t) => sum + t.amount, 0);

  // Category analysis
  const categoryMap = new Map<string, number>();
  debits.forEach((t) => {
    const category = t.category || "Other";
    categoryMap.set(
      category,
      (categoryMap.get(category) || 0) + Math.abs(t.amount)
    );
  });
  const topCategory = Array.from(categoryMap.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];

  // Merchant analysis
  const merchantMap = new Map<string, number>();
  debits.forEach((t) => {
    const merchant = t.merchant_name || "Unknown";
    merchantMap.set(
      merchant,
      (merchantMap.get(merchant) || 0) + Math.abs(t.amount)
    );
  });
  const topMerchant = Array.from(merchantMap.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];

  return {
    totalSpent,
    totalEarned,
    netCashflow: totalEarned - totalSpent,
    transactionCount: transactions.length,
    averageTransaction: totalSpent / debits.length || 0,
    topCategory: topCategory
      ? { name: topCategory[0], amount: topCategory[1] }
      : null,
    topMerchant: topMerchant
      ? { name: topMerchant[0], amount: topMerchant[1] }
      : null,
  };
}

async function computeWeeklyAnalytics(userId: string, date: Date) {
  const startDate = startOfWeek(date, { weekStartsOn: 1 });
  const endDate = endOfWeek(date, { weekStartsOn: 1 });

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, transaction_date")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
    .lte("transaction_date", format(endDate, "yyyy-MM-dd"));

  const dailySpending = eachDayOfInterval({
    start: startDate,
    end: endDate,
  }).map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayTransactions =
      transactions?.filter((t) => t.transaction_date.startsWith(dayStr)) || [];
    const amount = Math.abs(
      dayTransactions.reduce((sum, t) => sum + t.amount, 0)
    );

    return {
      date: dayStr,
      amount,
      transactionCount: dayTransactions.length,
    };
  });

  return {
    totalSpent: dailySpending.reduce((sum, d) => sum + d.amount, 0),
    dailyAverage:
      dailySpending.reduce((sum, d) => sum + d.amount, 0) /
      dailySpending.length,
    dailySpending,
  };
}

async function computeYearToDateAnalytics(userId: string, date: Date) {
  const startDate = startOfYear(date);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
    .lte("transaction_date", format(date, "yyyy-MM-dd"));

  const totalSpent = Math.abs(
    transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
  );

  const monthlyData = eachMonthOfInterval({
    start: startDate,
    end: date,
  }).map((month) => {
    const monthStr = format(month, "yyyy-MM");
    const monthTransactions =
      transactions?.filter((t) => t.transaction_date.startsWith(monthStr)) ||
      [];
    return {
      month: monthStr,
      amount: Math.abs(monthTransactions.reduce((sum, t) => sum + t.amount, 0)),
      transactionCount: monthTransactions.length,
    };
  });

  return {
    totalSpent,
    monthlyAverage: totalSpent / monthlyData.length || 0,
    monthlyData,
    transactionCount: transactions?.length || 0,
  };
}

async function computeCategoryBreakdown(userId: string, date: Date) {
  const startDate = startOfMonth(date);
  const endDate = endOfMonth(date);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
    .lte("transaction_date", format(endDate, "yyyy-MM-dd"));

  const categoryMap = new Map<string, { amount: number; count: number }>();

  transactions?.forEach((t) => {
    const category = t.category || "Other";
    const existing = categoryMap.get(category) || { amount: 0, count: 0 };
    categoryMap.set(category, {
      amount: existing.amount + Math.abs(t.amount),
      count: existing.count + 1,
    });
  });

  const totalSpent = Array.from(categoryMap.values()).reduce(
    (sum, cat) => sum + cat.amount,
    0
  );

  return Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      percentage: (data.amount / totalSpent) * 100,
      transactionCount: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function computeMerchantAnalysis(userId: string, date: Date) {
  const startDate = subMonths(date, 3);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("merchant_name, amount, transaction_date")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
    .lte("transaction_date", format(date, "yyyy-MM-dd"));

  const merchantMap = new Map<
    string,
    { amount: number; count: number; lastVisit: string }
  >();

  transactions?.forEach((t) => {
    const merchant = t.merchant_name || "Unknown";
    const existing = merchantMap.get(merchant) || {
      amount: 0,
      count: 0,
      lastVisit: t.transaction_date,
    };
    merchantMap.set(merchant, {
      amount: existing.amount + Math.abs(t.amount),
      count: existing.count + 1,
      lastVisit:
        t.transaction_date > existing.lastVisit
          ? t.transaction_date
          : existing.lastVisit,
    });
  });

  return Array.from(merchantMap.entries())
    .map(([name, data]) => ({
      name,
      totalSpent: data.amount,
      visitCount: data.count,
      averageSpent: data.amount / data.count,
      lastVisit: data.lastVisit,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 20);
}

async function computeCardUtilization(userId: string, date: Date) {
  const startDate = startOfMonth(date);
  const endDate = endOfMonth(date);

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!cards || cards.length === 0) {
    return [];
  }

  const utilizationData = await Promise.all(
    cards.map(async (card) => {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("card_id", card.id)
        .lt("amount", 0)
        .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
        .lte("transaction_date", format(endDate, "yyyy-MM-dd"));

      const totalSpent = Math.abs(
        transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
      );

      const utilizationRate = card.credit_limit
        ? (totalSpent / card.credit_limit) * 100
        : 0;

      return {
        cardId: card.id,
        cardName: card.card_name,
        totalSpent,
        creditLimit: card.credit_limit,
        utilizationRate,
        transactionCount: transactions?.length || 0,
      };
    })
  );

  return utilizationData.sort((a, b) => b.totalSpent - a.totalSpent);
}

async function computeSpendingTrends(userId: string, date: Date) {
  const startDate = subMonths(date, 12);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, transaction_date, category")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("transaction_date", format(startDate, "yyyy-MM-dd"))
    .lte("transaction_date", format(date, "yyyy-MM-dd"));

  const monthlyTrends = eachMonthOfInterval({
    start: startDate,
    end: date,
  }).map((month) => {
    const monthStr = format(month, "yyyy-MM");
    const monthTransactions =
      transactions?.filter((t) => t.transaction_date.startsWith(monthStr)) ||
      [];

    return {
      month: monthStr,
      totalSpent: Math.abs(
        monthTransactions.reduce((sum, t) => sum + t.amount, 0)
      ),
      transactionCount: monthTransactions.length,
      averageTransaction:
        monthTransactions.length > 0
          ? Math.abs(monthTransactions.reduce((sum, t) => sum + t.amount, 0)) /
            monthTransactions.length
          : 0,
    };
  });

  // Calculate trend
  const recentMonths = monthlyTrends.slice(-3);
  const previousMonths = monthlyTrends.slice(-6, -3);

  const recentAvg =
    recentMonths.reduce((sum, m) => sum + m.totalSpent, 0) /
    recentMonths.length;
  const previousAvg =
    previousMonths.reduce((sum, m) => sum + m.totalSpent, 0) /
    previousMonths.length;

  const trendPercentage =
    previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

  return {
    monthlyTrends,
    trend:
      trendPercentage > 5
        ? "increasing"
        : trendPercentage < -5
        ? "decreasing"
        : "stable",
    trendPercentage,
    recentAverage: recentAvg,
    previousAverage: previousAvg,
  };
}

async function generateInsights(userId: string, date: Date) {
  const insights: string[] = [];

  // Get current month analytics
  const currentMonth = await computeMonthlyAnalytics(userId, date);
  const previousMonth = await computeMonthlyAnalytics(
    userId,
    subMonths(date, 1)
  );

  // Spending change insight
  if (currentMonth.totalSpent > previousMonth.totalSpent * 1.2) {
    const increase = currentMonth.totalSpent - previousMonth.totalSpent;
    insights.push(
      `Your spending increased by $${increase.toFixed(2)} (${(
        ((currentMonth.totalSpent - previousMonth.totalSpent) /
          previousMonth.totalSpent) *
        100
      ).toFixed(1)}%) this month`
    );
  } else if (currentMonth.totalSpent < previousMonth.totalSpent * 0.8) {
    const decrease = previousMonth.totalSpent - currentMonth.totalSpent;
    insights.push(
      `Great job! You reduced spending by $${decrease.toFixed(2)} (${(
        ((previousMonth.totalSpent - currentMonth.totalSpent) /
          previousMonth.totalSpent) *
        100
      ).toFixed(1)}%) this month`
    );
  }

  // Top category insight
  if (currentMonth.topCategory) {
    insights.push(
      `Your top spending category is ${
        currentMonth.topCategory.name
      } with $${currentMonth.topCategory.amount.toFixed(2)}`
    );
  }

  // Budget insights
  const { data: budgets } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  budgets?.forEach((budget) => {
    const spent = budget.spent || 0;
    const percentage = (spent / budget.amount) * 100;

    if (percentage >= 90) {
      insights.push(
        `⚠️ You've used ${percentage.toFixed(0)}% of your ${
          budget.category
        } budget`
      );
    } else if (percentage >= 75) {
      insights.push(
        `You've used ${percentage.toFixed(0)}% of your ${
          budget.category
        } budget`
      );
    }
  });

  return insights;
}
```

#### File: `backend/services/analytics-service/src/services/cache.service.ts`

```typescript
import Redis from "ioredis";
import { logger } from "../utils/logger";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export async function cacheAnalytics(
  userId: string,
  analytics: any
): Promise<void> {
  try {
    const key = `analytics:${userId}`;
    await redis.set(key, JSON.stringify(analytics), "EX", 3600); // Cache for 1 hour
    logger.info(`Analytics cached for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to cache analytics for user ${userId}:`, error);
  }
}

export async function getCachedAnalytics(userId: string): Promise<any | null> {
  try {
    const key = `analytics:${userId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error(`Failed to get cached analytics for user ${userId}:`, error);
    return null;
  }
}

export async function invalidateCache(userId: string): Promise<void> {
  try {
    const key = `analytics:${userId}`;
    await redis.del(key);
    logger.info(`Analytics cache invalidated for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to invalidate cache for user ${userId}:`, error);
  }
}
```

#### File: `backend/services/analytics-service/src/routes/analytics.routes.ts`

```typescript
import { Router, Request, Response } from "express";
import { computeUserAnalytics } from "../services/analytics-compute.service";
import { getCachedAnalytics, invalidateCache } from "../services/cache.service";

const router = Router();

/**
 * GET /analytics/:userId
 * Get analytics for a user
 */
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { force } = req.query;

    // Check cache first
    if (!force) {
      const cached = await getCachedAnalytics(userId);
      if (cached) {
        return res.json({ success: true, data: cached, cached: true });
      }
    }

    // Compute fresh analytics
    const analytics = await computeUserAnalytics(userId);

    res.json({ success: true, data: analytics, cached: false });
  } catch (error: any) {
    console.error("Error getting analytics:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /analytics/:userId/invalidate
 * Invalidate cache for a user
 */
router.post("/:userId/invalidate", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await invalidateCache(userId);
    res.json({ success: true, message: "Cache invalidated" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

#### File: `backend/services/analytics-service/src/utils/logger.ts`

```typescript
import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "analytics-service" },
  transports: [
    new winston.transports.File({
      filename: "logs/analytics-error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/analytics-combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}
```

#### File: `backend/services/analytics-service/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3006

CMD ["npm", "start"]
```

### 1.3 Implement Extraction Service

Create the transaction extraction microservice.

#### File: `backend/services/extraction-service/package.json`

```json
{
  "name": "extraction-service",
  "version": "1.0.0",
  "main": "dist/index.ts",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.0",
    "ioredis": "^5.3.2",
    "bull": "^4.12.0",
    "openai": "^4.20.1",
    "@anthropic-ai/sdk": "^0.9.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.2"
  }
}
```

#### File: `backend/services/extraction-service/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### File: `backend/services/extraction-service/src/index.ts`

```typescript
import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { setupWorker } from "./workers/extraction-worker";
import { logger } from "./utils/logger";
import extractionRoutes from "./routes/extraction.routes";

dotenv.config();

const app: Application = express();
const PORT = process.env.EXTRACTION_SERVICE_PORT || 3007;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "extraction-service",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/extraction", extractionRoutes);

// Start worker
setupWorker();

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`Extraction Service running on port ${PORT}`);
  });
}

export default app;
```

#### File: `backend/services/extraction-service/src/services/regex-extractor.service.ts`

```typescript
import { logger } from "../utils/logger";

export interface ExtractedTransaction {
  amount: number;
  currency: string;
  merchant_name: string;
  transaction_date: string;
  category?: string;
  description?: string;
  transaction_type: "debit" | "credit";
  confidence: number;
}

export async function extractTransactionWithRegex(
  emailContent: string,
  emailSubject: string
): Promise<ExtractedTransaction | null> {
  try {
    // Try bank-specific patterns first
    const bankPatterns = getBankPatterns();

    for (const pattern of bankPatterns) {
      const result = tryPattern(pattern, emailContent, emailSubject);
      if (result && result.confidence > 0.7) {
        return result;
      }
    }

    // Fallback to generic patterns
    return extractWithGenericPatterns(emailContent, emailSubject);
  } catch (error: any) {
    logger.error("Regex extraction failed:", error);
    return null;
  }
}

function getBankPatterns() {
  return [
    {
      name: "HDFC Bank",
      patterns: {
        amount: /(?:Rs\.?|INR|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        merchant: /(?:at|with)\s+([A-Z][A-Za-z\s&.'-]+?)(?:\s+on|\s+for|\.|$)/i,
        date: /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
        type: /(debited|credited|spent|received)/i,
      },
    },
    {
      name: "ICICI Bank",
      patterns: {
        amount: /amount\s+(?:Rs\.?|INR|₹)?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
        merchant: /at\s+([A-Z][A-Za-z\s&.'-]+?)(?:\s+on|\s+for|\.|$)/i,
        date: /on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4})/i,
        type: /(debit|credit|purchase|payment)/i,
      },
    },
    // Add more bank-specific patterns here
  ];
}

function tryPattern(pattern: any, emailContent: string, emailSubject: string) {
  const fullText = `${emailSubject}\n${emailContent}`;

  const amountMatch = fullText.match(pattern.patterns.amount);
  const merchantMatch = fullText.match(pattern.patterns.merchant);
  const dateMatch = fullText.match(pattern.patterns.date);
  const typeMatch = fullText.match(pattern.patterns.type);

  if (!amountMatch || !merchantMatch) {
    return null;
  }

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  const merchant = merchantMatch[1].trim();
  const date = dateMatch
    ? parseDate(dateMatch[1])
    : new Date().toISOString().split("T")[0];
  const type = determineType(typeMatch ? typeMatch[1] : "");

  return {
    amount,
    currency: "INR",
    merchant_name: merchant,
    transaction_date: date,
    transaction_type: type,
    confidence: calculateConfidence(
      amountMatch,
      merchantMatch,
      dateMatch,
      typeMatch
    ),
  };
}

function extractWithGenericPatterns(
  emailContent: string,
  emailSubject: string
): ExtractedTransaction | null {
  // Generic extraction logic
  const fullText = `${emailSubject}\n${emailContent}`;

  const amountRegex = /(?:Rs\.?|INR|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i;
  const merchantRegex =
    /(?:at|with|from)\s+([A-Z][A-Za-z\s&.'-]+?)(?:\s+on|\s+for|\.|$)/i;
  const dateRegex = /(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})/i;

  const amountMatch = fullText.match(amountRegex);
  const merchantMatch = fullText.match(merchantRegex);
  const dateMatch = fullText.match(dateRegex);

  if (!amountMatch) {
    return null;
  }

  return {
    amount: parseFloat(amountMatch[1].replace(/,/g, "")),
    currency: "INR",
    merchant_name: merchantMatch ? merchantMatch[1].trim() : "Unknown Merchant",
    transaction_date: dateMatch
      ? parseDate(dateMatch[1])
      : new Date().toISOString().split("T")[0],
    transaction_type: "debit",
    confidence: merchantMatch ? 0.6 : 0.4,
  };
}

function parseDate(dateStr: string): string {
  // Convert various date formats to YYYY-MM-DD
  const date = new Date(dateStr);
  return date.toISOString().split("T")[0];
}

function determineType(typeStr: string): "debit" | "credit" {
  const lowerType = typeStr.toLowerCase();
  return lowerType.includes("credit") || lowerType.includes("received")
    ? "credit"
    : "debit";
}

function calculateConfidence(...matches: any[]): number {
  const matchCount = matches.filter((m) => m).length;
  return Math.min(0.5 + matchCount * 0.15, 0.95);
}
```

---

## 📝 Implementation Notes

### Regex-Based Extraction Strategy

The transaction extraction now uses a pattern-matching approach:

1. **Bank-Specific Patterns**: Define regex patterns for each major bank's email format
2. **Generic Fallback**: Use generic patterns when bank-specific ones don't match
3. **Confidence Scoring**: Calculate confidence based on number of fields successfully extracted
4. **Template Matching**: For known email formats, use pre-defined templates

### Adding New Bank Patterns

To add support for a new bank, update the `getBankPatterns()` function with the bank's email patterns.

### Testing Extraction Patterns

Create test cases with real email samples (anonymized) to validate patterns:

```typescript
// tests/extraction.test.ts
describe("Transaction Extraction", () => {
  it("should extract from HDFC email", () => {
    const email =
      "Your HDFC Credit Card XX1234 has been debited with Rs.1,500.00 at AMAZON on 01-Nov-2025";
    const result = extractTransactionWithRegex(email, "Transaction Alert");
    expect(result.amount).toBe(1500);
    expect(result.merchant_name).toContain("AMAZON");
  });
});
```

---

## 📚 Continue to Next Sections

The remaining sections cover:
${emailContent}

Extract these fields:

- amount (positive number)
- currency (3-letter code)
- merchant_name
- transaction_date (YYYY-MM-DD)
- category
- description
- transaction_type (debit or credit)
- confidence (0-100)`;

      const message = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      const extracted = JSON.parse(content.text);

      // Validate
      if (
        !extracted.amount ||
        !extracted.merchant_name ||
        !extracted.transaction_date
      ) {
        throw new Error("Missing required fields in extraction");
      }

      logger.info("Transaction extracted successfully with Anthropic");
      return extracted;

  } catch (error: any) {
  logger.error("Anthropic extraction failed:", error);
  throw error;
  }
  }

```

Due to character limits, I'll continue in the next part. Would you like me to continue with the remaining implementation details including:

1. Remaining extraction service files
2. Database migrations
3. Authentication completion
4. Frontend API integration
5. Testing implementation
6. Deployment setup
7. Complete implementation checklist

Let me know and I'll continue with the comprehensive guide!
```
