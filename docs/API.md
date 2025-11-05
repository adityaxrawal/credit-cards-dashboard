# API Documentation

> Complete API reference for Credit Card Dashboard (Zero-Cost Architecture)

**Base URL**: `https://your-api.onrender.com`

**Authentication**: All endpoints require JWT Bearer token (except auth endpoints)

```
Authorization: Bearer <your-jwt-token>
```

---

## Table of Contents

- [Authentication](#authentication)
- [Gmail Sync](#gmail-sync)
- [Frontend-Triggered Services](#frontend-triggered-services)
- [Cards Management](#cards-management)
- [Transactions](#transactions)
- [Budget Tracking](#budget-tracking)
- [Alerts & Reminders](#alerts--reminders)
- [Analytics](#analytics)
- [Recurring Transactions](#recurring-transactions)
- [Reports & Export](#reports--export)
- [Rewards System](#rewards-system)

---

## Authentication

### 1. Login with Google OAuth

```http
POST /auth/login
Content-Type: application/json

{
  "googleToken": "google-oauth-token"
}
```

**Response:**

```json
{
  "success": true,
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "gmail_connected": false
  }
}
```

### 2. Connect Gmail

```http
POST /auth/gmail/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "authCode": "google-oauth-auth-code"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Gmail connected successfully"
}
```

### 3. Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**

```json
{
  "success": true,
  "token": "new-jwt-access-token"
}
```

---

## Gmail Sync

### Manual Gmail Sync (Core Feature)

**✨ NEW - Zero-Cost Architecture**

Manually trigger Gmail sync to fetch and extract credit card transactions.

```http
POST /gmail/sync
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "summary": {
    "emailsScanned": 45,
    "transactionEmailsFound": 12,
    "newTransactions": 10,
    "duplicatesSkipped": 2,
    "processingTime": "3.42s"
  },
  "lastSync": "2025-11-03T10:30:00Z",
  "nextSyncRecommended": "2025-11-03T11:00:00Z"
}
```

**Rate Limit**: 10 requests per hour per user

**What Happens:**

1. Fetches emails since last sync (or all if first time)
2. Extracts transaction details (amount, merchant, date, card)
3. Deduplicates using email message ID
4. Updates `last_gmail_sync` timestamp
5. Returns summary with processing metrics

**Errors:**

- `403`: Gmail not connected
- `429`: Rate limit exceeded (10/hour)
- `500`: Sync failed (Gmail API error)

---

## Frontend-Triggered Services

**✨ NEW - Phase 3 Implementation**

These services are triggered automatically by frontend after Gmail sync completes.

### 1. Update Budget Tracking

```http
POST /services/update-budget
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "budget": {
    "limit": 30000,
    "spent": 25000,
    "remaining": 5000,
    "percentage": "83.33",
    "status": "warning"
  }
}
```

**Status Values:**

- `safe`: < 80% spent
- `warning`: 80-89% spent
- `critical`: 90-99% spent
- `exceeded`: ≥100% spent

### 2. Check Budget Alerts

```http
POST /services/check-alerts
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "budget_warning",
      "priority": "medium",
      "title": "Budget Warning",
      "message": "You've used 90% of your monthly budget (₹27,000 / ₹30,000)",
      "metadata": {
        "threshold": 90,
        "percentage": 90
      },
      "created_at": "2025-11-03T10:35:00Z"
    }
  ]
}
```

**Alert Types:**

- `budget_warning`: 80-89% spent
- `budget_critical`: 90-99% spent
- `budget_exceeded`: ≥100% spent

### 3. Check Bill Reminders

```http
POST /services/check-reminders
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "reminders": [
    {
      "card_id": "uuid",
      "card_name": "HDFC Regalia",
      "bank_name": "HDFC Bank",
      "due_date": 15,
      "days_remaining": 3,
      "message": "HDFC Regalia bill due on 15th (in 3 days)"
    }
  ]
}
```

### 4. Refresh Analytics Cache

```http
POST /services/refresh-analytics
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Analytics cache refreshed",
  "keysInvalidated": 4
}
```

**Cache Keys Invalidated:**

- `analytics:{userId}:dashboard_kpis`
- `analytics:{userId}:category_breakdown`
- `analytics:{userId}:monthly_trend`
- `analytics:{userId}:card_wise_spending`

---

## Cards Management

### 1. Get All Cards

```http
GET /cards
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "cards": [
    {
      "id": "uuid",
      "card_name": "HDFC Regalia",
      "bank_name": "HDFC Bank",
      "last_four_digits": "1234",
      "card_type": "credit",
      "credit_limit": 500000,
      "billing_cycle_start": 16,
      "billing_cycle_end": 15,
      "due_date": 5,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Add New Card

```http
POST /cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "card_name": "ICICI Amazon Pay",
  "bank_name": "ICICI Bank",
  "last_four_digits": "5678",
  "card_type": "credit",
  "credit_limit": 300000,
  "billing_cycle_start": 1,
  "billing_cycle_end": 31,
  "due_date": 20
}
```

### 3. Update Card

```http
PUT /cards/:cardId
Authorization: Bearer <token>
Content-Type: application/json

{
  "credit_limit": 600000,
  "is_active": true
}
```

### 4. Delete Card

```http
DELETE /cards/:cardId
Authorization: Bearer <token>
```

---

## Transactions

### 1. Get All Transactions

```http
GET /transactions?page=1&limit=50&startDate=2025-01-01&endDate=2025-12-31&cardId=uuid
Authorization: Bearer <token>
```

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range
- `cardId` (optional): Filter by card
- `category` (optional): Filter by category
- `merchantName` (optional): Search by merchant

**Response:**

```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "card_id": "uuid",
      "merchant_name": "Amazon",
      "amount": 2499,
      "transaction_type": "debit",
      "transaction_date": "2025-11-01T10:30:00Z",
      "category": "Shopping",
      "billing_cycle_month": 11,
      "billing_cycle_year": 2025,
      "email_message_id": "gmail-message-id",
      "created_at": "2025-11-01T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

### 2. Get Transaction by ID

```http
GET /transactions/:transactionId
Authorization: Bearer <token>
```

### 3. Update Transaction

```http
PUT /transactions/:transactionId
Authorization: Bearer <token>
Content-Type: application/json

{
  "category": "Entertainment",
  "merchant_name": "Netflix India"
}
```

### 4. Delete Transaction

```http
DELETE /transactions/:transactionId
Authorization: Bearer <token>
```

---

## Budget Tracking

### 1. Get Budget Status

```http
GET /budget/status?month=11&year=2025
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "budget": {
    "month": 11,
    "year": 2025,
    "budget_limit": 30000,
    "total_spent": 25000,
    "remaining": 5000,
    "percentage": 83.33,
    "status": "warning",
    "alert_sent": false,
    "updated_at": "2025-11-03T10:35:00Z"
  }
}
```

### 2. Set Monthly Budget

```http
POST /budget/set
Authorization: Bearer <token>
Content-Type: application/json

{
  "monthly_budget": 35000
}
```

### 3. Get Budget History

```http
GET /budget/history?months=12
Authorization: Bearer <token>
```

---

## Alerts & Reminders

### 1. Get All Alerts

```http
GET /alerts?priority=high&status=unread
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "budget_exceeded",
      "priority": "high",
      "title": "Budget Exceeded",
      "message": "You've exceeded your monthly budget of ₹30,000. Current spending: ₹32,500",
      "is_read": false,
      "metadata": {
        "budget_limit": 30000,
        "total_spent": 32500,
        "overspent": 2500
      },
      "created_at": "2025-11-03T10:35:00Z"
    }
  ]
}
```

### 2. Mark Alert as Read

```http
PUT /alerts/:alertId/read
Authorization: Bearer <token>
```

### 3. Get Upcoming Reminders

```http
GET /reminders/upcoming?days=7
Authorization: Bearer <token>
```

---

## Analytics

### 1. Get Dashboard KPIs

```http
GET /analytics/dashboard-kpis?months=12
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "kpis": {
    "totalSpent": 350000,
    "averageMonthly": 29166.67,
    "transactionCount": 450,
    "averageTransaction": 777.78,
    "topCategory": "Shopping",
    "topMerchant": "Amazon",
    "budgetUtilization": 83.33
  }
}
```

### 2. Get Category Breakdown

```http
GET /analytics/category-breakdown?months=6
Authorization: Bearer <token>
```

### 3. Get Monthly Trend

```http
GET /analytics/monthly-trend?months=12
Authorization: Bearer <token>
```

### 4. Get Card-Wise Spending

```http
GET /analytics/card-wise-spending?months=12
Authorization: Bearer <token>
```

---

## Recurring Transactions

### 1. Create Recurring Transaction

```http
POST /recurring-transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "card_id": "uuid",
  "merchant_name": "Netflix",
  "amount": 999,
  "frequency": "monthly",
  "start_date": "2025-11-01",
  "category": "Entertainment",
  "auto_execute": true,
  "notification_enabled": true
}
```

### 2. Get All Recurring Transactions

```http
GET /recurring-transactions?status=active
Authorization: Bearer <token>
```

### 3. Pause/Resume/Cancel

```http
POST /recurring-transactions/:id/pause
POST /recurring-transactions/:id/resume
POST /recurring-transactions/:id/cancel
Authorization: Bearer <token>
```

---

## Reports & Export

### 1. Generate Report

```http
POST /reports/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "spending_summary",
  "format": "pdf",
  "startDate": "2025-01-01",
  "endDate": "2025-12-31"
}
```

**Response**: Binary file download

### 2. Export Transactions

```http
GET /reports/export/transactions?format=csv&startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <token>
```

**Supported Formats:**

- `csv`: CSV file
- `excel`: Excel XLSX file
- `json`: JSON file

---

## Rewards System

### 1. Get Rewards Analytics

```http
GET /rewards/analytics?months=12
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "rewards": {
    "totalEarned": 25000,
    "totalRedeemed": 10000,
    "currentBalance": 15000,
    "projectedAnnual": 30000
  }
}
```

### 2. Get Optimization Recommendations

```http
GET /rewards/optimization
Authorization: Bearer <token>
```

### 3. Get Achievements

```http
GET /rewards/achievements
Authorization: Bearer <token>
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**HTTP Status Codes:**

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

---

## Rate Limits

- **Gmail Sync**: 10 requests/hour per user
- **Other Endpoints**: 1000 requests/hour per user

---

## Webhooks (Not Implemented - Zero-Cost)

Webhooks are not implemented in zero-cost architecture. Use frontend polling or manual sync instead.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All amounts are in paise (1 rupee = 100 paise)
- All endpoints use JSON for request/response bodies
- Authentication tokens expire after 1 hour (refresh required)

For implementation details, see [Implementation Phases](./IMPLEMENTATION_PHASES.md).
