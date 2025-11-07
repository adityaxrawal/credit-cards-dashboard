# Backend Setup & Development

## 🚀 Quick Start

### Installation

```bash
# From the backend directory
cd backend
npm install
```

**Important:** The backend has its own `node_modules` directory. Always run `npm install` from the `backend/` directory, not from the workspace root.

## 📁 Project Structure

```
backend/
├── package.json          # Single consolidated package.json for entire backend
├── package-lock.json     # Lock file (committed to git)
├── node_modules/         # All backend dependencies (462+ packages)
├── services/
│   ├── api-gateway/      # Main API service
│   │   ├── src/          # Source code
│   │   ├── dist/         # Build output (git-ignored)
│   │   ├── scripts/      # Build and verification scripts
│   │   └── tsconfig.json
│   └── shared/           # Shared utilities and modules
│       ├── index.ts
│       ├── monitoring/
│       ├── database/
│       └── tsconfig.json
├── .eslintrc.json       # Root ESLint config
└── .prettierrc          # Root Prettier config
```

## 🔧 Available Scripts

### Development

```bash
npm run dev              # Start development server with hot reload
```

### Building

```bash
npm run build            # Build both shared and api-gateway
npm run build:shared     # Build only shared module
npm run build:gateway    # Build only api-gateway
npm run build:clean      # Clean dist/ and rebuild
```

### Quality Checks

```bash
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run typecheck        # TypeScript type checking
npm run typecheck:strict # Strict type checking
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
```

### Pre-deployment Checks

```bash
npm run deps:verify      # Verify all dependencies are installed
npm run render:simulate  # Simulate Render.com build process
npm run prepush          # Run all quality checks (what Husky runs)

Note: Git hooks (Husky) are managed at the repository root in `.husky/`.
Only the root Husky setup is used.
```

### Production

```bash
npm start                # Start production server (requires build first)
```

## ⚠️ Common Issues & Solutions

### Issue: "Module typescript is not installed" or "Module tsc-alias is not installed"

**Cause:** The `backend/node_modules` directory is missing or incomplete.

**Solution:**

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Prepush checks failing

**Solution:** Run the verification script to see what's wrong:

```bash
cd backend
npm run deps:verify
```

### Issue: Build fails with "Cannot find module 'shared'"

**Cause:** TypeScript path mappings not set up correctly or build order issue.

**Solution:**

```bash
npm run build:clean
```

## 🏗️ Build Output Structure

After running `npm run build`, the output structure will be:

```
backend/services/api-gateway/dist/
├── api-gateway/
│   └── src/
│       ├── index.js      # Main entry point
│       ├── config/
│       ├── modules/
│       └── ...
└── shared/
    ├── index.js
    ├── monitoring/
    └── ...
```

The entry point for production is: `services/api-gateway/dist/api-gateway/src/index.js`

## 🛣️ API Architecture

All HTTP endpoints are served under the `/api` prefix following RESTful conventions.

### API Route Structure

```
/api
├── /monitoring          # Health & system metrics
│   ├── GET  /health           # Overall health status
│   ├── GET  /liveness         # Liveness probe (Kubernetes)
│   ├── GET  /readiness        # Readiness probe (Kubernetes)
│   └── GET  /metrics          # Prometheus metrics (if enabled)
│
├── /auth               # Authentication & authorization
│   ├── POST /google           # Google OAuth callback
│   ├── POST /refresh          # Refresh access token
│   ├── GET  /profile          # Get user profile
│   └── PUT  /profile          # Update user profile
│
├── /gmail              # Gmail sync & transaction extraction
│   ├── GET  /auth             # Get OAuth authorization URL
│   ├── GET  /callback         # OAuth callback handler
│   ├── POST /sync             # Trigger email sync
│   ├── GET  /status           # Get sync status
│   └── POST /revoke           # Revoke Gmail access
│
├── /transactions       # Transaction management
│   ├── GET    /               # List transactions (with filters)
│   ├── POST   /               # Create transaction
│   ├── GET    /:id            # Get transaction by ID
│   ├── PUT    /:id            # Update transaction
│   └── DELETE /:id            # Delete transaction
│
├── /cards              # Credit card management
│   ├── GET    /               # List all cards
│   ├── POST   /               # Add new card
│   ├── GET    /:id            # Get card details
│   ├── PUT    /:id            # Update card
│   └── DELETE /:id            # Delete card
│
├── /budgets            # Budget management
│   ├── GET    /               # List all budgets
│   ├── POST   /               # Create budget
│   ├── GET    /:id            # Get budget details
│   ├── PUT    /:id            # Update budget
│   └── DELETE /:id            # Delete budget
│
├── /alerts             # Alert & notification management
│   ├── GET    /               # List alerts
│   ├── POST   /               # Create alert
│   ├── GET    /:id            # Get alert
│   ├── PUT    /:id            # Update alert
│   ├── DELETE /:id            # Delete alert
│   └── POST   /:id/dismiss    # Dismiss alert
│
├── /bills              # Bill tracking & reminders
│   ├── GET    /               # List bills
│   ├── POST   /               # Create bill
│   ├── GET    /:id            # Get bill
│   ├── PUT    /:id            # Update bill
│   └── DELETE /:id            # Delete bill
│
├── /subscriptions      # Subscription management
│   ├── GET    /               # List subscriptions
│   ├── POST   /               # Add subscription
│   ├── GET    /:id            # Get subscription
│   ├── PUT    /:id            # Update subscription
│   └── DELETE /:id            # Delete subscription
│
├── /rewards            # Rewards & cashback tracking
│   ├── GET    /               # List rewards
│   ├── POST   /               # Add reward
│   ├── GET    /:id            # Get reward
│   └── POST   /:id/redeem     # Redeem reward
│
├── /analytics          # Analytics & insights
│   ├── GET    /               # Get KPI dashboard
│   ├── GET    /:id            # Get specific analytics
│   └── POST   /               # Create analytics entry
│
├── /reports            # Financial reports
│   ├── GET    /spending       # Spending report
│   ├── GET    /category       # Category breakdown
│   ├── GET    /monthly        # Monthly summary
│   └── GET    /export         # Export data
│
└── /ai-insights        # AI-powered insights
    ├── GET  /               # Get insights
    └── POST /generate       # Generate new insights
```

### Authentication

Most endpoints require authentication via JWT bearer token:

```
Authorization: Bearer <access_token>
```

The `authenticate` middleware validates the token and populates `req.userId`.

### Rate Limiting

- **Global:** 100 requests per 15 minutes (all endpoints)
- **Auth:** 5 requests per 10 minutes (`/api/auth/*`)
- **Gmail:** 10 requests per 15 minutes (`/api/gmail/*`)

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699564800
```

### Request Validation

All POST/PUT endpoints use Zod schemas for validation:

```typescript
// Example: Create transaction
POST /api/transactions
Content-Type: application/json

{
  "amount": 99.99,
  "merchant": "Amazon",
  "category": "Shopping",
  "date": "2024-11-07",
  "card_id": "uuid"
}
```

Validation errors return:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be a positive number"
    }
  ]
}
```

### Response Caching

Analytics endpoints use Redis caching:

- **Short cache (60s):** Real-time data
- **Medium cache (120s):** Analytics dashboards
- **Long cache (300s):** Reports and aggregated data

Cache headers indicate cache status:

```
X-Cache-Status: HIT | MISS
```

## 📧 Gmail Sync Flow

1. Client requests auth URL: `GET /api/gmail/auth` (returns OAuth consent URL)
2. User authenticates with Google; tokens stored securely (encrypted refresh token)
3. Manual sync trigger: `POST /api/gmail/sync`
4. Backend:
   - Fetch recent messages (query heuristic for transaction keywords)
   - Deduplicate by `email_message_id`
   - Extract transaction fields (amount, merchant, date, last four) via regex patterns
   - Insert transactions and log processing status
5. Response includes `{processed, inserted, skipped, errors}`
6. Frontend triggers downstream budget/alerts/analytics update endpoints

## 🛡️ Rate Limiting

Global limiter applied: window defined by `RATE_LIMIT_WINDOW_MS` (default 15m) and `RATE_LIMIT_MAX` (default 100). Stricter per-route limiter for Gmail endpoints with `RATE_LIMIT_GMAIL_MAX`.

## 🧪 Tests (Baseline - To Implement)

Planned baseline tests will cover:

- Health endpoint `/api/monitoring/health`
- Auth workflow (mock)
- Transactions listing
- Gmail sync mock pipeline

## 🧾 Environment Validation

Startup performs environment validation using Zod (`src/config/env.ts`). Missing required variables cause startup failure with descriptive error.

Refer to `.env.example` for the authoritative list.

## �📦 Dependencies Management

- **All dependencies** are defined in `backend/package.json`
- **No nested package.json files** - we use a single package.json structure
- **TypeScript path mappings** handle module resolution between api-gateway and shared

### Key Dependencies:

- **Runtime:** Express, Supabase, Redis (ioredis), JWT, Google APIs
- **Build:** TypeScript, tsc-alias
- **Quality:** ESLint, Prettier, Husky
- **Monitoring:** Sentry, Winston

## 🔍 Quality Gates

Before deployment, the following checks must pass:

1. ✅ **Dependencies Verification** - All required packages installed
2. ✅ **TypeScript Strict Check** - No type errors
3. ✅ **Linting** - Code follows ESLint rules (warnings allowed)
4. ✅ **Render Simulation** - Build process works as expected

Run all checks: `npm run pre-push`

## 🚀 Deployment (Render.com)

The Render deployment uses:

- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

Environment variables must be set in Render Dashboard (see `.env.production.example` for the list).

## 🐛 Debugging

### Check if dependencies are properly installed:

```bash
ls backend/node_modules | wc -l
# Should show ~462 packages
```

### Verify TypeScript can find shared module:

```bash
cd backend
npm run typecheck
```

### Test the build locally:

```bash
cd backend
npm run build:clean
npm start
```

### Simulate Render deployment:

```bash
cd backend
npm run render:simulate
```
