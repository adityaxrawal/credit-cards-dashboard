# Credit Card Dashboard - Phase 1 Implementation

## 🚀 Quick Start Guide

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL 15+ (via Supabase)
- Redis 7+ (via Upstash)
- Google Cloud Platform account with OAuth configured
- npm or yarn package manager

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd credit-card-dashboard
   ```

2. **Install dependencies**

   ```bash
   # Backend shared utilities
   cd backend/shared
   npm install

   # API Gateway
   cd ../services/api-gateway
   npm install

   # Frontend
   cd ../../../frontend
   npm install
   ```

3. **Configure environment variables**

   Create `.env` files based on `.env.example`:

   **Backend (`backend/services/api-gateway/.env`)**:

   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/login

   # JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   JWT_SECRET=your-jwt-secret-min-32-characters
   JWT_REFRESH_SECRET=your-jwt-refresh-secret-min-32-characters

   # Encryption Key (64 hex characters for AES-256)
   ENCRYPTION_KEY=your-64-char-hex-encryption-key

   # Supabase
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

   # Redis
   REDIS_URL=redis://default:password@xxxxx.upstash.io:6379

   # Server
   PORT=4000
   NODE_ENV=development
   ```

   **Frontend (`frontend/.env.local`)**:

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:4000
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run database migrations**
   ```bash
   cd database
   npm install
   npm run migrate:up
   ```

### Running the Application

#### Development Mode

**Backend:**

```bash
cd backend/services/api-gateway
npm run dev
```

Server will start on http://localhost:4000

**Frontend:**

```bash
cd frontend
npm run dev
```

Application will be available at http://localhost:3000

#### Production Mode

**Backend:**

```bash
cd backend/services/api-gateway
npm run build
npm start
```

**Frontend:**

```bash
cd frontend
npm run build
npm start
```

### Running Tests

**Backend Unit & Integration Tests:**

```bash
cd backend/services/api-gateway
npm test                    # Watch mode
npm run test:ci            # CI mode with coverage
```

**Frontend Tests:**

```bash
cd frontend
npm test                    # Watch mode
npm run test:ci            # CI mode
```

**Run all tests locally (CI simulation):**

```bash
npm run ci
```

### Code Quality

**Linting:**

```bash
# Backend
cd backend/services/api-gateway
npm run lint

# Frontend
cd frontend
npm run lint
```

**Type Checking:**

```bash
# Backend
cd backend/services/api-gateway
npm run type-check

# Frontend
cd frontend
npm run type-check
```

## 📋 Phase 1 Features Implemented

### ✅ Authentication System

- Google OAuth 2.0 integration
- JWT-based authentication (access + refresh tokens)
- Session management with Redis
- Encrypted storage of Gmail refresh tokens
- Protected routes and middleware
- Token refresh mechanism

**Endpoints:**

- `POST /api/auth/google` - Authenticate with Google OAuth code
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### ✅ Card Management

- Full CRUD operations for credit cards
- Card statistics and utilization tracking
- Pagination and filtering
- Validation and error handling

**Endpoints:**

- `GET /api/cards` - List all cards
- `GET /api/cards/:id` - Get card details
- `POST /api/cards` - Create new card
- `PUT /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Soft delete card
- `GET /api/cards/:id/statistics` - Get card statistics

### ✅ Transaction Management

- Transaction CRUD operations
- Billing cycle calculation
- Advanced filtering (by card, date range, amount, category)
- Search functionality
- Pagination and sorting
- Budget tracking integration

**Endpoints:**

- `GET /api/transactions` - List transactions with filters
- `GET /api/transactions/:id` - Get transaction details
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### ✅ Dashboard & Analytics

- Overview statistics (total spending, cards, transactions)
- Card-wise spending breakdown
- Recent transactions
- Budget utilization tracking
- Credit utilization metrics
- Spending trends

**Endpoints:**

- `GET /api/dashboard/overview` - Dashboard overview stats
- `GET /api/analytics/summary` - Analytics summary
- `GET /api/transactions/recent` - Recent transactions

### ✅ Health & Monitoring

- Health check endpoint
- Service status monitoring (DB, Redis)
- Structured error responses
- Request logging

**Endpoints:**

- `GET /api/health` - Health check

## 🧪 Testing Strategy

### Coverage Requirements

- **Minimum Coverage**: 90% for lines, branches, functions, and statements
- **Unit Tests**: Service layer methods, utilities, helpers
- **Integration Tests**: API endpoints with mocked dependencies
- **Component Tests**: React components (Login, Cards, Transactions, Dashboard)
- **E2E Tests**: Critical user flows

### Test Structure

```
backend/services/api-gateway/
├── tests/
│   ├── auth.service.test.ts         # Auth service unit tests
│   ├── auth.routes.test.ts          # Auth routes integration tests
│   ├── card.service.test.ts         # Card service tests
│   ├── transaction.service.test.ts  # Transaction service tests
│   └── dashboard.service.test.ts    # Dashboard service tests

frontend/
├── __tests__/
│   ├── components/
│   │   ├── AuthContext.test.tsx
│   │   ├── CardList.test.tsx
│   │   ├── TransactionTable.test.tsx
│   │   └── Dashboard.test.tsx
│   └── pages/
│       ├── login.test.tsx
│       └── dashboard.test.tsx
```

## 🏗️ Architecture

### Backend Architecture

```
backend/
├── shared/                    # Shared utilities across services
│   ├── database/             # Supabase client
│   ├── cache/                # Redis client
│   ├── types/                # TypeScript types
│   └── utils/                # Helper functions
└── services/
    └── api-gateway/          # Main API service
        ├── src/
        │   ├── services/     # Business logic
        │   ├── routes/       # API routes
        │   ├── middleware/   # Auth, logging, errors
        │   ├── controllers/  # Request handlers
        │   └── utils/        # Service utilities
        └── tests/            # Test files
```

### Frontend Architecture

```
frontend/
├── src/
│   ├── app/                  # Next.js app router
│   │   ├── (auth)/          # Auth pages
│   │   └── (dashboard)/     # Protected pages
│   ├── components/          # React components
│   │   ├── ui/              # Reusable UI components
│   │   ├── cards/           # Card components
│   │   ├── transactions/    # Transaction components
│   │   ├── dashboard/       # Dashboard components
│   │   └── layout/          # Layout components
│   ├── lib/                 # Utilities
│   │   ├── auth/            # Auth context & hooks
│   │   ├── api/             # API client
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Helper functions
│   ├── store/               # State management (Zustand)
│   └── types/               # TypeScript types
```

## 🔐 Security

- **Authentication**: OAuth 2.0 + JWT (access + refresh tokens)
- **Token Storage**: Redis for sessions, encrypted storage for Gmail tokens (AES-256-GCM)
- **Input Validation**: Zod schemas for request validation
- **SQL Injection Prevention**: Supabase parameterized queries
- **XSS Protection**: React automatic escaping + Content Security Policy
- **Rate Limiting**: Express rate limiter on sensitive endpoints
- **CORS**: Configured for allowed origins only
- **Secure Headers**: Helmet.js for security headers

## 📊 Database Schema

Key tables:

- `users` - User accounts and preferences
- `credit_cards` - Credit card details
- `transactions` - Transaction records with billing cycle
- `budget_tracking` - Monthly budget tracking
- `alerts` - User notifications
- `gmail_tokens` - Encrypted OAuth tokens
- `email_processing_log` - Email processing history
- `analytics_cache` - Cached analytics results

See `database/migrations/001_initial_schema.sql` for full schema.

## 🚀 Deployment

### Backend Deployment (Google Cloud Run)

```bash
cd backend/services/api-gateway
gcloud builds submit --tag gcr.io/PROJECT_ID/api-gateway
gcloud run deploy api-gateway \
  --image gcr.io/PROJECT_ID/api-gateway \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Frontend Deployment (Vercel)

```bash
cd frontend
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

## 📈 Monitoring & Logging

- **Backend Logs**: Winston logger with structured logging
- **Error Tracking**: Centralized error handling middleware
- **Health Checks**: `/api/health` endpoint for service monitoring
- **Performance**: Response time tracking in request logger

## 🐛 Troubleshooting

### Common Issues

1. **"Session expired" errors**

   - Check Redis connection
   - Verify JWT secrets are consistent
   - Ensure token refresh flow is working

2. **Database connection failures**

   - Verify Supabase URL and service role key
   - Check network connectivity
   - Review Row Level Security policies

3. **OAuth errors**

   - Verify Google OAuth credentials
   - Check redirect URI matches Google Console
   - Ensure correct scopes are requested

4. **Test failures**
   - Run `npm ci` to ensure clean dependencies
   - Check mock implementations
   - Verify environment variables are set

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes with proper tests
3. Ensure all tests pass: `npm run ci`
4. Submit a pull request

### Code Standards

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting
- Conventional commits for git messages
- Minimum 90% test coverage

## 📝 License

[Your License Here]

## 👥 Team

[Your Team Information]

---

**Phase 1 Complete** ✅  
Next: Phase 2 - Email Integration & Automation
