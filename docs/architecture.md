# Credit Card Dashboard - System Architecture

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Tech Stack](#tech-stack)
4. [Data Model](#data-model)
5. [Component Architecture](#component-architecture)
6. [Service Architecture](#service-architecture)
7. [User Flow](#user-flow)
8. [API Design](#api-design)
9. [Background Jobs & Services](#background-jobs--services)
10. [Security & Authentication](#security--authentication)
11. [Scalability Considerations](#scalability-considerations)
12. [Additional Features](#additional-features)

---

## 🎯 System Overview

### Purpose

Personal credit card management dashboard for tracking 10+ credit cards, monitoring transactions, managing spending limits, and automated email-based transaction extraction.

### Target Users

- Primary: Personal use (1 user)
- Maximum: 5-10 users
- Authentication: Google OAuth only

### Key Objectives

- Centralized credit card transaction management
- Automated transaction extraction from Gmail
- Spending limit tracking with alerts
- Analytics and insights generation
- Bill date and due date reminders

### Business Context

This system addresses the growing complexity of managing multiple credit cards in India's digital payment ecosystem. With the proliferation of credit cards offering different rewards, cashback, and benefits across various categories, users face challenges in:

1. **Transaction Visibility**: Manually tracking transactions across 10+ cards is time-consuming
2. **Budget Control**: Difficulty in maintaining overall spending discipline across multiple cards
3. **Optimization**: Missing opportunities to use the right card for maximum benefits
4. **Reminder Management**: Forgetting bill dates and due dates leading to late fees
5. **Financial Analysis**: Lack of consolidated view for spending patterns and insights

### Success Metrics

| Metric                        | Target       | Measurement Method                         |
| ----------------------------- | ------------ | ------------------------------------------ |
| Transaction Auto-Capture Rate | > 95%        | Automated vs Manual entries                |
| Email Processing Accuracy     | > 90%        | Correctly extracted vs Total               |
| Alert Delivery Time           | < 5 minutes  | Time from threshold breach to notification |
| Dashboard Load Time           | < 2 seconds  | 95th percentile response time              |
| User Onboarding Time          | < 15 minutes | Time to first successful transaction sync  |
| Budget Alert Effectiveness    | 100%         | Alerts sent vs Budget breaches             |
| System Uptime                 | > 99.5%      | Monthly availability                       |

### Key Stakeholders

| Role                      | Responsibility                      | Success Criteria                             |
| ------------------------- | ----------------------------------- | -------------------------------------------- |
| **End User**              | Primary dashboard user              | Easy transaction tracking, accurate insights |
| **System Administrator**  | Maintains services, monitors health | System uptime, service reliability           |
| **Development Team**      | Builds and enhances features        | Code quality, feature delivery               |
| **Data Security Officer** | Ensures data protection             | Compliance with security standards           |

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                           │
│                    (Vercel - Free Tier)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Overview   │  │    Cards     │  │ Transactions │          │
│  │     View     │  │     View     │  │     View     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Analytics  │  │   Settings   │  │    Profile   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS/REST API
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                (Google Cloud Run - Free Tier)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Authentication Middleware                    │   │
│  │                  (JWT Validation)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  User API    │  │  Card API    │  │Transaction   │          │
│  │  Service     │  │  Service     │  │   API        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Analytics    │  │  Budget      │  │   Alert      │          │
│  │   API        │  │   API        │  │   API        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Supabase   │  │   Upstash    │  │   Google     │
│   Database   │  │    Redis     │  │   OAuth      │
│  (PostgreSQL)│  │   (Cache)    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICES LAYER                     │
│                 (Google Cloud Run - Free Tier)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Gmail Pub/Sub Listener Service                    │   │
│  │    (Real-time email monitoring for all users)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         │                                         │
│                         ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │      Transaction Extraction Service                       │   │
│  │   (LLM/Regex-based extraction from email)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │        Historical Email Scanner Service                   │   │
│  │      (One-time/periodic scan for past emails)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Spending Alert Service (Cron Job)                 │   │
│  │    (Daily check for budget limit breaches)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │       Bill Date Reminder Service (Cron Job)               │   │
│  │  (Sends reminders 3 days before bill/due dates)           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Analytics Computation Service                     │   │
│  │      (Pre-compute KPIs and insights daily)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │  Gmail Pub/Sub API │
              │  (Google Cloud)    │
              └────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend

- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts / Chart.js
- **State Management**: Zustand / React Context
- **HTTP Client**: Axios / Fetch
- **Hosting**: Vercel (Free Tier)

### Backend

- **Runtime**: Node.js 20+
- **Framework**: Express.js / Hono (lightweight)
- **Language**: TypeScript
- **Hosting**: Google Cloud Run (Free Tier)
- **Container**: Docker

### Database

- **Primary DB**: Supabase (PostgreSQL) - Free Tier
- **Cache**: Upstash Redis - Free Tier
- **Real-time**: Supabase Realtime (optional)

### Authentication

- **Provider**: Google OAuth 2.0
- **JWT**: JSON Web Tokens
- **Session**: Redis-backed sessions

### Background Services

- **Email Integration**: Gmail API + Pub/Sub
- **Cron Jobs**: Google Cloud Scheduler (Free Tier)
- **Queue**: Upstash Redis Queue
- **Email Parsing**: OpenAI GPT-4 / Gemini API / Regex

### DevOps

- **Version Control**: Git + GitHub
- **CI/CD**: GitHub Actions / Vercel
- **Monitoring**: Google Cloud Logging (Free Tier)
- **Error Tracking**: Sentry (Free Tier)

---

## 💾 Data Model

### Database Schema

#### 1. Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    profile_picture TEXT,
    monthly_budget DECIMAL(10, 2) DEFAULT 30000.00,
    gmail_watch_expiration TIMESTAMP,
    gmail_history_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
```

#### 2. Credit Cards Table

```sql
CREATE TABLE credit_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(50), -- Cashback, Travel, Shopping, etc.
    last_four_digits VARCHAR(4),
    bill_date INTEGER NOT NULL CHECK (bill_date >= 1 AND bill_date <= 31),
    due_date INTEGER NOT NULL CHECK (due_date >= 1 AND due_date <= 31),
    credit_limit DECIMAL(10, 2),
    current_outstanding DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    card_activation_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX idx_credit_cards_bill_date ON credit_cards(bill_date);
```

#### 3. Transactions Table

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(card_id) ON DELETE CASCADE,
    transaction_date TIMESTAMP NOT NULL,
    merchant_name VARCHAR(255),
    merchant_category VARCHAR(100), -- Groceries, Dining, Travel, etc.
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type VARCHAR(20) DEFAULT 'debit', -- debit, credit, refund
    description TEXT,
    billing_cycle_month INTEGER, -- 1-12
    billing_cycle_year INTEGER,
    email_message_id VARCHAR(255), -- Gmail message ID
    is_manually_added BOOLEAN DEFAULT false,
    metadata JSONB, -- For flexible additional data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_card_id ON transactions(card_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_billing_cycle ON transactions(billing_cycle_year, billing_cycle_month);
CREATE INDEX idx_transactions_email_message_id ON transactions(email_message_id);
```

#### 4. Budget Tracking Table

```sql
CREATE TABLE budget_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    budget_limit DECIMAL(10, 2) NOT NULL,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

CREATE INDEX idx_budget_tracking_user_period ON budget_tracking(user_id, year, month);
```

#### 5. Alerts Table

```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- budget_exceeded, bill_reminder, due_reminder
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_via_email BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON alerts(user_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
```

#### 6. Email Processing Log Table

```sql
CREATE TABLE email_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email_message_id VARCHAR(255) UNIQUE NOT NULL,
    subject VARCHAR(500),
    from_email VARCHAR(255),
    received_date TIMESTAMP,
    processing_status VARCHAR(50), -- pending, processed, failed, skipped
    transaction_id UUID REFERENCES transactions(id),
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_log_user_id ON email_processing_log(user_id);
CREATE INDEX idx_email_log_message_id ON email_processing_log(email_message_id);
CREATE INDEX idx_email_log_status ON email_processing_log(processing_status);
```

#### 7. Analytics Cache Table

```sql
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    metric_key VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    period_start DATE,
    period_end DATE,
    computed_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(user_id, metric_key, period_start, period_end)
);

CREATE INDEX idx_analytics_cache_user_metric ON analytics_cache(user_id, metric_key);
```

---

## 🏛️ Component Architecture

### Frontend Components Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── callback/
│   ├── (dashboard)/
│   │   ├── overview/          # Dashboard home
│   │   ├── cards/             # All cards list
│   │   │   └── [cardId]/      # Individual card details
│   │   ├── transactions/      # All transactions view
│   │   ├── analytics/         # Analytics & insights
│   │   ├── settings/          # User settings
│   │   └── layout.tsx
│   └── layout.tsx
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── cards/
│   │   ├── CardList.tsx
│   │   ├── CardItem.tsx
│   │   └── CardDetails.tsx
│   ├── transactions/
│   │   ├── TransactionTable.tsx
│   │   ├── TransactionFilters.tsx
│   │   └── TransactionForm.tsx
│   ├── analytics/
│   │   ├── SpendingChart.tsx
│   │   ├── CategoryBreakdown.tsx
│   │   └── TrendAnalysis.tsx
│   ├── dashboard/
│   │   ├── OverviewCards.tsx
│   │   ├── RecentActivity.tsx
│   │   └── BudgetProgress.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
├── lib/
│   ├── api/                   # API client functions
│   ├── utils/                 # Utility functions
│   ├── hooks/                 # Custom React hooks
│   └── auth/                  # Auth utilities
├── store/                     # State management
└── types/                     # TypeScript types
```

---

## 🔧 Service Architecture

### Backend Services Structure

```
services/
├── api-gateway/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   ├── cards.ts
│   │   │   ├── transactions.ts
│   │   │   ├── analytics.ts
│   │   │   └── budget.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimiter.ts
│   │   │   └── errorHandler.ts
│   │   ├── controllers/
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── gmail-pubsub-service/
│   ├── src/
│   │   ├── pubsub/
│   │   │   ├── listener.ts
│   │   │   └── handler.ts
│   │   ├── gmail/
│   │   │   ├── client.ts
│   │   │   └── watch.ts
│   │   ├── parsers/
│   │   │   ├── transactionParser.ts
│   │   │   └── emailClassifier.ts
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── transaction-extraction-service/
│   ├── src/
│   │   ├── extractors/
│   │   │   ├── llmExtractor.ts      # GPT/Gemini-based
│   │   │   ├── regexExtractor.ts    # Pattern-based
│   │   │   └── templateMatcher.ts   # Bank-specific templates
│   │   ├── categorizers/
│   │   │   └── merchantCategorizer.ts
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── historical-scanner-service/
│   ├── src/
│   │   ├── scanner.ts
│   │   ├── batchProcessor.ts
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── alert-service/
│   ├── src/
│   │   ├── checkers/
│   │   │   ├── budgetChecker.ts
│   │   │   └── billReminderChecker.ts
│   │   ├── notifiers/
│   │   │   ├── emailNotifier.ts
│   │   │   └── inAppNotifier.ts
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── analytics-service/
│   ├── src/
│   │   ├── calculators/
│   │   │   ├── kpiCalculator.ts
│   │   │   ├── trendAnalyzer.ts
│   │   │   └── categoryAnalyzer.ts
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
└── shared/
    ├── database/
    │   ├── supabase.ts
    │   └── queries.ts
    ├── cache/
    │   └── redis.ts
    └── types/
        └── index.ts
```

---

## 👤 User Flow

### 1. Authentication Flow

```
User clicks "Sign in with Google"
    ↓
Redirect to Google OAuth consent screen
    ↓
User authorizes application
    ↓
Callback with authorization code
    ↓
Exchange code for access token & refresh token
    ↓
Fetch user profile from Google
    ↓
Create/Update user record in database
    ↓
Generate JWT token
    ↓
Store session in Redis
    ↓
Redirect to dashboard with JWT cookie
```

### 2. Gmail Integration Flow

```
User authorizes Gmail access during onboarding
    ↓
Store Gmail refresh token securely
    ↓
Set up Gmail Pub/Sub watch (7-day expiration)
    ↓
Background service auto-renews watch before expiration
    ↓
New email arrives → Gmail sends Pub/Sub notification
    ↓
Pub/Sub listener receives notification
    ↓
Fetch email content via Gmail API
    ↓
Classify email (transaction/non-transaction)
    ↓
If transaction → Extract details
    ↓
Validate and deduplicate
    ↓
Store in transactions table
    ↓
Update budget tracking
    ↓
Check for budget alerts
    ↓
Update analytics cache
```

### 3. Transaction Management Flow

```
View Transactions Page
    ↓
Apply filters (date range, card, category)
    ↓
API fetches from database (with Redis cache)
    ↓
Display paginated results
    ↓
User can:
    - View details
    - Edit transaction
    - Delete transaction
    - Add manual transaction
    - Export to CSV
```

### 4. Budget Alert Flow

```
Daily cron job (00:00 UTC)
    ↓
For each active user:
    ↓
Calculate current month spending
    ↓
Compare with monthly budget limit
    ↓
If exceeded:
    ↓
Check if alert already sent
    ↓
If not:
    - Create alert record
    - Send email notification
    - Create in-app notification
    - Mark alert as sent
```

---

## 🔌 API Design

### API Standards & Conventions

#### General Guidelines

- **Base URL**: `https://api.yourdomain.com/v1`
- **Protocol**: HTTPS only
- **Format**: JSON for request/response bodies
- **Authentication**: Bearer token in Authorization header
- **Rate Limiting**: 100 requests/minute per user
- **Pagination**: Cursor-based for large datasets
- **Error Format**: Consistent error response structure

```typescript
// Standard Error Response
interface ErrorResponse {
  error: {
    code: string; // Error code (e.g., "INVALID_REQUEST")
    message: string; // Human-readable message
    details?: any; // Additional error details
    timestamp: string; // ISO 8601 timestamp
    requestId: string; // Unique request identifier
  };
}

// Standard Success Response (List)
interface ListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}
```

### Authentication Endpoints

#### POST /api/auth/google

**Purpose**: Exchange Google OAuth code for application JWT token

**Request**:

```typescript
{
  code: string; // Authorization code from Google OAuth
  redirectUri: string; // Must match registered redirect URI
}
```

**Response (Success - 200)**:

```typescript
{
  token: string; // JWT token (7-day expiration)
  refreshToken: string; // Refresh token (30-day expiration)
  user: {
    id: string;
    email: string;
    name: string;
    profilePicture: string;
    createdAt: string;
    lastLoginAt: string;
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid authorization code
- `401 Unauthorized`: OAuth validation failed
- `500 Internal Server Error`: Server-side error

**Business Rules**:

1. First-time users are automatically registered
2. Gmail access scope must be granted for transaction extraction
3. Session is created in Redis with 7-day TTL
4. User's last login timestamp is updated

---

#### POST /api/auth/logout

**Purpose**: Invalidate user session and JWT token

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  message: string;
}
```

**Business Rules**:

1. JWT token is blacklisted in Redis
2. User session is removed from Redis
3. Active refresh tokens are invalidated

---

#### GET /api/auth/me

**Purpose**: Retrieve current authenticated user's profile

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200)**:

```typescript
{
  user: {
    id: string;
    email: string;
    name: string;
    profilePicture: string;
    monthlyBudget: number;
    gmailConnected: boolean;
    gmailWatchExpiry: string | null;
    isActive: boolean;
    preferences: {
      currency: string;
      timezone: string;
      notificationsEnabled: boolean;
      emailAlerts: boolean;
    }
    statistics: {
      totalCards: number;
      totalTransactions: number;
      currentMonthSpending: number;
    }
    createdAt: string;
    updatedAt: string;
  }
}
```

**Business Rules**:

1. Returns cached data when available (5-minute TTL)
2. Statistics are computed on-demand for fresh data

---

#### POST /api/auth/refresh

**Purpose**: Refresh expired JWT token

**Request**:

```typescript
{
  refreshToken: string;
}
```

**Response (Success - 200)**:

```typescript
{
  token: string; // New JWT token
  refreshToken: string; // New refresh token
}
```

**Business Rules**:

1. Old refresh token is invalidated
2. New tokens have same expiration policy
3. Fails if user account is deactivated

### Card Management Endpoints

#### GET /api/cards

**Purpose**: Retrieve all credit cards for authenticated user

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

```typescript
{
  include_inactive?: boolean;    // Include inactive cards (default: false)
  sort_by?: 'name' | 'bank' | 'bill_date' | 'created_at';
  sort_order?: 'asc' | 'desc';
}
```

**Response (Success - 200)**:

```typescript
{
  cards: [
    {
      id: string;
      cardName: string;
      bankName: string;
      cardType: string;           // 'cashback' | 'travel' | 'shopping' | 'premium'
      lastFourDigits: string;
      billDate: number;            // 1-31
      dueDate: number;             // 1-31
      creditLimit: number;
      currentOutstanding: number;
      availableCredit: number;     // Computed: creditLimit - currentOutstanding
      utilizationPercent: number;  // Computed: (currentOutstanding / creditLimit) * 100
      isActive: boolean;
      cardActivationDate: string;
      notes: string;
      nextBillDate: string;        // Computed next bill date
      nextDueDate: string;         // Computed next due date
      daysUntilDue: number;        // Computed days remaining
      totalTransactions: number;   // Count of transactions
      currentMonthSpending: number;
      createdAt: string;
      updatedAt: string;
    }
  ],
  summary: {
    totalCards: number;
    activeCards: number;
    totalCreditLimit: number;
    totalOutstanding: number;
    averageUtilization: number;
  }
}
```

**Business Rules**:

1. Only returns cards belonging to authenticated user
2. Results cached in Redis for 30 minutes
3. Default sort: by bank name ascending
4. Outstanding balance updated daily via cron job

---

#### POST /api/cards

**Purpose**: Add a new credit card

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Request**:

```typescript
{
  cardName: string;              // Required, e.g., "HDFC Swiggy Credit Card"
  bankName: string;              // Required, e.g., "HDFC Bank"
  cardType?: string;             // Optional: 'cashback' | 'travel' | 'shopping' | 'premium'
  lastFourDigits?: string;       // Optional, 4 digits
  billDate: number;              // Required, 1-31
  dueDate: number;               // Required, 1-31
  creditLimit?: number;          // Optional, in INR
  cardActivationDate?: string;   // Optional, ISO 8601 date
  notes?: string;                // Optional, user notes
}
```

**Validation Rules**:

- `cardName`: 3-100 characters, alphanumeric with spaces
- `bankName`: 2-50 characters
- `lastFourDigits`: Exactly 4 numeric digits if provided
- `billDate`: Integer between 1-31
- `dueDate`: Integer between 1-31
- `creditLimit`: Positive number if provided
- `billDate` should be before `dueDate` (considering month rollover)

**Response (Success - 201)**:

```typescript
{
  card: {
    id: string;
    cardName: string;
    bankName: string;
    // ... all card fields
    createdAt: string;
    updatedAt: string;
  }
}
```

**Error Responses**:

- `400 Bad Request`: Validation errors
- `409 Conflict`: Duplicate card (same name + last 4 digits)
- `422 Unprocessable Entity`: Invalid date logic

**Business Rules**:

1. Maximum 20 cards per user
2. Card name + last 4 digits combination must be unique per user
3. Bill date reminder scheduled automatically
4. Due date reminder scheduled automatically
5. User cache invalidated on card creation

---

#### GET /api/cards/:cardId

**Purpose**: Retrieve detailed information for a specific card

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

```typescript
{
  include_transactions?: boolean;      // Include recent transactions (default: true)
  transaction_limit?: number;          // Max transactions to return (default: 10)
  include_insights?: boolean;          // Include card insights (default: true)
  period?: 'current_month' | 'last_month' | 'last_3_months';
}
```

**Response (Success - 200)**:

```typescript
{
  card: {
    // All card fields (same as GET /api/cards)
    id: string;
    cardName: string;
    // ... etc
  },
  transactions: [
    {
      id: string;
      transactionDate: string;
      merchantName: string;
      merchantCategory: string;
      amount: number;
      transactionType: 'debit' | 'credit' | 'refund';
      description: string;
      billingCycleMonth: number;
      billingCycleYear: number;
      isManuallyAdded: boolean;
    }
  ],
  billingCycles: [
    {
      month: number;
      year: number;
      totalSpending: number;
      transactionCount: number;
      averageTransaction: number;
      largestTransaction: {
        amount: number;
        merchant: string;
        date: string;
      };
    }
  ],
  insights: {
    currentCycle: {
      spending: number;
      transactions: number;
      daysRemaining: number;
      projectedTotal: number;        // Based on daily average
    },
    topCategories: [
      {
        category: string;
        amount: number;
        percentage: number;
        transactionCount: number;
      }
    ],
    topMerchants: [
      {
        merchant: string;
        amount: number;
        transactionCount: number;
        lastTransaction: string;
      }
    ],
    spendingTrend: {
      direction: 'increasing' | 'decreasing' | 'stable';
      percentage: number;              // Change from previous period
    },
    recommendations: [
      {
        type: 'warning' | 'info' | 'suggestion';
        message: string;
        action?: string;
      }
    ]
  }
}
```

**Business Rules**:

1. Transactions sorted by date descending
2. Insights computed based on specified period
3. Cache insights for 6 hours
4. Only return data for user's own cards

---

#### PUT /api/cards/:cardId

**Purpose**: Update credit card details

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Request** (all fields optional):

```typescript
{
  cardName?: string;
  cardType?: string;
  lastFourDigits?: string;
  billDate?: number;
  dueDate?: number;
  creditLimit?: number;
  isActive?: boolean;
  notes?: string;
}
```

**Response (Success - 200)**:

```typescript
{
  card: {
    // Updated card object
  }
}
```

**Business Rules**:

1. Cannot change `bankName` or `cardActivationDate`
2. Changing bill/due dates updates reminder schedules
3. Deactivating card doesn't delete transactions
4. Cache invalidated on update

---

#### DELETE /api/cards/:cardId

**Purpose**: Delete a credit card (soft delete)

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  message: string;
}
```

**Business Rules**:

1. Soft delete - card marked as inactive
2. Transactions remain in database
3. Card not shown in default listings
4. Can be reactivated via support
5. Reminders automatically disabled

---

#### GET /api/cards/:cardId/statements

**Purpose**: Retrieve monthly statements for a card

**Query Parameters**:

```typescript
{
  year?: number;                    // Default: current year
  month?: number;                   // Default: all months
}
```

**Response (Success - 200)**:

```typescript
{
  statements: [
    {
      month: number;
      year: number;
      billingPeriod: {
        start: string;
        end: string;
      };
      totalSpending: number;
      totalRefunds: number;
      netAmount: number;
      transactionCount: number;
      categoryBreakdown: [
        {
          category: string;
          amount: number;
          percentage: number;
        }
      ];
      topTransactions: Transaction[];
    }
  ]
}
```

**Business Rules**:

1. Statement generated based on bill date
2. Transactions grouped by billing cycle
3. Cached monthly after cycle completes

### Transaction Management Endpoints

#### GET /api/transactions

**Purpose**: Retrieve paginated list of transactions with filtering

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

```typescript
{
  // Pagination
  page?: number;                     // Default: 1
  limit?: number;                    // Default: 50, Max: 100
  cursor?: string;                   // For cursor-based pagination

  // Filters
  card_id?: string;                  // Filter by specific card
  card_ids?: string[];               // Filter by multiple cards (comma-separated)
  start_date?: string;               // ISO 8601 date (inclusive)
  end_date?: string;                 // ISO 8601 date (inclusive)
  category?: string;                 // Filter by category
  categories?: string[];             // Multiple categories
  transaction_type?: 'debit' | 'credit' | 'refund';
  min_amount?: number;               // Minimum transaction amount
  max_amount?: number;               // Maximum transaction amount
  search?: string;                   // Search in merchant name/description

  // Billing cycle filters
  billing_month?: number;            // 1-12
  billing_year?: number;             // YYYY

  // Sorting
  sort_by?: 'date' | 'amount' | 'merchant';
  sort_order?: 'asc' | 'desc';       // Default: desc for date

  // Additional options
  include_metadata?: boolean;        // Include full metadata
  group_by?: 'date' | 'category' | 'merchant';
}
```

**Response (Success - 200)**:

```typescript
{
  transactions: [
    {
      id: string;
      cardId: string;
      cardName: string;               // Populated from card
      bankName: string;               // Populated from card
      transactionDate: string;        // ISO 8601
      merchantName: string;
      merchantCategory: string;
      amount: number;
      transactionType: 'debit' | 'credit' | 'refund';
      description: string;
      billingCycleMonth: number;
      billingCycleYear: number;
      emailMessageId: string | null;
      isManuallyAdded: boolean;
      metadata: {
        extractionMethod?: 'email' | 'manual' | 'import';
        confidence?: number;          // For AI-extracted transactions
        originalText?: string;        // Source email text
      };
      createdAt: string;
      updatedAt: string;
    }
  ],
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
    nextCursor: string | null;
  },
  aggregations: {
    totalAmount: number;
    averageAmount: number;
    transactionCount: number;
    categoryBreakdown: {
      [category: string]: {
        count: number;
        total: number;
      }
    }
  }
}
```

**Business Rules**:

1. Maximum 100 transactions per request
2. Results cached for 5 minutes with filter hash
3. Default date range: current month
4. Search is case-insensitive and matches partial strings
5. Transactions always filtered by user_id (implicit)

---

#### POST /api/transactions

**Purpose**: Manually add a transaction

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Request**:

```typescript
{
  cardId: string;                    // Required
  transactionDate: string;           // Required, ISO 8601
  merchantName: string;              // Required, 2-100 chars
  amount: number;                    // Required, positive number
  transactionType?: 'debit' | 'credit' | 'refund';  // Default: 'debit'
  category?: string;                 // Optional, auto-categorized if empty
  description?: string;              // Optional
  metadata?: {                       // Optional additional data
    notes?: string;
    tags?: string[];
    location?: string;
  };
}
```

**Validation Rules**:

- `cardId`: Must exist and belong to user
- `transactionDate`: Cannot be in future, not older than 5 years
- `merchantName`: 2-100 characters, alphanumeric with spaces/hyphens
- `amount`: Positive decimal, max 10 digits
- `category`: If provided, must be from predefined list

**Response (Success - 201)**:

```typescript
{
  transaction: {
    id: string;
    // ... all transaction fields
    isManuallyAdded: true;
    billingCycleMonth: number; // Auto-computed based on card's bill date
    billingCycleYear: number;
    merchantCategory: string; // Auto-assigned if not provided
    createdAt: string;
  }
}
```

**Business Rules**:

1. Billing cycle computed based on card's bill date
2. Merchant auto-categorized using ML/rules if not provided
3. Budget tracking updated immediately
4. Cache invalidated for affected queries
5. Alert check triggered if monthly limit approached

---

#### GET /api/transactions/:txnId

**Purpose**: Get detailed information for a specific transaction

**Response (Success - 200)**:

```typescript
{
  transaction: {
    // All transaction fields
    id: string;
    // ... etc
  },
  card: {
    id: string;
    cardName: string;
    bankName: string;
  },
  relatedTransactions: [           // Similar transactions (same merchant)
    {
      id: string;
      transactionDate: string;
      amount: number;
    }
  ],
  emailSource: {                   // If extracted from email
    subject: string;
    from: string;
    receivedDate: string;
    snippet: string;
  }
}
```

---

#### PUT /api/transactions/:txnId

**Purpose**: Update transaction details

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Request** (all fields optional):

```typescript
{
  merchantName?: string;
  category?: string;
  description?: string;
  amount?: number;                   // Can be corrected if wrong
  transactionDate?: string;          // Can be corrected
  transactionType?: 'debit' | 'credit' | 'refund';
  metadata?: object;
}
```

**Response (Success - 200)**:

```typescript
{
  transaction: {
    // Updated transaction object
    updatedAt: string; // New timestamp
  }
}
```

**Business Rules**:

1. Cannot change `cardId` or `emailMessageId`
2. Cannot modify if transaction is locked (statement generated)
3. Billing cycle recalculated if date changes
4. Budget tracking adjusted accordingly
5. Audit log created for all changes

---

#### DELETE /api/transactions/:txnId

**Purpose**: Delete a transaction (soft delete)

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  message: string;
  affectedBudget: {
    previousTotal: number;
    newTotal: number;
    difference: number;
  }
}
```

**Business Rules**:

1. Soft delete - marked as deleted, not removed
2. Budget tracking updated
3. Cannot delete transactions from locked billing cycles
4. Email-extracted transactions can be deleted (but may be re-added)
5. Cache invalidated

---

#### GET /api/transactions/export

**Purpose**: Export transactions in various formats

**Query Parameters**:

```typescript
{
  format: 'csv' | 'excel' | 'json' | 'pdf';  // Required
  // All filters from GET /api/transactions
  card_id?: string;
  start_date?: string;
  end_date?: string;
  category?: string;
  // ... etc
}
```

**Response (Success - 200)**:

- Content-Type: `text/csv` or `application/vnd.ms-excel` or `application/json` or `application/pdf`
- File download with appropriate filename

**CSV Format**:

```
Date,Card Name,Bank,Merchant,Category,Amount,Type,Description
2024-01-15,HDFC Swiggy,HDFC Bank,Swiggy,Dining,450.00,debit,Food order
```

**Excel Format**: Multiple sheets

- Sheet 1: Transactions (all columns)
- Sheet 2: Category Summary
- Sheet 3: Monthly Summary
- Sheet 4: Card-wise Summary

**PDF Format**: Formatted statement with:

- Summary section
- Transaction table
- Category breakdown chart
- Monthly trend chart

**Business Rules**:

1. Maximum 10,000 transactions per export
2. Export job queued if > 1,000 transactions
3. Email sent with download link when ready
4. Exports include applied filters in filename
5. Rate limited to 5 exports per hour per user

---

#### POST /api/transactions/bulk-import

**Purpose**: Bulk import transactions from CSV/Excel file

**Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request**:

```typescript
{
  file: File;                        // CSV or Excel file
  cardId: string;                    // Target card
  dateFormat?: string;               // e.g., 'DD/MM/YYYY'
  skipDuplicates?: boolean;          // Default: true
  autoCategories?: boolean;          // Auto-categorize (default: true)
}
```

**CSV Expected Format**:

```
Date,Merchant,Amount,Category,Description
15/01/2024,Swiggy,450.00,Dining,Food order
```

**Response (Success - 200)**:

```typescript
{
  summary: {
    totalRows: number;
    imported: number;
    skipped: number;
    failed: number;
  },
  results: [
    {
      row: number;
      status: 'imported' | 'skipped' | 'failed';
      reason?: string;
      transactionId?: string;
    }
  ]
}
```

**Business Rules**:

1. Maximum 1,000 rows per import
2. Duplicate detection by date + merchant + amount
3. Invalid rows logged but don't stop import
4. Validation errors returned with row numbers
5. Budget tracking updated after import

---

#### POST /api/transactions/categorize

**Purpose**: Batch re-categorize transactions using AI

**Request**:

```typescript
{
  transactionIds: string[];          // Max 100
  method?: 'auto' | 'manual';        // Default: 'auto'
  category?: string;                 // For manual categorization
}
```

**Response (Success - 200)**:

```typescript
{
  updated: number;
  transactions: [
    {
      id: string;
      previousCategory: string;
      newCategory: string;
      confidence: number;
    }
  ]
}
```

---

#### GET /api/transactions/duplicates

**Purpose**: Find potential duplicate transactions

**Query Parameters**:

```typescript
{
  threshold?: number;                // Similarity threshold (0-1), default: 0.9
  start_date?: string;
  end_date?: string;
}
```

**Response (Success - 200)**:

```typescript
{
  duplicateGroups: [
    {
      groupId: string;
      confidence: number;
      transactions: [
        {
          id: string;
          transactionDate: string;
          merchantName: string;
          amount: number;
          cardName: string;
        }
      ],
      suggestion: 'keep_all' | 'merge' | 'delete_duplicates';
    }
  ]
}
```

**Business Rules**:

1. Compares by date (±2 days), merchant (fuzzy match), amount (exact)
2. Email-extracted vs manual transactions compared
3. User review required before deletion
4. Confidence score based on matching criteria

### Analytics & Insights Endpoints

#### GET /api/analytics/overview

**Purpose**: Get comprehensive dashboard overview with key metrics

**Query Parameters**:

```typescript
{
  period?: 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'year' | 'all_time';
  month?: number;                    // Specific month (1-12)
  year?: number;                     // Specific year
  compare?: boolean;                 // Include comparison with previous period
  card_ids?: string[];               // Filter by specific cards
}
```

**Response (Success - 200)**:

```typescript
{
  period: {
    start: string;
    end: string;
    label: string;                   // e.g., "January 2024"
  },
  summary: {
    totalSpent: number;
    totalTransactions: number;
    averageTransaction: number;
    largestTransaction: {
      id: string;
      amount: number;
      merchant: string;
      date: string;
    };
    smallestTransaction: {
      id: string;
      amount: number;
      merchant: string;
      date: string;
    };
    totalRefunds: number;
    netSpending: number;             // Total spent - refunds
  },
  comparison: {                      // If compare=true
    previousPeriod: {
      totalSpent: number;
      totalTransactions: number;
    };
    changes: {
      spendingChange: number;        // Percentage
      spendingDifference: number;    // Absolute
      transactionChange: number;     // Percentage
      direction: 'up' | 'down' | 'stable';
    };
  },
  cardWiseSpending: [
    {
      cardId: string;
      cardName: string;
      bankName: string;
      totalSpent: number;
      transactionCount: number;
      percentage: number;            // Of total spending
      averageTransaction: number;
      mostUsedCategory: string;
    }
  ],
  categoryBreakdown: [
    {
      category: string;
      totalSpent: number;
      transactionCount: number;
      percentage: number;
      averageTransaction: number;
      topMerchants: [
        {
          merchant: string;
          amount: number;
        }
      ];
      trend: 'increasing' | 'decreasing' | 'stable';
    }
  ],
  monthlyTrend: [                    // For longer periods
    {
      month: string;                 // "Jan 2024"
      totalSpent: number;
      transactionCount: number;
      averagePerDay: number;
    }
  ],
  dailySpending: [                   // For current/single month
    {
      date: string;
      amount: number;
      transactionCount: number;
    }
  ],
  insights: [
    {
      type: 'positive' | 'negative' | 'neutral' | 'warning';
      category: 'spending' | 'savings' | 'habit' | 'alert';
      title: string;
      description: string;
      value?: number;
      action?: {
        label: string;
        link: string;
      };
    }
  ]
}
```

**Sample Insights**:

```typescript
// Positive
{
  type: 'positive',
  category: 'savings',
  title: 'Great job!',
  description: 'You spent 15% less than last month',
  value: 4500
}

// Warning
{
  type: 'warning',
  category: 'alert',
  title: 'High spending detected',
  description: 'Your dining expenses are 40% higher than usual',
  value: 12000,
  action: {
    label: 'View details',
    link: '/transactions?category=dining'
  }
}

// Habit
{
  type: 'neutral',
  category: 'habit',
  title: 'Spending pattern',
  description: 'You typically spend more on weekends',
  value: null
}
```

**Business Rules**:

1. Cache results for 1 hour
2. Default period: current month
3. Insights generated by AI/rules engine
4. Maximum 10 insights returned
5. Data refreshed daily at 2 AM

---

#### GET /api/analytics/categories

**Purpose**: Detailed category-wise spending analysis

**Query Parameters**:

```typescript
{
  start_date?: string;
  end_date?: string;
  sort_by?: 'amount' | 'count' | 'average';
  sort_order?: 'asc' | 'desc';
  top?: number;                      // Return only top N categories
}
```

**Response (Success - 200)**:

```typescript
{
  categories: [
    {
      category: string;
      totalSpent: number;
      transactionCount: number;
      percentage: number;
      averageTransaction: number;
      monthlyAverage: number;
      trend: {
        direction: 'increasing' | 'decreasing' | 'stable';
        percentage: number;
        visualization: number[];     // Last 6 months data points
      };
      topMerchants: [
        {
          merchant: string;
          amount: number;
          transactionCount: number;
          percentage: number;        // Of category total
        }
      ];
      timeDistribution: {
        weekday: number;
        weekend: number;
        morning: number;             // 6 AM - 12 PM
        afternoon: number;           // 12 PM - 6 PM
        evening: number;             // 6 PM - 12 AM
        night: number;               // 12 AM - 6 AM
      };
      recommendations: [
        {
          type: 'savings' | 'optimization' | 'alert';
          message: string;
        }
      ]
    }
  ],
  summary: {
    totalCategories: number;
    topCategory: string;
    mostFrequentCategory: string;
    diversificationScore: number;    // 0-100, higher = more diverse
  }
}
```

**Business Rules**:

1. Default: last 3 months
2. Categories standardized to predefined list
3. Uncategorized transactions grouped separately
4. Cache for 6 hours

---

#### GET /api/analytics/trends

**Purpose**: Time-based spending trends and patterns

**Query Parameters**:

```typescript
{
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date?: string;
  end_date?: string;
  metric?: 'amount' | 'count' | 'average';
  group_by?: 'card' | 'category';
}
```

**Response (Success - 200)**:

```typescript
{
  period: string;
  dataPoints: [
    {
      date: string;
      label: string;                 // e.g., "Week 1, Jan 2024"
      value: number;
      transactionCount: number;
      breakdown?: {                  // If group_by specified
        [key: string]: number;
      };
    }
  ],
  statistics: {
    average: number;
    median: number;
    stdDeviation: number;
    min: {
      value: number;
      date: string;
    };
    max: {
      value: number;
      date: string;
    };
  },
  predictions: {                     // Simple linear prediction
    nextPeriod: {
      estimated: number;
      confidence: 'low' | 'medium' | 'high';
      range: {
        min: number;
        max: number;
      };
    };
  },
  patterns: [
    {
      type: 'seasonal' | 'cyclic' | 'trend';
      description: string;
      confidence: number;            // 0-1
    }
  ]
}
```

**Sample Patterns**:

```typescript
{
  type: 'seasonal',
  description: 'Spending increases by 25% during festive seasons',
  confidence: 0.85
}
```

---

#### GET /api/analytics/kpi

**Purpose**: Key Performance Indicators for financial health

**Query Parameters**:

```typescript
{
  period?: 'current_month' | 'last_month' | 'quarter' | 'year';
}
```

**Response (Success - 200)**:

```typescript
{
  kpis: {
    // Spending Metrics
    totalSpending: {
      value: number;
      change: number;                // Percentage vs previous period
      status: 'good' | 'warning' | 'critical';
    };
    averageDailySpending: {
      value: number;
      change: number;
      projectedMonthly: number;
    };

    // Budget Metrics
    budgetUtilization: {
      percentage: number;
      remaining: number;
      daysRemaining: number;
      dailyBudgetRemaining: number;
      status: 'safe' | 'warning' | 'exceeded';
    };
    savingsVsBudget: {
      amount: number;
      percentage: number;
    };

    // Card Metrics
    mostUsedCard: {
      cardId: string;
      cardName: string;
      transactionCount: number;
      totalSpent: number;
    };
    highestSpendingCard: {
      cardId: string;
      cardName: string;
      amount: number;
    };
    averageUtilization: {
      percentage: number;
      status: 'healthy' | 'high' | 'very_high';
    };

    // Transaction Metrics
    totalTransactions: {
      count: number;
      change: number;
    };
    averageTransactionSize: {
      value: number;
      change: number;
    };
    largestTransaction: {
      amount: number;
      merchant: string;
      date: string;
      category: string;
    };

    // Time-based Metrics
    highestSpendingDay: {
      date: string;
      amount: number;
    };
    highestSpendingWeek: {
      week: string;
      amount: number;
    };

    // Category Metrics
    topCategory: {
      category: string;
      amount: number;
      percentage: number;
    };
    categoryDiversity: {
      score: number;                 // 0-100
      categoriesUsed: number;
    };

    // Efficiency Metrics
    cashbackEarned: {
      estimated: number;
      byCard: [
        {
          cardName: string;
          amount: number;
        }
      ];
    };
    rewardPointsEarned: {
      estimated: number;
      byCard: [
        {
          cardName: string;
          points: number;
        }
      ];
    };

    // Health Score
    financialHealthScore: {
      score: number;                 // 0-100
      factors: [
        {
          name: string;
          score: number;
          weight: number;
          impact: 'positive' | 'negative' | 'neutral';
        }
      ];
      recommendations: string[];
    };
  },

  // Historical comparison
  historical: {
    lastMonth: {
      totalSpending: number;
      transactions: number;
    };
    lastQuarter: {
      averageMonthlySpending: number;
    };
    lastYear: {
      averageMonthlySpending: number;
    };
  }
}
```

**Financial Health Score Calculation**:

```typescript
// Factors (100 points total)
{
  budgetAdherence: 25,               // Staying within budget
  utilizationRatio: 20,              // Credit utilization < 30%
  paymentConsistency: 20,            // No missed payments
  diversification: 15,               // Spending across categories
  savingsRate: 15,                   // Spending vs income
  trendDirection: 5                  // Decreasing spending trend
}
```

**Business Rules**:

1. KPIs computed daily and cached
2. Status thresholds configurable per user
3. Cashback estimated using card-specific rates
4. Health score updated weekly

---

#### GET /api/analytics/merchants

**Purpose**: Merchant-level spending analysis

**Query Parameters**:

```typescript
{
  start_date?: string;
  end_date?: string;
  top?: number;                      // Default: 20
  min_transactions?: number;         // Filter by frequency
}
```

**Response (Success - 200)**:

```typescript
{
  merchants: [
    {
      merchantName: string;
      category: string;
      totalSpent: number;
      transactionCount: number;
      averageTransaction: number;
      firstTransaction: string;
      lastTransaction: string;
      frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
      trend: 'increasing' | 'decreasing' | 'stable';
      cardsUsed: [
        {
          cardName: string;
          count: number;
          amount: number;
        }
      ];
      monthlyBreakdown: [
        {
          month: string;
          amount: number;
          count: number;
        }
      ];
    }
  ]
}
```

---

#### GET /api/analytics/reports/monthly

**Purpose**: Generate comprehensive monthly report

**Query Parameters**:

```typescript
{
  month: number;                     // Required
  year: number;                      // Required
  format?: 'json' | 'pdf';           // Default: json
}
```

**Response (Success - 200)**:
Comprehensive JSON report or PDF download

**Report Sections**:

1. Executive Summary
2. Spending Overview
3. Card-wise Analysis
4. Category Breakdown
5. Top Merchants
6. Trends & Patterns
7. Budget Performance
8. Recommendations
9. Goals Progress (if set)

---

#### POST /api/analytics/goals

**Purpose**: Set financial goals

**Request**:

```typescript
{
  type: 'spending_limit' | 'savings' | 'category_limit' | 'debt_payoff';
  name: string;
  targetAmount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  category?: string;                 // For category_limit
  cardId?: string;                   // For card-specific goals
  startDate: string;
  endDate: string;
}
```

**Response (Success - 201)**:

```typescript
{
  goal: {
    id: string;
    type: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progress: number; // Percentage
    status: "on_track" | "at_risk" | "achieved" | "missed";
    remainingAmount: number;
    daysRemaining: number;
    dailyRequirement: number;
    createdAt: string;
  }
}
```

---

#### GET /api/analytics/goals

**Purpose**: Get all goals with progress

**Response (Success - 200)**:

```typescript
{
  goals: [
    {
      // All goal fields
      id: string;
      // ... etc
      history: [
        {
          date: string;
          amount: number;
          progress: number;
        }
      ];
    }
  ],
  summary: {
    totalGoals: number;
    active: number;
    achieved: number;
    missed: number;
  }
}
```

### Budget Management Endpoints

#### GET /api/budget/current

**Purpose**: Get current month's budget status and spending

**Response (Success - 200)**:

```typescript
{
  budget: {
    monthlyLimit: number;
    spent: number;
    remaining: number;
    percentage: number;              // (spent / limit) * 100
    status: 'safe' | 'warning' | 'critical' | 'exceeded';

    // Time-based projections
    daysInMonth: number;
    daysElapsed: number;
    daysRemaining: number;
    projectedTotal: number;          // Based on current spending rate
    projectedStatus: 'safe' | 'warning' | 'critical' | 'exceeded';

    // Daily breakdown
    averageDailySpent: number;
    budgetPerDayRemaining: number;
    optimalDailySpending: number;    // Remaining budget / days remaining

    // Alert information
    alertTriggered: boolean;
    alertSentAt: string | null;
    nextAlertAt: string | null;      // When next alert will check
  },

  breakdown: {
    byCard: [
      {
        cardId: string;
        cardName: string;
        spent: number;
        percentage: number;
      }
    ],
    byCategory: [
      {
        category: string;
        spent: number;
        percentage: number;
        budget?: number;               // If category-specific budget set
      }
    ],
    byWeek: [
      {
        week: number;
        start: string;
        end: string;
        spent: number;
      }
    ]
  },

  insights: [
    {
      type: 'info' | 'warning' | 'success';
      message: string;
      action?: string;
    }
  ],

  recommendations: [
    {
      priority: 'high' | 'medium' | 'low';
      message: string;
      potentialSavings?: number;
    }
  ]
}
```

**Status Thresholds**:

- `safe`: < 70% of budget
- `warning`: 70-90% of budget
- `critical`: 90-100% of budget
- `exceeded`: > 100% of budget

**Sample Insights**:

```typescript
// Warning
{
  type: 'warning',
  message: 'You are spending 23% faster than optimal pace',
  action: 'Reduce daily spending to ₹800 to stay within budget'
}

// Success
{
  type: 'success',
  message: 'Great! You are ₹5,000 under budget with 10 days remaining',
  action: null
}
```

**Business Rules**:

1. Refreshed every hour
2. Projections based on spending velocity
3. Status changes trigger immediate notifications
4. Category budgets are optional sub-limits

---

#### PUT /api/budget

**Purpose**: Update monthly budget limit

**Request**:

```typescript
{
  monthlyLimit: number;              // Required, positive number
  effectiveFrom?: 'current_month' | 'next_month'; // Default: next_month
  categoryBudgets?: [                // Optional category-specific limits
    {
      category: string;
      limit: number;
    }
  ];
  alerts?: {
    enabled: boolean;
    thresholds: number[];            // Percentage thresholds [70, 90, 100]
    channels: ('email' | 'in_app')[];
  };
}
```

**Validation Rules**:

- `monthlyLimit`: Must be positive, max 10,00,000
- Sum of category budgets cannot exceed monthly limit
- Thresholds must be between 1-100

**Response (Success - 200)**:

```typescript
{
  budget: {
    id: string;
    userId: string;
    monthlyLimit: number;
    categoryBudgets: [
      {
        category: string;
        limit: number;
      }
    ];
    alerts: {
      enabled: boolean;
      thresholds: number[];
      channels: string[];
    };
    effectiveFrom: string;
    createdAt: string;
    updatedAt: string;
  },

  impact: {
    previousLimit: number;
    newLimit: number;
    change: number;
    changePercentage: number;
    currentSpending: number;
    newStatus: string;
  }
}
```

**Business Rules**:

1. Default: changes effective next month (avoid mid-month confusion)
2. Can force current month update with `effectiveFrom: 'current_month'`
3. Cache invalidated immediately
4. Alert thresholds recalculated
5. Notification sent confirming change

---

#### GET /api/budget/history

**Purpose**: Historical budget performance

**Query Parameters**:

```typescript
{
  months?: number;                   // Default: 12
  start_date?: string;
  end_date?: string;
}
```

**Response (Success - 200)**:

```typescript
{
  history: [
    {
      month: number;
      year: number;
      label: string;                 // "Jan 2024"
      budgetLimit: number;
      totalSpent: number;
      remaining: number;
      percentage: number;
      status: 'safe' | 'warning' | 'critical' | 'exceeded';

      // Performance metrics
      daysInMonth: number;
      averageDailySpending: number;
      overUnder: number;             // Negative = under budget

      // Breakdown
      topCategory: {
        category: string;
        amount: number;
      };
      totalTransactions: number;

      // Comparisons
      vsAverage: number;             // % difference from average
      vsPreviousMonth: number;       // % difference from previous month
    }
  ],

  summary: {
    averageMonthlySpending: number;
    totalPeriodSpending: number;
    monthsOverBudget: number;
    monthsUnderBudget: number;
    bestMonth: {
      month: string;
      saved: number;
    };
    worstMonth: {
      month: string;
      exceeded: number;
    };
    trend: {
      direction: 'improving' | 'worsening' | 'stable';
      percentage: number;
    };
  },

  charts: {
    monthlyComparison: [
      {
        month: string;
        budget: number;
        spent: number;
      }
    ];
    categoryTrends: [
      {
        category: string;
        data: [
          {
            month: string;
            amount: number;
          }
        ];
      }
    ];
  }
}
```

**Business Rules**:

1. Maximum 24 months of history
2. Cached for 24 hours per month (older months)
3. Current month refreshed hourly
4. Empty months (no budget set) excluded

---

#### POST /api/budget/forecast

**Purpose**: Get spending forecast and budget recommendations

**Request**:

```typescript
{
  targetSavings?: number;            // Desired monthly savings
  horizon?: 'month' | 'quarter' | 'year';
  constraints?: {
    essentialCategories?: string[]; // Categories that can't be reduced
    maxReduction?: number;          // Max % reduction allowed
  };
}
```

**Response (Success - 200)**:

```typescript
{
  forecast: {
    currentTrajectory: {
      estimated: number;
      confidence: 'low' | 'medium' | 'high';
      range: {
        min: number;
        max: number;
      };
    };

    recommendations: [
      {
        category: string;
        currentAverage: number;
        suggestedLimit: number;
        potentialSavings: number;
        difficulty: 'easy' | 'moderate' | 'hard';
        impact: 'low' | 'medium' | 'high';
        tips: string[];
      }
    ];

    optimizedBudget: {
      total: number;
      byCategory: [
        {
          category: string;
          limit: number;
        }
      ];
      expectedSavings: number;
      feasibilityScore: number;      // 0-100
    };
  }
}
```

**Business Rules**:

1. Based on last 6 months spending patterns
2. Machine learning model for predictions
3. Accounts for seasonal variations
4. Conservative estimates for safety

---

#### GET /api/budget/alerts

**Purpose**: Get budget alert history and settings

**Response (Success - 200)**:

```typescript
{
  alerts: [
    {
      id: string;
      type: 'threshold' | 'exceeded' | 'projection';
      threshold: number;             // Percentage
      triggeredAt: string;
      spentAtTrigger: number;
      budgetAtTrigger: number;
      message: string;
      acknowledged: boolean;
      acknowledgedAt: string | null;
    }
  ],

  settings: {
    enabled: boolean;
    thresholds: number[];
    channels: string[];
    frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
    quietHours: {
      enabled: boolean;
      start: string;                 // HH:mm
      end: string;
    };
  }
}
```

---

#### PUT /api/budget/alerts/settings

**Purpose**: Update alert preferences

**Request**:

```typescript
{
  enabled: boolean;
  thresholds: number[];
  channels: ('email' | 'in_app' | 'sms')[];
  frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
}
```

**Response (Success - 200)**:

```typescript
{
  settings: {
    // Updated settings
  }
}
```

---

#### POST /api/budget/simulate

**Purpose**: Simulate budget scenarios

**Request**:

```typescript
{
  scenarios: [
    {
      name: string;
      monthlyLimit: number;
      categoryLimits?: {
        [category: string]: number;
      };
    }
  ];
  period: 'month' | 'quarter' | 'year';
}
```

**Response (Success - 200)**:

```typescript
{
  simulations: [
    {
      scenario: string;
      results: {
        feasibility: number;         // 0-100
        expectedSavings: number;
        riskLevel: 'low' | 'medium' | 'high';
        categoryImpact: [
          {
            category: string;
            currentAverage: number;
            proposedLimit: number;
            reductionRequired: number;
            likelihood: 'high' | 'medium' | 'low';
          }
        ];
        recommendations: string[];
      };
    }
  ];
}
```

**Business Rules**:

1. Maximum 5 scenarios per request
2. Based on historical spending patterns
3. Accounts for spending rigidity by category
4. Provides actionable feedback

### Alert & Notification Endpoints

#### GET /api/alerts

**Purpose**: Retrieve user alerts and notifications

**Query Parameters**:

```typescript
{
  unread_only?: boolean;             // Default: false
  types?: ('budget' | 'bill' | 'due' | 'system' | 'insight')[];
  limit?: number;                    // Default: 50, Max: 100
  offset?: number;
  start_date?: string;
  end_date?: string;
  priority?: 'low' | 'medium' | 'high';
}
```

**Response (Success - 200)**:

```typescript
{
  alerts: [
    {
      id: string;
      type: 'budget_threshold' | 'budget_exceeded' | 'bill_reminder' | 'due_reminder' | 'unusual_activity' | 'system' | 'insight';
      priority: 'low' | 'medium' | 'high';
      title: string;
      message: string;

      // Related data
      metadata: {
        cardId?: string;
        cardName?: string;
        transactionId?: string;
        amount?: number;
        threshold?: number;
        daysUntil?: number;
        // ... other contextual data
      };

      // Status
      isRead: boolean;
      readAt: string | null;
      sentViaEmail: boolean;
      emailSentAt: string | null;

      // Actions
      actionable: boolean;
      actions?: [
        {
          label: string;
          type: 'link' | 'button' | 'dismiss';
          url?: string;
          action?: string;
        }
      ];

      // Timestamps
      createdAt: string;
      expiresAt: string | null;
    }
  ],

  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  },

  summary: {
    totalUnread: number;
    byType: {
      [type: string]: number;
    };
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
  }
}
```

**Alert Types & Examples**:

```typescript
// Budget Threshold Alert
{
  type: 'budget_threshold',
  priority: 'medium',
  title: 'Budget Alert: 70% Reached',
  message: 'You have spent ₹21,000 of your ₹30,000 monthly budget (70%)',
  metadata: {
    spent: 21000,
    budget: 30000,
    threshold: 70,
    remaining: 9000
  },
  actions: [
    {
      label: 'View Spending',
      type: 'link',
      url: '/analytics/overview'
    }
  ]
}

// Bill Reminder Alert
{
  type: 'bill_reminder',
  priority: 'high',
  title: 'Bill Due in 3 Days',
  message: 'Your HDFC Swiggy Credit Card bill of ₹5,240 is due on Jan 13th',
  metadata: {
    cardId: 'card_123',
    cardName: 'HDFC Swiggy Credit Card',
    amount: 5240,
    daysUntil: 3,
    dueDate: '2024-01-13'
  },
  actions: [
    {
      label: 'View Statement',
      type: 'link',
      url: '/cards/card_123/statements'
    },
    {
      label: 'Mark as Paid',
      type: 'button',
      action: 'mark_paid'
    }
  ]
}

// Unusual Activity Alert
{
  type: 'unusual_activity',
  priority: 'high',
  title: 'Unusual Spending Detected',
  message: 'Transaction of ₹15,000 at Flipkart is 3x your average',
  metadata: {
    transactionId: 'txn_456',
    amount: 15000,
    average: 5000,
    merchant: 'Flipkart'
  },
  actions: [
    {
      label: 'View Transaction',
      type: 'link',
      url: '/transactions/txn_456'
    },
    {
      label: 'Report Issue',
      type: 'button',
      action: 'report'
    }
  ]
}

// Insight Alert
{
  type: 'insight',
  priority: 'low',
  title: 'Spending Insight',
  message: 'You spent 40% less on dining this month compared to last month',
  metadata: {
    category: 'dining',
    currentMonth: 3000,
    lastMonth: 5000,
    savings: 2000
  }
}
```

**Business Rules**:

1. Alerts expire after 30 days
2. High-priority alerts always sent via email
3. Maximum 100 alerts stored per user
4. Old alerts auto-archived

---

#### PATCH /api/alerts/:alertId/read

**Purpose**: Mark alert as read

**Response (Success - 200)**:

```typescript
{
  alert: {
    id: string;
    isRead: true;
    readAt: string;
    // ... other alert fields
  }
}
```

**Business Rules**:

1. Updates read status immediately
2. Decrements unread count
3. Cannot mark as unread once read

---

#### PATCH /api/alerts/read-all

**Purpose**: Mark all alerts as read

**Request**:

```typescript
{
  types?: string[];                  // Optional: mark specific types only
  before?: string;                   // Mark all before this date
}
```

**Response (Success - 200)**:

```typescript
{
  updated: number;
  message: string;
}
```

---

#### DELETE /api/alerts/:alertId

**Purpose**: Delete/dismiss an alert

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  message: string;
}
```

**Business Rules**:

1. Soft delete - archived, not removed
2. Cannot delete system-critical alerts
3. Dismissed alerts don't reappear

---

#### DELETE /api/alerts/clear

**Purpose**: Clear multiple alerts

**Request**:

```typescript
{
  alertIds?: string[];               // Specific alerts
  types?: string[];                  // All of certain types
  read_only?: boolean;               // Only clear read alerts
  before?: string;                   // Clear all before date
}
```

**Response (Success - 200)**:

```typescript
{
  deleted: number;
  message: string;
}
```

---

#### GET /api/notifications/preferences

**Purpose**: Get notification preferences

**Response (Success - 200)**:

```typescript
{
  preferences: {
    email: {
      enabled: boolean;
      types: string[];               // Alert types to receive via email
      frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
      quietHours: {
        enabled: boolean;
        start: string;
        end: string;
        timezone: string;
      };
    };

    inApp: {
      enabled: boolean;
      types: string[];
      showBadge: boolean;
      sound: boolean;
    };

    sms: {
      enabled: boolean;
      types: string[];               // Usually only critical alerts
      phoneNumber: string;
    };

    push: {
      enabled: boolean;
      types: string[];
      devices: [
        {
          deviceId: string;
          platform: 'ios' | 'android' | 'web';
          lastActive: string;
        }
      ];
    };
  }
}
```

---

#### PUT /api/notifications/preferences

**Purpose**: Update notification preferences

**Request**:

```typescript
{
  email?: {
    enabled: boolean;
    types: string[];
    frequency: string;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  inApp?: { /* same structure */ };
  sms?: { /* same structure */ };
  push?: { /* same structure */ };
}
```

**Response (Success - 200)**:

```typescript
{
  preferences: {
    // Updated preferences
  }
}
```

**Business Rules**:

1. Critical alerts (fraud, security) always sent
2. Quiet hours respected except for critical alerts
3. Email frequency affects non-critical alerts only
4. SMS requires phone verification

---

#### POST /api/notifications/test

**Purpose**: Send test notification

**Request**:

```typescript
{
  channel: "email" | "sms" | "push" | "in_app";
  type: string; // Alert type to test
}
```

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  sentAt: string;
  message: string;
}
```

---

#### GET /api/notifications/history

**Purpose**: Get notification delivery history

**Query Parameters**:

```typescript
{
  limit?: number;
  offset?: number;
  channel?: string;
  status?: 'sent' | 'failed' | 'pending';
}
```

**Response (Success - 200)**:

```typescript
{
  notifications: [
    {
      id: string;
      alertId: string;
      channel: string;
      type: string;
      recipient: string;             // Email/phone/device
      status: 'sent' | 'failed' | 'pending';
      sentAt: string;
      deliveredAt: string | null;
      openedAt: string | null;
      error: string | null;
      retries: number;
    }
  ]
}
```

---

### Gmail Integration Endpoints

#### POST /api/gmail/connect

**Purpose**: Initialize Gmail integration for user

**Request**:

```typescript
{
  authorizationCode: string;         // From Google OAuth
  scopes: string[];                  // Required Gmail scopes
}
```

**Response (Success - 200)**:

```typescript
{
  connected: boolean;
  email: string;
  watchExpiration: string;
  historyId: string;
  scopes: string[];
  message: string;
}
```

**Business Rules**:

1. Requires Gmail readonly scope minimum
2. Sets up Pub/Sub watch automatically
3. Initiates historical scan if requested
4. Stores encrypted refresh token

---

#### POST /api/gmail/disconnect

**Purpose**: Disconnect Gmail integration

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  message: string;
}
```

**Business Rules**:

1. Stops Pub/Sub watch
2. Revokes OAuth tokens
3. Keeps existing transactions
4. Disables auto-extraction

---

#### GET /api/gmail/status

**Purpose**: Check Gmail connection status

**Response (Success - 200)**:

```typescript
{
  connected: boolean;
  email: string;
  watchActive: boolean;
  watchExpiration: string;
  lastSyncedAt: string;
  lastEmailProcessed: string;
  statistics: {
    totalEmailsProcessed: number;
    transactionsExtracted: number;
    failedExtractions: number;
    successRate: number;
  };
  health: {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    lastError: string | null;
  };
}
```

---

#### POST /api/gmail/scan-historical

**Purpose**: Trigger historical email scan

**Request**:

```typescript
{
  startDate: string;                 // How far back to scan
  endDate?: string;                  // Default: now
  bankEmails?: string[];             // Filter specific senders
  force?: boolean;                   // Re-scan already processed emails
}
```

**Response (Success - 202)**:

```typescript
{
  jobId: string;
  status: "queued";
  estimatedDuration: string;
  message: string;
}
```

**Business Rules**:

1. Maximum 2 years of history
2. Runs asynchronously
3. Sends notification when complete
4. Rate-limited to prevent Gmail API quota exhaustion

---

#### GET /api/gmail/scan-historical/:jobId

**Purpose**: Check historical scan progress

**Response (Success - 200)**:

```typescript
{
  jobId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: {
    emailsScanned: number;
    emailsProcessed: number;
    transactionsExtracted: number;
    errors: number;
    percentage: number;
  };
  startedAt: string;
  completedAt: string | null;
  estimatedTimeRemaining: string | null;
  results: {
    totalEmails: number;
    transactionEmails: number;
    nonTransactionEmails: number;
    duplicatesSkipped: number;
    errors: [
      {
        emailId: string;
        error: string;
      }
    ];
  };
}
```

---

#### GET /api/gmail/templates

**Purpose**: Get email parsing templates for banks

**Response (Success - 200)**:

```typescript
{
  templates: [
    {
      id: string;
      bankName: string;
      senderEmail: string;
      subjectPattern: string;
      extractionMethod: 'regex' | 'llm' | 'hybrid';
      patterns: {
        amount: string;
        merchant: string;
        date: string;
        cardLastFour: string;
      };
      successRate: number;
      lastUpdated: string;
      active: boolean;
    }
  ]
}
```

---

#### POST /api/gmail/test-extraction

**Purpose**: Test email extraction without saving

**Request**:

```typescript
{
  emailContent: string;              // Raw email text or HTML
  bankName?: string;                 // Optional: hint for parser
}
```

**Response (Success - 200)**:

```typescript
{
  success: boolean;
  confidence: number;                // 0-1
  extractedData: {
    transactionDate: string;
    merchantName: string;
    amount: number;
    cardLastFour: string;
    category: string;
    transactionType: 'debit' | 'credit';
  };
  method: 'regex' | 'llm' | 'manual_review';
  alternatives: [                    // Other possible interpretations
    {
      confidence: number;
      data: object;
    }
  ];
}
```

---

## ⚙️ Background Jobs & Services

### 1. Gmail Pub/Sub Listener Service

**Purpose**: Real-time email monitoring for all users

**Service Type**: Event-driven Cloud Run service

**Trigger**: Google Cloud Pub/Sub topic notification

**Architecture**:

```typescript
// Runs as a single Cloud Run service with Pub/Sub trigger
// Handles notifications for all users

interface PubSubMessage {
  emailAddress: string;
  historyId: string;
}

// On message received:
async function handlePubSubNotification(message: PubSubMessage) {
  // 1. Identify user by email
  const user = await getUserByEmail(message.emailAddress);

  // 2. Fetch new emails since last historyId
  const newEmails = await fetchGmailHistory(
    user.gmail_token,
    user.gmail_history_id,
    message.historyId
  );

  // 3. Filter for transaction emails
  const transactionEmails = classifyEmails(newEmails);

  // 4. Queue for processing
  for (const email of transactionEmails) {
    await queueTransactionExtraction(user.id, email);
  }

  // 5. Update user's history ID
  await updateUserHistoryId(user.id, message.historyId);
}
```

**Deployment**:

- Single Cloud Run service
- Triggered by Pub/Sub messages
- Auto-scales based on message volume
- Free tier: 2 million requests/month

### 2. Transaction Extraction Service

**Purpose**: Extract transaction details from emails

**Extraction Strategy**:

```typescript
// Multi-strategy approach for accuracy

// Strategy 1: Regex patterns for known banks
const patterns = {
  SBI: /Transaction of Rs\.([\d,]+\.\d{2})/,
  HDFC: /Amount: INR ([\d,]+\.\d{2})/,
  AXIS: /Rs\.([\d,]+\.\d{2}) spent/,
  // ... more patterns
};

// Strategy 2: LLM-based extraction for complex/unknown formats
async function extractWithLLM(emailContent: string) {
  const prompt = `Extract transaction details from this email:
  - Date
  - Merchant name
  - Amount
  - Card (last 4 digits)
  
  Email: ${emailContent}`;

  return await openai.chat.completions.create({
    model: "gpt-4o-mini", // Cost-effective
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });
}

// Strategy 3: Fallback to manual review
async function processTransaction(email: Email) {
  let result = tryRegexExtraction(email);

  if (!result.confident) {
    result = await extractWithLLM(email.content);
  }

  if (result.extracted) {
    await saveTransaction(result.data);
  } else {
    await flagForManualReview(email);
  }
}
```

**Merchant Categorization**:

```typescript
// Use MCC codes + keyword matching
const categoryMapping = {
  swiggy: "Dining",
  zomato: "Dining",
  amazon: "Shopping",
  flipkart: "Shopping",
  uber: "Transportation",
  ola: "Transportation",
  // ... extensive mapping
};

// Fallback: LLM categorization
async function categorizeWithLLM(merchantName: string) {
  // Use GPT-4 mini for cost efficiency
}
```

### 3. Historical Email Scanner Service

**Purpose**: One-time scan for existing emails

**Implementation**:

```typescript
async function scanHistoricalEmails(userId: string) {
  const user = await getUser(userId);
  const startDate = user.card_activation_date || "2020-01-01";

  // Batch fetch emails
  let pageToken = null;
  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `from:(*@sbi.co.in OR *@hdfcbank.com OR ...) after:${startDate}`,
      maxResults: 100,
      pageToken,
    });

    // Process in parallel (limited concurrency)
    await processEmailBatch(response.messages, userId);

    pageToken = response.nextPageToken;
  } while (pageToken);
}

// Trigger: Manual or automatic on first login
```

### 4. Spending Alert Service

**Cron Schedule**: Daily at 12:00 AM IST

**Logic**:

```typescript
async function checkBudgetAlerts() {
  const users = await getActiveUsers();

  for (const user of users) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Calculate total spending for current month
    const totalSpent = await calculateMonthlySpending(
      user.id,
      currentMonth,
      currentYear
    );

    // Check against budget
    if (totalSpent > user.monthly_budget) {
      const existingAlert = await checkAlertSent(
        user.id,
        currentMonth,
        currentYear
      );

      if (!existingAlert) {
        // Send alert email
        await sendBudgetAlertEmail(user, totalSpent);

        // Create in-app alert
        await createAlert({
          user_id: user.id,
          alert_type: "budget_exceeded",
          message: `You've exceeded your monthly budget of ₹${user.monthly_budget}. Current spending: ₹${totalSpent}`,
        });

        // Mark as sent
        await markAlertSent(user.id, currentMonth, currentYear);
      }
    }
  }
}
```

### 5. Bill Date Reminder Service

**Cron Schedule**: Daily at 9:00 AM IST

**Logic**:

```typescript
async function sendBillReminders() {
  const today = new Date().getDate();
  const threeDaysLater = (today + 3) % 31;

  // Find cards with upcoming bill dates
  const upcomingBills = await getCardsWithBillDate(threeDaysLater);

  for (const card of upcomingBills) {
    const user = await getUser(card.user_id);

    await sendReminderEmail(user, {
      type: "bill_date",
      card_name: card.card_name,
      date: threeDaysLater,
      outstanding: card.current_outstanding,
    });
  }

  // Similar logic for due date reminders
}
```

### 6. Analytics Computation Service

**Cron Schedule**: Daily at 2:00 AM IST

**Purpose**: Pre-compute expensive analytics queries

**Logic**:

```typescript
async function computeAnalytics() {
  const users = await getActiveUsers();

  for (const user of users) {
    // Compute various KPIs
    const kpis = {
      monthly_spending: await calculateMonthlySpending(user.id),
      category_breakdown: await calculateCategoryBreakdown(user.id),
      card_wise_spending: await calculateCardWiseSpending(user.id),
      mom_growth: await calculateMoMGrowth(user.id),
      top_merchants: await getTopMerchants(user.id, 10),
      spending_trends: await calculateSpendingTrends(user.id, 6), // 6 months
    };

    // Cache results
    await cacheAnalytics(user.id, "dashboard_kpis", kpis);

    // Set expiration: 24 hours
    await setExpiration(`analytics:${user.id}:dashboard_kpis`, 86400);
  }
}
```

---

## 🔐 Security & Authentication

### Authentication Flow

```typescript
// 1. Google OAuth
async function googleOAuth(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user info
  const userInfo = await oauth2Client.verifyIdToken({
    idToken: tokens.id_token,
  });

  const payload = userInfo.getPayload();

  // Create/update user
  const user = await upsertUser({
    google_id: payload.sub,
    email: payload.email,
    name: payload.name,
    profile_picture: payload.picture,
  });

  // Store refresh token for Gmail access
  await storeGmailToken(user.id, tokens.refresh_token);

  // Generate JWT
  const jwtToken = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // Store session in Redis
  await redis.set(
    `session:${user.id}`,
    JSON.stringify({ token: jwtToken, ...tokens }),
    "EX",
    7 * 24 * 60 * 60 // 7 days
  );

  return { token: jwtToken, user };
}

// 2. JWT Verification Middleware
async function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check Redis session
    const session = await redis.get(`session:${decoded.userId}`);
    if (!session) {
      return res.status(401).json({ error: "Session expired" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
```

### Gmail Token Management

```typescript
// Store tokens encrypted
async function storeGmailToken(userId: string, refreshToken: string) {
  const encrypted = encrypt(refreshToken, process.env.ENCRYPTION_KEY);

  await supabase.from("user_gmail_tokens").upsert({
    user_id: userId,
    refresh_token: encrypted,
  });
}

// Retrieve and refresh if needed
async function getGmailClient(userId: string) {
  const { data } = await supabase
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .single();

  const refreshToken = decrypt(data.refresh_token, process.env.ENCRYPTION_KEY);

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Auto-refresh access token
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  return google.gmail({ version: "v1", auth: oauth2Client });
}
```

### Rate Limiting

```typescript
// Using Upstash Redis for distributed rate limiting
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
  analytics: true,
});

async function rateLimitMiddleware(req, res, next) {
  const identifier = req.user?.id || req.ip;
  const { success, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    return res.status(429).json({
      error: "Too many requests",
      retryAfter: 60,
    });
  }

  res.setHeader("X-RateLimit-Remaining", remaining);
  next();
}
```

---

## 📈 Scalability Considerations

### Multi-User Architecture (Up to 10 Users)

#### 1. User Isolation

```typescript
// All queries include user_id for data isolation
// Row Level Security (RLS) in Supabase

// Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

// Policy: Users can only see their own transactions
CREATE POLICY user_transactions_policy ON transactions
  FOR ALL
  USING (user_id = auth.uid());

// Similar policies for all user-specific tables
```

#### 2. Background Service Optimization

**Single Pub/Sub Listener for All Users**:

```typescript
// One Cloud Run instance handles all users
// Scales automatically based on Pub/Sub message volume

// Efficient user lookup
async function processNotification(pubsubMessage) {
  // Extract user email from notification
  const userEmail = pubsubMessage.emailAddress;

  // Quick Redis cache lookup
  let userId = await redis.get(`email:${userEmail}`);

  if (!userId) {
    // Fallback to database
    const user = await supabase
      .from("users")
      .select("id")
      .eq("email", userEmail)
      .single();

    userId = user.data.id;

    // Cache for 24 hours
    await redis.set(`email:${userEmail}`, userId, "EX", 86400);
  }

  // Process for this user
  await processUserEmails(userId);
}
```

**Cron Job Optimization**:

```typescript
// Single cron job iterates through all users
// Uses batching and parallelization

async function dailyBudgetCheck() {
  const users = await getActiveUsers();

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    // Parallel processing within batch
    await Promise.all(batch.map((user) => checkUserBudget(user)));
  }
}
```

#### 3. Database Query Optimization

```typescript
// Use connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Use prepared statements
const query = {
  name: "fetch-user-transactions",
  text: "SELECT * FROM transactions WHERE user_id = $1 AND transaction_date >= $2",
  values: [userId, startDate],
};

// Index optimization (already covered in schema)
```

#### 4. Caching Strategy

```typescript
// Redis cache layers
interface CacheConfig {
  ttl: number;
  key: string;
}

const CACHE_CONFIGS = {
  user_profile: { ttl: 3600, key: "user:{userId}" },
  user_cards: { ttl: 1800, key: "cards:{userId}" },
  transactions_list: { ttl: 300, key: "txns:{userId}:{page}:{filters}" },
  analytics_kpis: { ttl: 86400, key: "analytics:{userId}:kpis" },
};

async function getCachedData<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch fresh data
  const data = await fetchFunction();

  // Cache for next time
  await redis.set(cacheKey, JSON.stringify(data), "EX", ttl);

  return data;
}
```

#### 5. Gmail Pub/Sub Watch Management

```typescript
// Auto-renew Gmail watch for all users
// Cron: Every 6 days (watch expires in 7 days)

async function renewAllGmailWatches() {
  const users = await getUsersWithExpiringSoonWatches(48); // 48 hours buffer

  for (const user of users) {
    try {
      const gmail = await getGmailClient(user.id);

      const response = await gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName: `projects/${PROJECT_ID}/topics/gmail-notifications`,
          labelIds: ["INBOX"],
        },
      });

      // Update expiration in database
      await updateWatchExpiration(user.id, response.data.expiration);
    } catch (error) {
      console.error(`Failed to renew watch for user ${user.id}:`, error);
      // Alert admin
    }
  }
}
```

### Free Tier Limits Management

| Service             | Free Tier Limit                     | Usage Strategy                            |
| ------------------- | ----------------------------------- | ----------------------------------------- |
| **Vercel**          | 100 GB bandwidth/month              | Frontend-only, static assets via CDN      |
| **Supabase**        | 500 MB database, 2 GB bandwidth     | Efficient queries, pagination, caching    |
| **Upstash Redis**   | 10,000 commands/day                 | Cache only hot data, 24h TTL              |
| **Cloud Run**       | 2M requests/month, 360K GB-sec      | Optimize cold starts, use min instances=0 |
| **Gmail API**       | 1B quota units/day (250 emails/sec) | Batch requests, respect rate limits       |
| **Cloud Scheduler** | 3 jobs free                         | Consolidate cron jobs where possible      |

---

## ✨ Additional Features & Advanced Functionality

### 1. **Reward Points Tracking System**

#### Database Schema

```sql
CREATE TABLE reward_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    points_balance INTEGER DEFAULT 0,
    points_expiring_soon INTEGER DEFAULT 0,
    next_expiry_date DATE,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reward_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    points_earned INTEGER,
    points_type VARCHAR(50),         -- 'base' | 'bonus' | 'promotional'
    multiplier DECIMAL(3,2),         -- e.g., 2.5x
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'active', -- 'active' | 'redeemed' | 'expired'
    earned_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reward_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES credit_cards(id),
    points_redeemed INTEGER NOT NULL,
    redemption_type VARCHAR(50),     -- 'cashback' | 'voucher' | 'miles' | 'statement_credit'
    redemption_value DECIMAL(10,2),
    description TEXT,
    redeemed_at TIMESTAMP DEFAULT NOW()
);
```

#### API Endpoints

**GET /api/rewards/summary**

```typescript
Response: {
  totalPoints: number;
  totalValue: number;               // Estimated monetary value
  expiringIn30Days: number;
  expiringIn60Days: number;
  byCard: [
    {
      cardId: string;
      cardName: string;
      points: number;
      estimatedValue: number;
      expiryDate: string;
      multiplier: string;           // e.g., "5x on dining"
    }
  ];
  recommendations: [
    {
      type: 'redeem' | 'earn' | 'alert';
      message: string;
      action: string;
    }
  ];
}
```

**POST /api/rewards/calculate**

```typescript
Request: {
  cardId: string;
  amount: number;
  category: string;
}
Response: {
  pointsEarned: number;
  multiplier: number;
  basePoints: number;
  bonusPoints: number;
}
```

**GET /api/rewards/optimization**

```typescript
Response: {
  suggestions: [
    {
      scenario: string;
      currentCard: string;
      suggestedCard: string;
      additionalPoints: number;
      additionalValue: number;
    }
  ];
}
```

#### Business Rules

1. Points calculated based on card-specific reward rates
2. Automatic alerts when points expiring within 60 days
3. Track bonus campaigns and multipliers
4. Integration with transaction data for automatic calculation
5. Historical tracking of redemptions

---

### 2. **Bill Payment Tracking & Reminders**

#### Database Schema

```sql
CREATE TABLE bill_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
    billing_cycle_month INTEGER NOT NULL,
    billing_cycle_year INTEGER NOT NULL,
    bill_amount DECIMAL(10,2) NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_amount DECIMAL(10,2),
    payment_date DATE,
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'paid' | 'overdue' | 'partial'
    payment_method VARCHAR(50),
    confirmation_number VARCHAR(100),
    late_fee DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bill_payments_card_cycle ON bill_payments(card_id, billing_cycle_year, billing_cycle_month);
CREATE INDEX idx_bill_payments_status ON bill_payments(payment_status, due_date);
```

#### API Endpoints

**GET /api/bills/upcoming**

```typescript
Query: {
  days?: number;                    // Default: 30
}
Response: {
  bills: [
    {
      id: string;
      cardId: string;
      cardName: string;
      billAmount: number;
      dueDate: string;
      daysRemaining: number;
      status: string;
      priority: 'urgent' | 'high' | 'normal';
    }
  ];
  totalDue: number;
  urgentCount: number;
}
```

**POST /api/bills/:billId/mark-paid**

```typescript
Request: {
  paymentAmount: number;
  paymentDate: string;
  paymentMethod: string;
  confirmationNumber?: string;
}
Response: {
  bill: {
    // Updated bill object
    paymentStatus: 'paid';
  }
}
```

**GET /api/bills/history**

```typescript
Response: {
  payments: [
    {
      // Payment history with analytics
      totalPaid: number;
      onTimePayments: number;
      latePayments: number;
      totalLateFees: number;
    }
  ];
}
```

#### Reminder System

```typescript
// Cron: Daily at 9 AM
async function sendBillReminders() {
  const reminders = [
    { days: 7, priority: "normal", channel: "in_app" },
    { days: 3, priority: "high", channel: "email" },
    { days: 1, priority: "urgent", channel: "email+sms" },
    { days: 0, priority: "urgent", channel: "email+sms+push" },
  ];

  for (const reminder of reminders) {
    const dueDate = addDays(new Date(), reminder.days);
    const bills = await getUnpaidBillsDueOn(dueDate);

    for (const bill of bills) {
      await sendReminder(bill, reminder.channel, reminder.priority);
    }
  }
}
```

---

### 3. **Statement Upload & OCR Processing**

#### Database Schema

```sql
CREATE TABLE uploaded_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    card_id UUID REFERENCES credit_cards(id),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    statement_month INTEGER,
    statement_year INTEGER,
    processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
    ocr_provider VARCHAR(50),        -- 'google_vision' | 'aws_textract' | 'azure_ocr'
    extracted_data JSONB,
    transactions_extracted INTEGER DEFAULT 0,
    transactions_matched INTEGER DEFAULT 0,
    error_message TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);
```

#### API Endpoints

**POST /api/statements/upload**

```typescript
Request: FormData {
  file: File;                        // PDF, image, or zip
  cardId: string;
  statementMonth: number;
  statementYear: number;
  autoMatch?: boolean;               // Auto-match with existing transactions
}
Response: {
  uploadId: string;
  status: 'uploaded';
  estimatedProcessingTime: string;
}
```

**GET /api/statements/upload/:uploadId**

```typescript
Response: {
  uploadId: string;
  status: string;
  progress: {
    stage: 'ocr' | 'extraction' | 'matching' | 'completed';
    percentage: number;
  };
  results: {
    transactionsFound: number;
    newTransactions: number;
    matchedTransactions: number;
    unmatchedTransactions: number;
    discrepancies: [
      {
        transactionId: string;
        statementAmount: number;
        extractedAmount: number;
        difference: number;
      }
    ];
  };
}
```

**GET /api/statements**

```typescript
Response: {
  statements: [
    {
      id: string;
      cardName: string;
      month: string;
      fileName: string;
      downloadUrl: string;
      transactionsExtracted: number;
      uploadedAt: string;
    }
  ];
}
```

#### OCR Processing Flow

```typescript
async function processStatement(uploadId: string) {
  // 1. OCR the document
  const ocrText = await performOCR(uploadId);

  // 2. Extract structured data
  const extractedData = await extractTransactions(ocrText);

  // 3. Validate and clean
  const validTransactions = await validateTransactions(extractedData);

  // 4. Match with existing
  const matched = await matchWithExisting(validTransactions);

  // 5. Create new transactions
  const created = await createNewTransactions(matched.unmatched);

  // 6. Flag discrepancies
  await flagDiscrepancies(matched.discrepancies);

  // 7. Notify user
  await notifyProcessingComplete(uploadId);
}
```

---

### 4. **Smart Insights & AI-Powered Recommendations**

#### Insight Types

**Spending Anomalies**

```typescript
interface SpendingAnomaly {
  type: "spike" | "unusual_merchant" | "unusual_category" | "unusual_time";
  severity: "low" | "medium" | "high";
  description: string;
  transaction: {
    id: string;
    amount: number;
    merchant: string;
    date: string;
  };
  baseline: {
    average: number;
    stdDeviation: number;
    zScore: number;
  };
  recommendation: string;
}
```

**Card Optimization**

```typescript
interface CardRecommendation {
  scenario: string;
  currentCard: {
    name: string;
    rewards: number;
  };
  suggestedCard: {
    name: string;
    expectedRewards: number;
  };
  potentialBenefit: number;
  confidence: number;
  reasoning: string;
}
```

**Savings Opportunities**

```typescript
interface SavingsOpportunity {
  category: string;
  currentSpending: number;
  marketAverage: number;
  potentialSavings: number;
  suggestions: string[];
  difficulty: "easy" | "moderate" | "hard";
}
```

#### API Endpoints

**GET /api/insights/smart**

```typescript
Response: {
  insights: [
    {
      id: string;
      type: 'spending' | 'savings' | 'optimization' | 'warning';
      priority: number;
      title: string;
      description: string;
      impact: {
        financial: number;
        urgency: string;
      };
      actions: [
        {
          label: string;
          type: string;
          url: string;
        }
      ];
      generatedAt: string;
    }
  ];
}
```

**POST /api/insights/generate**

```typescript
Request: {
  types?: string[];
  period?: string;
  force?: boolean;                  // Force regeneration
}
Response: {
  generated: number;
  insights: Insight[];
}
```

#### Insight Generation Rules

```typescript
// ML Model Training Data
const trainingFeatures = {
  userSpendingPatterns: [],
  seasonalTrends: [],
  merchantCategories: [],
  cardUsagePatterns: [],
  industryBenchmarks: [],
};

// Anomaly Detection
function detectAnomalies(transactions: Transaction[]) {
  // Z-score based detection
  const mean = calculateMean(transactions);
  const stdDev = calculateStdDeviation(transactions);

  return transactions.filter((t) => {
    const zScore = (t.amount - mean) / stdDev;
    return Math.abs(zScore) > 2.5; // 2.5 sigma threshold
  });
}

// Pattern Recognition
function recognizePatterns(history: Transaction[]) {
  return {
    recurringTransactions: detectRecurring(history),
    seasonalPatterns: detectSeasonality(history),
    spendingHabits: analyzeHabits(history),
    unusualActivity: detectUnusual(history),
  };
}
```

---

### 5. **Recurring Transaction & Subscription Management**

#### Database Schema

```sql
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    merchant_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL,  -- 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    frequency_days INTEGER,          -- Exact day interval
    next_expected_date DATE,
    last_transaction_id UUID REFERENCES transactions(id),
    last_transaction_date DATE,
    card_id UUID REFERENCES credit_cards(id),
    is_active BOOLEAN DEFAULT true,
    subscription_type VARCHAR(50),   -- 'streaming' | 'utility' | 'software' | 'other'
    notification_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recurring_next_date ON recurring_transactions(next_expected_date, is_active);
```

#### API Endpoints

**GET /api/subscriptions**

```typescript
Response: {
  subscriptions: [
    {
      id: string;
      merchantName: string;
      amount: number;
      frequency: string;
      nextDate: string;
      cardUsed: string;
      status: 'active' | 'inactive' | 'cancelled';
      totalSpent: number;           // Lifetime
      transactionCount: number;
      firstCharged: string;
      lastCharged: string;
    }
  ];
  summary: {
    totalSubscriptions: number;
    monthlyRecurring: number;
    yearlyRecurring: number;
    totalMonthlyCommitment: number;
  };
}
```

**POST /api/subscriptions/detect**

```typescript
Request: {
  minOccurrences?: number;          // Default: 3
  tolerance?: number;               // Date tolerance in days
}
Response: {
  detected: [
    {
      merchantName: string;
      amount: number;
      frequency: string;
      confidence: number;
      transactions: string[];       // Transaction IDs
      suggestedAction: 'track' | 'ignore';
    }
  ];
}
```

**POST /api/subscriptions/:subscriptionId/cancel-reminder**

```typescript
Request: {
  cancelDate: string;
  reason?: string;
}
Response: {
  reminder: {
    id: string;
    scheduledFor: string;
    status: 'scheduled';
  };
}
```

**GET /api/subscriptions/optimization**

```typescript
Response: {
  recommendations: [
    {
      subscription: string;
      suggestion: 'cancel' | 'downgrade' | 'switch';
      reasoning: string;
      potentialSavings: number;
      alternatives: [
        {
          service: string;
          cost: number;
          savings: number;
        }
      ];
    }
  ];
}
```

#### Subscription Monitoring

```typescript
// Cron: Daily check for upcoming subscriptions
async function monitorSubscriptions() {
  const upcoming = await getSubscriptionsDue(7); // Next 7 days

  for (const sub of upcoming) {
    // Alert user
    await createAlert({
      type: "subscription_upcoming",
      message: `${sub.merchantName} subscription of ₹${sub.amount} will be charged on ${sub.nextDate}`,
    });

    // Check if transaction occurred
    const transaction = await checkForTransaction(sub);
    if (transaction) {
      await updateSubscriptionLastCharge(sub.id, transaction);
    }
  }

  // Detect missing subscriptions (cancelled but not marked)
  const missed = await detectMissedSubscriptions();
  for (const sub of missed) {
    await createAlert({
      type: "subscription_missed",
      message: `Expected ${sub.merchantName} charge not detected. Was it cancelled?`,
    });
  }
}
```

### 2. **Bill Payment Reminders**

- SMS reminders (via Twilio/SNS)
- Push notifications
- Auto-payment tracking

### 3. **Statement Upload & OCR**

- Upload PDF statements
- OCR extraction for missing transactions
- Automatic reconciliation

### 4. **Smart Insights**

- "You spent 30% more on dining this month"
- "Best card recommendation for upcoming purchase"
- "Unused cards detection"

```typescript
async function generateSmartInsights(userId: string) {
  return {
    spending_anomalies: await detectAnomalies(userId),
    card_recommendations: await recommendBestCard(userId),
    saving_opportunities: await findSavingOpportunities(userId),
    unused_cards: await detectUnusedCards(userId),
  };
}
```

### 5. **Export & Reports**

- Monthly spending reports (PDF/Excel)
- Tax-ready categorized reports
- Year-end summary

### 6. **Card Comparison Tool**

- Compare rewards across cards
- Best card for category suggestion
- Utilization tracking

### 7. **Recurring Transaction Detection**

- Identify subscriptions (Netflix, Spotify, etc.)
- Track recurring bills
- Subscription optimization suggestions

```typescript
async function detectRecurringTransactions(userId: string) {
  // Find transactions with similar:
  // - Merchant name
  // - Amount (±5%)
  // - Frequency (monthly, quarterly)

  const query = `
    WITH recurring_candidates AS (
      SELECT 
        merchant_name,
        amount,
        COUNT(*) as frequency,
        ARRAY_AGG(transaction_date ORDER BY transaction_date) as dates
      FROM transactions
      WHERE user_id = $1
        AND transaction_date >= NOW() - INTERVAL '6 months'
      GROUP BY merchant_name, amount
      HAVING COUNT(*) >= 3
    )
    SELECT * FROM recurring_candidates
    WHERE is_recurring(dates); -- Custom function to check date patterns
  `;

  return await supabase.rpc("detect_recurring", { user_id: userId });
}
```

### 8. **Shared Cards (Family Members)**

- Add family members as secondary users
- Split transaction views
- Individual spending limits

### 9. **Credit Score Simulator**

- Estimate credit score impact
- Utilization ratio tracking
- Payment history visualization

### 10. **Merchant Analytics**

- Top merchants by spending
- Merchant categorization accuracy
- Merchant contact information

### 11. **Goal Setting**

- Set savings goals
- Track progress
- Gamification elements

### 12. **Dark Mode & Customization**

- Theme customization
- Custom categories
- Personalized dashboard layout

---

## 🚀 Deployment Strategy & Implementation Roadmap

### Phase 1: Foundation & MVP (Weeks 1-4)

#### Week 1: Infrastructure Setup

**Tasks**:

- [ ] Setup Google Cloud Project
- [ ] Configure Supabase PostgreSQL database
- [ ] Setup Upstash Redis instance
- [ ] Create GitHub repository with CI/CD
- [ ] Setup Vercel project for frontend
- [ ] Configure environment variables
- [ ] Setup error tracking (Sentry)
- [ ] Create development, staging, production environments

**Deliverables**:

- Working infrastructure
- Database schema deployed
- CI/CD pipeline active

---

#### Week 2: Authentication & User Management

**Tasks**:

- [ ] Implement Google OAuth flow (frontend + backend)
- [ ] JWT token generation and validation
- [ ] Session management with Redis
- [ ] User profile CRUD operations
- [ ] Protected route middleware
- [ ] User preferences management

**API Endpoints**:

- POST /api/auth/google
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
- PUT /api/users/profile
- PUT /api/users/preferences

**Testing**:

- Unit tests for auth flows
- Integration tests for OAuth
- Security testing for token validation

---

#### Week 3: Card & Transaction Management

**Tasks**:

- [ ] Credit card CRUD operations
- [ ] Transaction CRUD operations
- [ ] Manual transaction entry form
- [ ] Card listing and details pages
- [ ] Transaction listing with pagination
- [ ] Basic filtering and search
- [ ] Data validation and error handling

**API Endpoints**:

- GET/POST/PUT/DELETE /api/cards
- GET/POST/PUT/DELETE /api/transactions
- GET /api/cards/:id/transactions
- GET /api/transactions/search

**UI Components**:

- CardList, CardItem, CardForm
- TransactionTable, TransactionForm
- Filters, Search, Pagination

**Testing**:

- CRUD operation tests
- Validation tests
- UI component tests

---

#### Week 4: Basic Dashboard & Analytics

**Tasks**:

- [ ] Dashboard overview page
- [ ] Summary cards (total spending, cards, transactions)
- [ ] Recent transactions widget
- [ ] Card-wise spending chart
- [ ] Category breakdown chart
- [ ] Responsive design implementation

**API Endpoints**:

- GET /api/analytics/overview
- GET /api/analytics/summary
- GET /api/dashboard/widgets

**UI Components**:

- Dashboard layout
- SpendingChart, CategoryChart
- OverviewCards, RecentActivity

**Testing**:

- Analytics calculation tests
- Chart rendering tests
- Responsive design tests

---

### Phase 2: Email Integration & Automation (Weeks 5-8)

#### Week 5: Gmail API Integration

**Tasks**:

- [ ] Gmail OAuth setup with required scopes
- [ ] Gmail API client implementation
- [ ] Token storage and refresh logic
- [ ] Email fetching and parsing
- [ ] Gmail connection UI
- [ ] Connection status monitoring

**API Endpoints**:

- POST /api/gmail/connect
- POST /api/gmail/disconnect
- GET /api/gmail/status
- GET /api/gmail/test

**Business Logic**:

- Secure token encryption
- Auto-refresh token handling
- Error recovery mechanisms

---

#### Week 6: Pub/Sub & Real-time Processing

**Tasks**:

- [ ] Setup Google Cloud Pub/Sub topic
- [ ] Implement Pub/Sub listener service
- [ ] Gmail watch API integration
- [ ] Watch renewal automation
- [ ] Message queue implementation
- [ ] Email classification logic

**Services**:

- gmail-pubsub-listener (Cloud Run)
- Watch renewal cron job
- Queue consumer service

**Testing**:

- Pub/Sub message handling tests
- Watch renewal tests
- Queue processing tests

---

#### Week 7: Transaction Extraction Engine

**Tasks**:

- [ ] Regex pattern library for major banks
- [ ] Email template matching system
- [ ] LLM integration (GPT-4 mini/Gemini)
- [ ] Merchant categorization logic
- [ ] Confidence scoring system
- [ ] Extraction testing interface

**Bank Templates**:

- SBI Cashback
- HDFC (Swiggy, UPI, Tata Neu, MoneyBack+)
- Airtel Axis
- IDFC First (Millennial, UPI)
- IndusInd Legend
- Yes Bank POP
- Jupiter Edge+

**API Endpoints**:

- POST /api/gmail/test-extraction
- GET /api/gmail/templates
- PUT /api/gmail/templates/:id

**Extraction Strategies**:

1. Regex patterns (fast, deterministic)
2. Template matching (bank-specific)
3. LLM fallback (complex formats)
4. Manual review queue

---

#### Week 8: Historical Scanning & Deduplication

**Tasks**:

- [ ] Historical email scanner implementation
- [ ] Batch processing logic
- [ ] Duplicate detection algorithm
- [ ] Transaction matching system
- [ ] Progress tracking
- [ ] Results notification

**API Endpoints**:

- POST /api/gmail/scan-historical
- GET /api/gmail/scan-historical/:jobId
- GET /api/transactions/duplicates
- POST /api/transactions/merge

**Deduplication Logic**:

```typescript
function isDuplicate(t1: Transaction, t2: Transaction): boolean {
  const dateDiff = Math.abs(daysBetween(t1.date, t2.date));
  const amountMatch = t1.amount === t2.amount;
  const merchantMatch = similarity(t1.merchant, t2.merchant) > 0.85;
  const cardMatch = t1.cardId === t2.cardId;

  return dateDiff <= 2 && amountMatch && merchantMatch && cardMatch;
}
```

---

### Phase 3: Analytics & Intelligent Alerts (Weeks 9-12)

#### Week 9: Budget Tracking System

**Tasks**:

- [ ] Monthly budget management
- [ ] Real-time budget calculation
- [ ] Budget status tracking
- [ ] Category-specific budgets
- [ ] Budget history and trends
- [ ] Projection algorithms

**API Endpoints**:

- GET/PUT /api/budget/current
- GET /api/budget/history
- POST /api/budget/forecast
- POST /api/budget/simulate

**Features**:

- Real-time spending updates
- Projection based on velocity
- Category-level tracking
- Historical comparison

---

#### Week 10: Alert & Notification System

**Tasks**:

- [ ] Alert generation engine
- [ ] Multi-channel notification system (email, in-app, SMS)
- [ ] Alert preferences management
- [ ] Notification templates
- [ ] Delivery tracking
- [ ] Quiet hours implementation

**Alert Types**:

1. Budget threshold alerts (70%, 90%, 100%)
2. Budget exceeded alerts
3. Bill reminders (7, 3, 1 day before)
4. Due date reminders
5. Unusual activity alerts
6. Spending insights

**Services**:

- Alert generation service (cron)
- Email notification service
- SMS notification service (Twilio)
- Push notification service

**API Endpoints**:

- GET/POST/DELETE /api/alerts
- GET/PUT /api/notifications/preferences
- POST /api/notifications/test

---

#### Week 11: Comprehensive Analytics

**Tasks**:

- [ ] KPI calculation engine
- [ ] Trend analysis algorithms
- [ ] Category analytics
- [ ] Merchant analytics
- [ ] Card comparison tools
- [ ] Financial health scoring

**KPIs Implemented**:

- Total spending & growth
- Average transaction size
- Budget utilization
- Card utilization ratios
- Savings vs budget
- Category diversity
- Spending velocity
- Financial health score

**API Endpoints**:

- GET /api/analytics/kpi
- GET /api/analytics/trends
- GET /api/analytics/categories
- GET /api/analytics/merchants
- GET /api/analytics/comparison

**Caching Strategy**:

- KPIs: 1 hour cache
- Historical data: 24 hour cache
- Real-time data: 5 minute cache

---

#### Week 12: Bill Reminders & Payment Tracking

**Tasks**:

- [ ] Bill date calculation logic
- [ ] Reminder scheduling system
- [ ] Payment tracking
- [ ] Statement period management
- [ ] Multi-stage reminder system
- [ ] Payment confirmation

**Services**:

- Bill reminder service (daily cron at 9 AM)
- Due date checker service
- Payment tracking service

**Reminder Schedule**:

- 7 days before: Email + In-app
- 3 days before: Email + In-app
- 1 day before: Email + SMS + Push
- Due date: Urgent alerts all channels

---

### Phase 4: Advanced Features & Optimization (Weeks 13-16)

#### Week 13: AI-Powered Insights

**Tasks**:

- [ ] Anomaly detection system
- [ ] Pattern recognition engine
- [ ] Smart recommendations
- [ ] Predictive analytics
- [ ] Spending optimization suggestions
- [ ] Card usage optimization

**ML Models**:

1. Anomaly detection (Z-score based)
2. Pattern recognition (time series)
3. Category prediction (classification)
4. Spending forecast (regression)

**API Endpoints**:

- GET /api/insights/smart
- POST /api/insights/generate
- GET /api/insights/anomalies
- GET /api/insights/recommendations

---

#### Week 14: Recurring Transactions & Subscriptions

**Tasks**:

- [ ] Recurring transaction detection
- [ ] Subscription tracking
- [ ] Cancellation reminders
- [ ] Subscription optimization
- [ ] Cost analysis
- [ ] Alternative suggestions

**Detection Algorithm**:

```typescript
function detectRecurring(transactions: Transaction[]) {
  const groups = groupByMerchant(transactions);

  return groups
    .filter((group) => {
      const intervals = calculateIntervals(group);
      const avgInterval = mean(intervals);
      const stdDev = standardDeviation(intervals);

      return group.length >= 3 && stdDev < avgInterval * 0.2; // Low variance
    })
    .map((group) => ({
      merchant: group[0].merchant,
      frequency: determineFrequency(intervals),
      amount: mode(group.map((t) => t.amount)),
    }));
}
```

---

#### Week 15: Export, Reports & Statement Upload

**Tasks**:

- [ ] CSV/Excel export functionality
- [ ] PDF report generation
- [ ] Monthly statement reports
- [ ] Statement upload interface
- [ ] OCR integration (Google Vision API)
- [ ] Transaction reconciliation

**Export Formats**:

- CSV (simple, universal)
- Excel (multi-sheet with charts)
- PDF (formatted reports)
- JSON (API export)

**OCR Processing**:

- PDF text extraction
- Image OCR (Google Vision)
- Table detection
- Data validation
- Auto-matching

---

#### Week 16: Rewards, Polish & Launch Prep

**Tasks**:

- [ ] Reward points tracking
- [ ] Points calculation engine
- [ ] Expiry tracking
- [ ] Redemption logging
- [ ] UI/UX polish
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Documentation
- [ ] User onboarding flow

**Final Checklist**:

- [ ] All tests passing (unit, integration, e2e)
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Error tracking configured
- [ ] Monitoring dashboards setup
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan
- [ ] User guide created
- [ ] Beta testing completed

---

### Post-Launch: Continuous Improvement

#### Month 1-2: Monitoring & Bug Fixes

- Monitor error rates and performance
- Fix critical bugs
- Gather user feedback
- Optimize slow queries
- Improve email extraction accuracy

#### Month 3-4: Feature Enhancements

- Add requested features
- Improve ML models with real data
- Optimize notification timing
- Enhanced insights based on patterns
- Mobile app considerations

#### Month 5-6: Scale & Optimize

- Performance optimization
- Cost optimization
- Advanced analytics features
- Integration with other services
- API for third-party access

---

## 📊 Monitoring & Observability

### Metrics to Track

```typescript
// Application metrics
- API response times
- Database query performance
- Cache hit rates
- Background job execution times
- Email processing success rate
- Transaction extraction accuracy

// Business metrics
- Daily active users
- Transactions processed per day
- Budget alerts sent
- Average spending per user
- Top spending categories

// Infrastructure metrics
- Cloud Run CPU/Memory usage
- Database connections
- Redis memory usage
- Pub/Sub message latency
```

### Logging Strategy

```typescript
// Structured logging with Winston
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "api-gateway" },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// Usage
logger.info("Transaction created", {
  userId: user.id,
  transactionId: txn.id,
  amount: txn.amount,
});
```

---

## 🎯 Success Criteria

### Performance Targets

- Dashboard load time: < 2 seconds
- API response time (p95): < 500ms
- Email processing latency: < 30 seconds
- Transaction extraction accuracy: > 99%

### User Experience

- Onboarding completion: < 15 minutes
- Zero manual transaction entry needed
- Real-time budget tracking
- Actionable insights daily

---

## 📝 Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx

# Backend (.env)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx

# Gmail API
GMAIL_PUBSUB_TOPIC=projects/xxx/topics/gmail-notifications
GMAIL_PUBSUB_SUBSCRIPTION=projects/xxx/subscriptions/gmail-sub

# LLM APIs
OPENAI_API_KEY=xxx
# or
GOOGLE_GEMINI_API_KEY=xxx

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_USER=xxx
SMTP_PASS=xxx

# Monitoring
SENTRY_DSN=xxx
```

---

## 🔄 Data Migration Strategy

```typescript
// For existing users with historical data
async function migrateExistingData(userId: string) {
  // Step 1: Run historical email scan
  await initiateHistoricalScan(userId);

  // Step 2: Allow manual CSV import
  await enableCSVImport(userId);

  // Step 3: Validate and deduplicate
  await deduplicateTransactions(userId);

  // Step 4: Compute initial analytics
  await computeInitialAnalytics(userId);
}
```

---

## 🧪 Testing Strategy

### Test Pyramid

```
                    /\
                   /  \
                  / E2E \
                 /--------\
                /Integration\
               /--------------\
              /  Unit Tests    \
             /------------------\
```

### Unit Tests (70% coverage target)

**Backend**:

```typescript
// Example: Transaction service tests
describe("TransactionService", () => {
  describe("createTransaction", () => {
    it("should create transaction with valid data", async () => {
      const txn = await transactionService.create({
        cardId: "valid-card-id",
        amount: 100,
        merchantName: "Test Merchant",
        transactionDate: new Date(),
      });

      expect(txn).toBeDefined();
      expect(txn.amount).toBe(100);
    });

    it("should reject negative amounts", async () => {
      await expect(
        transactionService.create({ amount: -100 /* ... */ })
      ).rejects.toThrow("Amount must be positive");
    });

    it("should auto-assign billing cycle", async () => {
      const card = await createTestCard({ billDate: 15 });
      const txn = await transactionService.create({
        cardId: card.id,
        transactionDate: new Date("2024-01-20"),
        /* ... */
      });

      expect(txn.billingCycleMonth).toBe(2); // February cycle
    });
  });
});

// Example: Email extraction tests
describe("EmailExtractor", () => {
  it("should extract HDFC transaction correctly", () => {
    const email = `
      Dear Customer,
      Transaction Alert: INR 450.00 has been debited from your 
      HDFC Credit Card ending 1234 at SWIGGY on 15/01/2024
    `;

    const result = extractor.extract(email, "HDFC");

    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.amount).toBe(450);
    expect(result.merchant).toBe("SWIGGY");
    expect(result.cardLastFour).toBe("1234");
  });
});
```

**Frontend**:

```typescript
// Example: Component tests with React Testing Library
describe("TransactionTable", () => {
  it("renders transactions correctly", () => {
    const transactions = [
      { id: "1", merchant: "Amazon", amount: 500, date: "2024-01-15" },
    ];

    render(<TransactionTable transactions={transactions} />);

    expect(screen.getByText("Amazon")).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = jest.fn();
    render(<TransactionTable onDelete={onDelete} /* ... */ />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```

### Integration Tests (20% coverage target)

```typescript
describe("Transaction API Integration", () => {
  let server: Server;
  let authToken: string;

  beforeAll(async () => {
    server = await createTestServer();
    authToken = await getTestAuthToken();
  });

  it("should create and retrieve transaction", async () => {
    // Create transaction
    const createRes = await request(server)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        cardId: testCardId,
        amount: 100,
        merchantName: "Test Store",
        transactionDate: new Date().toISOString(),
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.transaction.id).toBeDefined();

    // Retrieve transaction
    const getRes = await request(server)
      .get(`/api/transactions/${createRes.body.transaction.id}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.transaction.amount).toBe(100);
  });

  it("should update budget after transaction creation", async () => {
    const budgetBefore = await getBudget(authToken);

    await createTransaction({ amount: 1000 /* ... */ });

    const budgetAfter = await getBudget(authToken);

    expect(budgetAfter.spent).toBe(budgetBefore.spent + 1000);
  });
});

describe("Gmail Integration", () => {
  it("should process Pub/Sub notification", async () => {
    const mockMessage = {
      emailAddress: "test@example.com",
      historyId: "12345",
    };

    await pubsubHandler.process(mockMessage);

    // Verify email was fetched and processed
    const logs = await getProcessingLogs("test@example.com");
    expect(logs.length).toBeGreaterThan(0);
  });
});
```

### End-to-End Tests (10% coverage target)

```typescript
// Example: Using Playwright
describe("User Journey: Add Card and Transaction", () => {
  test("complete user flow", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.click("text=Sign in with Google");
    await page.fill("[name=email]", "test@example.com");
    await page.fill("[name=password]", "test123");
    await page.click("button[type=submit]");

    // Navigate to cards
    await page.click("text=Cards");
    await expect(page).toHaveURL("/cards");

    // Add new card
    await page.click("text=Add Card");
    await page.fill("[name=cardName]", "Test Card");
    await page.fill("[name=bankName]", "Test Bank");
    await page.fill("[name=billDate]", "15");
    await page.fill("[name=dueDate]", "5");
    await page.click("button[type=submit]");

    // Verify card created
    await expect(page.locator("text=Test Card")).toBeVisible();

    // Add transaction
    await page.click("text=Add Transaction");
    await page.selectOption("[name=cardId]", { label: "Test Card" });
    await page.fill("[name=merchant]", "Amazon");
    await page.fill("[name=amount]", "500");
    await page.click("button[type=submit]");

    // Verify transaction appears
    await page.goto("/transactions");
    await expect(page.locator("text=Amazon")).toBeVisible();
    await expect(page.locator("text=₹500")).toBeVisible();
  });
});
```

### Performance Tests

```typescript
// Load testing with k6
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Ramp up to 10 users
    { duration: "3m", target: 10 }, // Stay at 10 users
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% errors
  },
};

export default function () {
  const token = getAuthToken();

  // Test transaction listing
  const res = http.get("https://api.example.com/api/transactions", {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

---

## 📊 Performance Optimization Guidelines

### Frontend Optimization

**1. Code Splitting**

```typescript
// Lazy load routes
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Transactions = lazy(() => import("./pages/Transactions"));

// Use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/analytics" element={<Analytics />} />
  </Routes>
</Suspense>;
```

**2. Data Fetching Optimization**

```typescript
// Use React Query for caching and deduplication
const { data, isLoading } = useQuery({
  queryKey: ['transactions', filters],
  queryFn: () => fetchTransactions(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
});

// Prefetch on hover
const prefetchTransaction = usePrefetch('transaction');
<Link
  to={`/transactions/${id}`}
  onMouseEnter={() => prefetchTransaction(id)}
>
```

**3. Image Optimization**

```typescript
// Use Next.js Image component
import Image from "next/image";

<Image
  src="/card-logo.png"
  width={100}
  height={60}
  alt="Card Logo"
  loading="lazy"
  placeholder="blur"
/>;
```

**4. Bundle Size Optimization**

```json
// Package.json - use lighter alternatives
{
  "dependencies": {
    "date-fns": "^2.30.0", // Instead of moment.js
    "zustand": "^4.5.0", // Instead of redux
    "recharts": "^2.10.0" // Lighter than chart.js
  }
}
```

### Backend Optimization

**1. Database Query Optimization**

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_transactions_user_date
ON transactions(user_id, transaction_date DESC);

CREATE INDEX idx_transactions_user_card_date
ON transactions(user_id, card_id, transaction_date DESC);

-- Use materialized views for expensive aggregations
CREATE MATERIALIZED VIEW mv_monthly_spending AS
SELECT
  user_id,
  card_id,
  DATE_TRUNC('month', transaction_date) as month,
  SUM(amount) as total_spending,
  COUNT(*) as transaction_count
FROM transactions
GROUP BY user_id, card_id, DATE_TRUNC('month', transaction_date);

-- Refresh periodically
REFRESH MATERIALIZED VIEW mv_monthly_spending;
```

**2. Caching Strategy**

```typescript
// Multi-layer caching
class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache (fastest)
    let value = memoryCache.get(key);
    if (value) return value;

    // L2: Redis cache
    value = await redis.get(key);
    if (value) {
      memoryCache.set(key, value, 60); // Cache in memory for 1 min
      return JSON.parse(value);
    }

    return null;
  }

  async set(key: string, value: any, ttl: number) {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
    memoryCache.set(key, value, Math.min(ttl, 300));
  }
}

// Cache patterns
const cachePatterns = {
  user: (userId: string) => `user:${userId}`,
  cards: (userId: string) => `cards:${userId}`,
  transactions: (userId: string, page: number, filters: string) =>
    `txns:${userId}:${page}:${filters}`,
  analytics: (userId: string, period: string) =>
    `analytics:${userId}:${period}`,
};
```

**3. Database Connection Pooling**

```typescript
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  min: 5, // Minimum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000,
  maxUses: 7500, // Retire connection after 7500 queries
});

// Proper cleanup
process.on("SIGTERM", async () => {
  await pool.end();
});
```

**4. API Response Compression**

```typescript
import compression from "compression";

app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Compression level (0-9)
    threshold: 1024, // Only compress responses > 1KB
  })
);
```

**5. Rate Limiting**

```typescript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests",
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

app.use("/api/", limiter);
```

---

## 🔒 Security Best Practices

### Authentication & Authorization

**1. JWT Security**

```typescript
// Use strong secret keys
const JWT_SECRET = crypto.randomBytes(64).toString("hex");

// Short expiration times
const token = jwt.sign(payload, JWT_SECRET, {
  expiresIn: "15m", // Access token: 15 minutes
  algorithm: "HS256",
});

const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
  expiresIn: "7d", // Refresh token: 7 days
});

// Rotate tokens on refresh
function refreshTokens(oldRefreshToken: string) {
  // Blacklist old refresh token
  await redis.sadd("token:blacklist", oldRefreshToken);

  // Issue new tokens
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
}
```

**2. Input Validation**

```typescript
import { z } from "zod";

// Schema validation
const transactionSchema = z.object({
  cardId: z.string().uuid(),
  amount: z.number().positive().max(1000000),
  merchantName: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z0-9\s-]+$/),
  transactionDate: z.string().datetime(),
  category: z.enum(["dining", "shopping", "travel" /* ... */]).optional(),
});

// Validate request
app.post("/api/transactions", async (req, res) => {
  try {
    const validated = transactionSchema.parse(req.body);
    // Process transaction
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }
  }
});
```

**3. SQL Injection Prevention**

```typescript
// Always use parameterized queries
const result = await pool.query(
  "SELECT * FROM transactions WHERE user_id = $1 AND card_id = $2",
  [userId, cardId]
);

// Never use string concatenation
// ❌ BAD
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ GOOD
const query = {
  text: "SELECT * FROM users WHERE email = $1",
  values: [email],
};
```

**4. XSS Prevention**

```typescript
// Sanitize user input before displaying
import DOMPurify from "dompurify";

function SafeDescription({ description }: { description: string }) {
  const sanitized = DOMPurify.sanitize(description, {
    ALLOWED_TAGS: ["b", "i", "em", "strong"],
    ALLOWED_ATTR: [],
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

**5. CSRF Protection**

```typescript
import csrf from "csurf";

const csrfProtection = csrf({ cookie: true });

app.post("/api/transactions", csrfProtection, async (req, res) => {
  // CSRF token automatically validated
  // Process request
});

// Frontend: Include CSRF token
axios.post("/api/transactions", data, {
  headers: {
    "X-CSRF-Token": getCsrfToken(),
  },
});
```

**6. Sensitive Data Encryption**

```typescript
import crypto from "crypto";

class Encryption {
  private algorithm = "aes-256-gcm";
  private key: Buffer;

  constructor(secretKey: string) {
    this.key = crypto.scryptSync(secretKey, "salt", 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

// Usage: Encrypt Gmail refresh tokens
const encryption = new Encryption(process.env.ENCRYPTION_KEY);
const encryptedToken = encryption.encrypt(refreshToken);
await db.storeToken(userId, encryptedToken);
```

---

## 📈 Monitoring & Observability

### Key Metrics to Track

**Application Metrics**:

- API response times (p50, p95, p99)
- Error rates by endpoint
- Request throughput
- Cache hit/miss rates
- Database query performance
- Background job success rates

**Business Metrics**:

- Daily active users
- Transactions processed per day
- Email extraction success rate
- Budget alerts triggered
- Feature usage statistics

**Infrastructure Metrics**:

- Cloud Run CPU/Memory usage
- Database connections
- Redis memory usage
- Pub/Sub message lag
- Storage usage

### Logging Strategy

```typescript
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "credit-card-dashboard" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});

// Structured logging
logger.info("Transaction created", {
  userId: user.id,
  transactionId: transaction.id,
  amount: transaction.amount,
  cardId: transaction.cardId,
  duration: Date.now() - startTime,
});

// Error logging with context
logger.error("Email extraction failed", {
  error: error.message,
  stack: error.stack,
  emailId: email.id,
  userId: user.id,
  bankName: bank.name,
});
```

### Health Checks

```typescript
// Health check endpoint
app.get("/health", async (req, res) => {
  const checks = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      gmail: await checkGmailConnection(),
      storage: await checkStorage(),
    },
  };

  const isHealthy = Object.values(checks.checks).every(
    (check) => check.status === "ok"
  );

  res.status(isHealthy ? 200 : 503).json(checks);
});

async function checkDatabase(): Promise<HealthCheck> {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    return {
      status: "ok",
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message,
    };
  }
}
```

---

## 📝 Documentation Requirements

### API Documentation

- OpenAPI/Swagger specification
- Interactive API explorer
- Code examples in multiple languages
- Authentication guide
- Rate limiting policies
- Error code reference

### Developer Documentation

- Architecture overview
- Setup instructions
- Development workflow
- Testing guidelines
- Deployment process
- Troubleshooting guide

### User Documentation

- Getting started guide
- Feature tutorials
- FAQ section
- Privacy policy
- Terms of service
- Support contact

---

## ✅ Definition of Done

A feature is considered **Done** when:

1. ✅ **Code Complete**

   - All functionality implemented
   - Code reviewed and approved
   - Follows coding standards
   - No critical bugs

2. ✅ **Tested**

   - Unit tests passing (>80% coverage)
   - Integration tests passing
   - Manual testing completed
   - Edge cases covered

3. ✅ **Documented**

   - API endpoints documented
   - Code comments added
   - User guide updated
   - Changelog updated

4. ✅ **Deployed**

   - Deployed to staging
   - Tested in staging
   - Deployed to production
   - Monitoring configured

5. ✅ **Verified**
   - Product owner approval
   - User acceptance criteria met
   - Performance benchmarks met
   - Security review passed

---

## 🎯 Success Criteria Summary

This architecture provides a **production-ready, scalable solution** for personal credit card management with:

### ✅ **Core Features**

- ✅ Secure Google OAuth authentication
- ✅ 10+ credit card management
- ✅ Automated email-based transaction extraction (>90% accuracy)
- ✅ Real-time budget tracking with alerts
- ✅ Comprehensive analytics and insights
- ✅ Bill and due date reminders
- ✅ Manual transaction entry and bulk import

### ✅ **Technical Excellence**

- ✅ Multi-user support (up to 10 users)
- ✅ Complete data isolation and security
- ✅ Optimized for free tier infrastructure
- ✅ Sub-2-second dashboard load time
- ✅ 99.5%+ uptime target
- ✅ Responsive design (mobile + desktop)

### ✅ **User Experience**

- ✅ <15-minute onboarding
- ✅ Zero manual transaction entry needed (after setup)
- ✅ Real-time spending updates
- ✅ Actionable daily insights
- ✅ Multi-channel notifications
- ✅ Intuitive, modern UI

### ✅ **Scalability & Maintenance**

- ✅ Modular, maintainable architecture
- ✅ Comprehensive test coverage
- ✅ Automated CI/CD pipeline
- ✅ Monitoring and alerting
- ✅ Clear documentation
- ✅ Easy feature additions

---

**This BRD provides a complete blueprint for development teams to build a world-class credit card management dashboard. All features are designed to work within free tier limits while providing enterprise-grade functionality.**
