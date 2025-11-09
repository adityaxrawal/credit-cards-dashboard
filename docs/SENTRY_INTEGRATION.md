# Sentry Integration Guide

## Overview

This document describes the Sentry monitoring integration for the Credit Card Dashboard application. Sentry provides:

- **Error Tracking**: Automatically capture and report exceptions with stack traces
- **Performance Monitoring**: Distributed tracing for API requests and database queries
- **Breadcrumbs**: Track user actions leading up to errors
- **User Context**: Associate errors with specific users

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  - Browser error tracking                                    │
│  - Page load performance                                     │
│  - User interaction breadcrumbs                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ API Requests
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (Express/Node.js)                       │
│  - API endpoint tracing                                      │
│  - Database query monitoring                                 │
│  - External API call tracking                                │
│  - Error categorization                                      │
└─────────────────────────────────────────────────────────────┘
                       │
                       │ Events/Transactions
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sentry.io Platform                        │
│  Free Tier:                                                  │
│  - 5,000 errors/month                                        │
│  - 10,000 performance units/month                            │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Create Sentry Account & Projects

1. Go to https://sentry.io and sign up (free account)
2. Create **two projects**:
   - `credit-card-backend` (platform: Node.js)
   - `credit-card-frontend` (platform: Next.js)
3. Copy the DSN for each project from Settings → Client Keys (DSN)

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Backend Sentry DSN
SENTRY_DSN_BACKEND=https://xxxxx@sentry.io/1234567

# Frontend Sentry DSN (must be prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_SENTRY_DSN=https://yyyyy@sentry.io/7654321

# Environment
NEXT_PUBLIC_ENVIRONMENT=production

# Sample rate (0.1 = 10% of transactions)
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 3. Install Dependencies

Already included in `package.json`:

```bash
# Backend
cd backend/services/api-gateway
npm install @sentry/node

# Frontend
cd frontend
npm install @sentry/nextjs
```

### 4. Initialize Backend Sentry

In `backend/services/api-gateway/src/app.ts`:

```typescript
import * as Sentry from "@sentry/node";
import { initSentry } from "shared/monitoring/sentry";

// Initialize Sentry BEFORE any routes
initSentry();

const app = express();

// Add Sentry request handler (first middleware)
app.use(Sentry.setupExpressErrorHandler(app));

// ... your routes ...

// Add Sentry error handler (last middleware, before your error handler)
import { sentryErrorHandler } from "@common/middleware/sentry-middleware";
app.use(sentryErrorHandler());
app.use(errorHandler); // Your existing error handler
```

### 5. Initialize Frontend Sentry

Already auto-initialized in `frontend/src/lib/sentry.ts` when imported.

Add to `frontend/src/app/layout.tsx`:

```typescript
import { initSentry } from "@/lib/sentry";

// Initialize Sentry at app root
if (typeof window !== "undefined") {
  initSentry();
}
```

## Usage

### Backend: Capture Exceptions

```typescript
import { captureException } from "shared/monitoring/sentry";

try {
  await riskyOperation();
} catch (error) {
  captureException(error as Error, {
    userId: req.userId,
    operation: "riskyOperation",
    additionalContext: "any extra data",
  });
  throw error;
}
```

### Backend: Performance Tracing

```typescript
import { startSpan } from "shared/monitoring/sentry";

// Wrap slow operations
const result = await startSpan("database.getUserCards", "db", async () => {
  return await db.query("SELECT * FROM cards WHERE user_id = $1", [userId]);
});
```

### Backend: Database Query Monitoring

```typescript
import { wrapDatabaseQuery } from "@common/middleware/sentry-middleware";

const cards = await wrapDatabaseQuery("getUserCards", () =>
  cardsRepository.findByUserId(userId)
);
```

### Frontend: Capture Exceptions

```typescript
import { captureException } from "@/lib/sentry";

try {
  await apiClient.post("/api/transactions", data);
} catch (error) {
  captureException(error as Error, {
    endpoint: "/api/transactions",
    method: "POST",
  });
  toast.error("Failed to create transaction");
}
```

### Frontend: Add Breadcrumbs

```typescript
import { addBreadcrumb } from "@/lib/sentry";

// Track user actions
addBreadcrumb("User clicked sync button", "user.action", {
  buttonId: "gmail-sync",
  timestamp: new Date().toISOString(),
});
```

### Frontend: Set User Context

```typescript
import { setUser } from "@/lib/sentry";

// After successful login
setUser({
  id: user.id,
  email: user.email,
  username: user.name,
});

// After logout
setUser(null);
```

## Critical Routes Traced

The following routes are automatically traced with performance monitoring:

1. **Gmail Sync**: `POST /api/gmail/sync`

   - Full inbox scan and transaction extraction
   - Tracks processing time and email counts
   - Captures sync errors with retry information

2. **Reports API**: `GET /api/reports/*`

   - Monthly spending analysis
   - Category breakdowns
   - Payment tracking

3. **Transactions API**: `GET/POST/PUT/DELETE /api/transactions/*`
   - CRUD operations on transactions
   - Bulk operations
   - Search and filtering

## Error Filtering

To stay within the free tier (5,000 errors/month), the following errors are filtered:

### Backend (`sentry.ts`)

- Network timeouts (handled by retry logic)
- Validation errors (expected user input errors)
- 404 Not Found (logged but not sent to Sentry)

### Frontend (`sentry.ts`)

- Browser extension errors (not our code)
- Network errors (handled by React Query)
- Health check requests (too frequent)

## Staying Within Free Tier Limits

### Error Budget: 5,000/month

- Average: ~167 errors/day
- If exceeded: Errors will be dropped (oldest first)

### Performance Budget: 10,000 units/month

- Sample rate: 10% (production) / 100% (development)
- Average: ~333 transactions/day at 10% sampling

### Best Practices

1. **Filter aggressively**: Only capture errors that need investigation
2. **Sample wisely**: Use 10% sampling in production
3. **Monitor quota**: Check Sentry dashboard weekly
4. **Disable in development**: Set `SENTRY_DSN_BACKEND=""` locally

## Monitoring Dashboard

### Viewing Errors

1. Go to https://sentry.io
2. Select `credit-card-backend` or `credit-card-frontend` project
3. Click "Issues" to see all captured errors
4. Each error shows:
   - Stack trace
   - Breadcrumbs (user actions before error)
   - User context
   - Environment variables
   - Request data

### Viewing Performance

1. Click "Performance" in Sentry dashboard
2. See transaction traces for:
   - API endpoints
   - Database queries
   - External API calls
3. Identify slow operations (>1s)

## Testing

### Test Backend Integration

```bash
# Send test error
curl -X POST http://localhost:3001/api/test/sentry \
  -H "Content-Type: application/json" \
  -d '{"message": "Test error from API"}'

# Check Sentry dashboard in ~30 seconds
```

### Test Frontend Integration

```typescript
// Add to any component
import { captureMessage } from "@/lib/sentry";

<button onClick={() => captureMessage("Test from frontend", "info")}>
  Test Sentry
</button>;
```

## Troubleshooting

### Issue: Events not appearing in Sentry

**Check:**

1. DSN is correct in `.env`
2. Environment variables loaded (`console.log(process.env.SENTRY_DSN_BACKEND)`)
3. Sentry initialized before routes (`initSentry()` called first)
4. Not filtered by `beforeSend` hook

### Issue: Too many events (quota exceeded)

**Solutions:**

1. Increase filtering in `beforeSend`
2. Reduce sample rate to 0.05 (5%)
3. Disable for specific environments

### Issue: Missing context data

**Fix:**

- Call `setUser()` after authentication
- Add breadcrumbs at key interaction points
- Include context in `captureException()`

## Migration Checklist

- [x] Backend Sentry configuration (`shared/monitoring/sentry.ts`)
- [x] Frontend Sentry configuration (`frontend/lib/sentry.ts`)
- [x] Express middleware (`sentry-middleware.ts`)
- [x] Gmail sync tracing (controller level)
- [ ] Reports API tracing (TODO: Task 1 continuation)
- [ ] Transactions API tracing (TODO: Task 1 continuation)
- [ ] Initialize in `app.ts` (TODO: Task 1 continuation)
- [ ] Initialize in frontend `layout.tsx` (TODO: Task 1 continuation)
- [ ] Test with real errors
- [ ] Configure alert rules in Sentry dashboard

## Zero-Cost Compliance

✅ **Sentry Free Tier:**

- 5,000 errors/month
- 10,000 performance units/month
- Unlimited projects
- 30-day event retention
- No credit card required

✅ **Architecture:**

- No additional services
- No data storage costs
- Event sampling keeps within limits
- Aggressive filtering reduces noise

## Related Files

- `backend/services/shared/monitoring/sentry.ts` - Backend config
- `frontend/src/lib/sentry.ts` - Frontend config
- `backend/services/api-gateway/src/common/middleware/sentry-middleware.ts` - Express middleware
- `.env.example` - Environment template

## Next Steps

1. Complete tracing for Reports and Transactions APIs
2. Add initialization to app entry points
3. Create test scenarios
4. Configure alert rules in Sentry dashboard
5. Document error patterns and common fixes
