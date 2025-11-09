# Phase 4 Task 1: Sentry Integration - Progress Report

## Status: 80% Complete

## Completed Deliverables

### 1. Backend Sentry Configuration ✅

**File:** `backend/services/shared/monitoring/sentry.ts`

- Full Sentry SDK v8 initialization with `nodeProfilingIntegration()`
- Functions: `initSentry()`, `captureException()`, `captureMessage()`, `setUser()`, `addBreadcrumb()`, `startSpan()`
- Error filtering to stay within free tier (5,000 errors/month)
- Breadcrumb filtering for reduced noise
- Environment-aware sampling (10% production, 100% development)
- Lines: 194

### 2. Frontend Sentry Configuration ✅

**File:** `frontend/src/lib/sentry.ts`

- Next.js browser tracking with `browserTracingIntegration()`
- Same API surface as backend for consistency
- Browser extension error filtering
- Network error filtering (React Query handles these)
- Auto-initialization on import
- Lines: 180

### 3. Express Middleware ✅

**File:** `backend/services/api-gateway/src/common/middleware/sentry-middleware.ts`

- `sentryRequestHandler()` - Sets transaction names for critical routes
- `sentryTracingMiddleware()` - Adds user context to spans
- `sentryErrorHandler()` - Captures and forwards errors
- `customSentryErrorHandler()` - Works with AppError system
- `wrapDatabaseQuery()` - Automatic DB query tracing
- `wrapExternalCall()` - Automatic external API tracing
- Lines: 110

### 4. Gmail Sync API Tracing ✅

**File:** `backend/services/api-gateway/src/modules/gmail/gmail.controller.ts`

- Wrapped `syncEmails()` method with `startSpan("gmail.sync", "gmail")`
- Captures all sync errors with context (userId, errorCode, retryable)
- Preserves existing error handling and logging
- Lines modified: 46

### 5. Environment Configuration ✅

**File:** `.env.example`

- Added `SENTRY_DSN_BACKEND` for Node.js server
- Added `NEXT_PUBLIC_SENTRY_DSN` for Next.js frontend
- Added `NEXT_PUBLIC_ENVIRONMENT` for environment tagging
- Added `SENTRY_TRACES_SAMPLE_RATE` for performance budget control
- Documented free tier limits and sampling recommendations

### 6. Comprehensive Documentation ✅

**File:** `docs/SENTRY_INTEGRATION.md`

- Complete setup guide with step-by-step instructions
- Architecture diagram showing frontend → backend → Sentry flow
- Usage examples for all scenarios (errors, tracing, breadcrumbs)
- Critical routes documentation (Gmail, Reports, Transactions)
- Error filtering strategy to stay within free tier
- Troubleshooting guide
- Testing instructions
- Migration checklist
- Lines: 350+

## Remaining Work (20%)

### 1. Reports API Tracing 🔄

**Files to modify:**

- `backend/services/api-gateway/src/modules/reports/reports.controller.ts`

**Required changes:**

```typescript
import { startSpan, captureException } from "shared/monitoring/sentry";

// Wrap each report generation method
static async getMonthlyReport(req: AuthRequest, res: Response): Promise<void> {
  return startSpan("reports.monthly", "report", async () => {
    try {
      // ... existing logic ...
    } catch (error) {
      captureException(error as Error, { userId: req.userId, reportType: "monthly" });
      throw error;
    }
  });
}
```

### 2. Transactions API Tracing 🔄

**Files to modify:**

- `backend/services/api-gateway/src/modules/transactions/transactions.controller.ts`

**Required changes:**

```typescript
import { startSpan, captureException } from "shared/monitoring/sentry";

// Wrap CRUD operations
static async createTransaction(req: AuthRequest, res: Response): Promise<void> {
  return startSpan("transactions.create", "transaction", async () => {
    try {
      // ... existing logic ...
    } catch (error) {
      captureException(error as Error, { userId: req.userId, operation: "create" });
      throw error;
    }
  });
}
```

### 3. Backend Initialization 🔄

**File:** `backend/services/api-gateway/src/app.ts`

**Required changes:**

```typescript
import * as Sentry from "@sentry/node";
import { initSentry } from "shared/monitoring/sentry";

// Initialize Sentry FIRST (before any imports that might throw)
initSentry();

const app = express();

// Add Sentry error handler (last middleware)
app.use(Sentry.setupExpressErrorHandler(app));

import { sentryErrorHandler } from "@common/middleware/sentry-middleware";
app.use(sentryErrorHandler());
app.use(errorHandler); // Your existing error handler
```

### 4. Frontend Initialization 🔄

**File:** `frontend/src/app/layout.tsx`

**Required changes:**

```typescript
import { initSentry } from "@/lib/sentry";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize Sentry on client side
  if (typeof window !== "undefined") {
    initSentry();
  }

  // ... rest of layout ...
}
```

### 5. Integration Testing 🔄

**Tasks:**

1. Set up Sentry projects for backend and frontend
2. Configure DSNs in `.env`
3. Send test error to verify backend integration
4. Send test error to verify frontend integration
5. Check Sentry dashboard for events
6. Verify performance traces appear
7. Test user context and breadcrumbs

## Metrics

### Code Added

| File                                           | Lines    | Type       |
| ---------------------------------------------- | -------- | ---------- |
| `backend/services/shared/monitoring/sentry.ts` | 194      | Config     |
| `frontend/src/lib/sentry.ts`                   | 180      | Config     |
| `backend/.../sentry-middleware.ts`             | 110      | Middleware |
| `docs/SENTRY_INTEGRATION.md`                   | 350+     | Docs       |
| Gmail controller modifications                 | 46       | Tracing    |
| `.env.example` additions                       | 15       | Config     |
| **TOTAL**                                      | **895+** | **All**    |

### Zero-Cost Compliance ✅

- Sentry Free Tier: 5,000 errors/month + 10,000 performance units/month
- No additional services required
- Event sampling (10% in production) keeps within limits
- Aggressive filtering reduces noise
- No credit card required

### Test Coverage

- [ ] Backend error capture (pending integration test)
- [ ] Frontend error capture (pending integration test)
- [ ] Performance tracing (pending integration test)
- [ ] User context (pending integration test)
- [ ] Breadcrumbs (pending integration test)

## Quality Impact

### Before Phase 4 Task 1

- Quality Score: 96/100
- Observability: None
- Error tracking: Console logs only
- Performance monitoring: Manual timing
- Debugging: Stack traces in logs

### After Phase 4 Task 1 (projected)

- Quality Score: 98/100 (+2)
- Observability: Full Sentry integration
- Error tracking: Centralized with context
- Performance monitoring: Automatic tracing
- Debugging: Rich context with breadcrumbs

## Next Steps

1. **Immediate (1 hour):**

   - Add tracing to Reports API (5 methods)
   - Add tracing to Transactions API (6 methods)
   - Initialize Sentry in `app.ts` and `layout.tsx`

2. **Testing (30 minutes):**

   - Create Sentry projects
   - Configure DSNs
   - Send test errors
   - Verify dashboard

3. **Complete Task 1:**
   - Mark as "completed" in todo list
   - Move to Task 2 (Admin Metrics Dashboard)

## Related Documentation

- `docs/SENTRY_INTEGRATION.md` - Complete setup and usage guide
- `.env.example` - Environment configuration template
- `backend/services/shared/monitoring/sentry.ts` - Backend API reference
- `frontend/src/lib/sentry.ts` - Frontend API reference

## Dependencies

- `@sentry/node@^8.x` (backend)
- `@sentry/nextjs@^8.x` (frontend)

## Author

GitHub Copilot - Phase 4 Implementation

## Date

2024-01-XX (completion date pending)
