# API Reference Documentation

**Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Base URL:** `https://your-api.run.app` (Production) | `http://localhost:4000` (Development)

---

## 🔐 Authentication

All API endpoints (except `/health` and `/api/auth/*`) require authentication via JWT Bearer token.

### Headers

```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Authentication Flow

#### 1. Google OAuth Login

```http
POST /api/auth/google
Content-Type: application/json

{
  "code": "google_oauth_code_from_frontend"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "profilePicture": "https://..."
    }
  }
}
```

#### 2. Refresh Access Token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token"
  }
}
```

#### 3. Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "profilePicture": "https://...",
      "monthlyBudget": 30000,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### 4. Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

---

## 💳 Credit Cards API

### List All Cards

```http
GET /api/cards
Authorization: Bearer <token>
```

**Query Parameters:**

- `active` (boolean, optional): Filter by active status

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "cardName": "HDFC Regalia",
      "bankName": "HDFC Bank",
      "cardType": "Credit",
      "lastFourDigits": "1234",
      "billDate": 15,
      "dueDate": 5,
      "creditLimit": 500000,
      "currentOutstanding": 25000,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Get Single Card

```http
GET /api/cards/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "cardName": "HDFC Regalia",
    "bankName": "HDFC Bank"
    // ... all card fields
  }
}
```

### Create Card

```http
POST /api/cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardName": "HDFC Regalia",
  "bankName": "HDFC Bank",
  "cardType": "Credit",
  "lastFourDigits": "1234",
  "billDate": 15,
  "dueDate": 5,
  "creditLimit": 500000,
  "cardActivationDate": "2024-01-01",
  "notes": "Primary card"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "newly_created_uuid"
    // ... all card fields
  }
}
```

### Update Card

```http
PUT /api/cards/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardName": "HDFC Regalia Gold",
  "creditLimit": 600000
}
```

### Delete Card

```http
DELETE /api/cards/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "message": "Card deleted successfully"
}
```

---

## 💰 Transactions API

### List Transactions

```http
GET /api/transactions
Authorization: Bearer <token>
```

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `cardId` (uuid): Filter by card
- `startDate` (ISO date): Filter from date
- `endDate` (ISO date): Filter to date
- `merchantName` (string): Search by merchant
- `minAmount` (number): Minimum amount
- `maxAmount` (number): Maximum amount
- `sort` (string): Sort field (default: transaction_date)
- `order` (string): Sort order - asc|desc (default: desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "cardId": "uuid",
        "transactionDate": "2024-11-04T10:30:00Z",
        "merchantName": "Amazon",
        "merchantCategory": "Shopping",
        "amount": 2500,
        "transactionType": "debit",
        "description": "Online purchase",
        "billingCycleMonth": 11,
        "billingCycleYear": 2024,
        "isManuallyAdded": false,
        "createdAt": "2024-11-04T10:35:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

### Get Single Transaction

```http
GET /api/transactions/:id
Authorization: Bearer <token>
```

### Create Transaction

```http
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardId": "uuid",
  "transactionDate": "2024-11-04T10:30:00Z",
  "merchantName": "Starbucks",
  "merchantCategory": "Food & Dining",
  "amount": 450,
  "transactionType": "debit",
  "description": "Coffee",
  "isManuallyAdded": true
}
```

### Update Transaction

```http
PUT /api/transactions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "merchantCategory": "Cafe",
  "description": "Morning coffee"
}
```

### Delete Transaction

```http
DELETE /api/transactions/:id
Authorization: Bearer <token>
```

### Bulk Import Transactions

```http
POST /api/transactions/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "transactions": [
    {
      "cardId": "uuid",
      "transactionDate": "2024-11-01",
      "merchantName": "Merchant 1",
      "amount": 1000
    },
    // ... more transactions
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "imported": 50,
    "failed": 2,
    "duplicates": 3,
    "errors": [
      {
        "row": 25,
        "error": "Invalid card ID"
      }
    ]
  }
}
```

---

## 📊 Dashboard API

### Get Dashboard Overview

```http
GET /api/dashboard/overview
Authorization: Bearer <token>
```

**Query Parameters:**

- `month` (number, optional): Month (1-12)
- `year` (number, optional): Year

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCards": 3,
      "activeCards": 3,
      "totalTransactions": 156,
      "currentMonthSpending": 45000,
      "lastMonthSpending": 38000,
      "spendingChange": 18.4,
      "budgetUtilization": 75
    },
    "topCategories": [
      {
        "category": "Shopping",
        "amount": 15000,
        "percentage": 33.3,
        "transactionCount": 25
      }
    ],
    "recentTransactions": [
      // Last 10 transactions
    ],
    "upcomingBills": [
      {
        "cardId": "uuid",
        "cardName": "HDFC Regalia",
        "dueDate": "2024-11-15",
        "estimatedAmount": 25000,
        "daysUntilDue": 11
      }
    ]
  }
}
```

---

## 📈 Analytics API

### Get Analytics Summary

```http
GET /api/analytics/summary
Authorization: Bearer <token>
```

**Query Parameters:**

- `period` (string): day|week|month|year (default: month)
- `startDate` (ISO date)
- `endDate` (ISO date)

**Response:**

```json
{
  "success": true,
  "data": {
    "totalSpending": 45000,
    "averageTransaction": 288.46,
    "transactionCount": 156,
    "topMerchant": "Amazon",
    "categoryBreakdown": [
      {
        "category": "Shopping",
        "amount": 15000,
        "percentage": 33.3
      }
    ],
    "cardWiseSpending": [
      {
        "cardId": "uuid",
        "cardName": "HDFC Regalia",
        "amount": 25000,
        "percentage": 55.6
      }
    ]
  }
}
```

### Get Spending Trends

```http
GET /api/analytics/spending-trends
Authorization: Bearer <token>
```

**Query Parameters:**

- `period` (string): month|quarter|year
- `groupBy` (string): day|week|month

**Response:**

```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "period": "2024-11",
        "amount": 45000,
        "transactionCount": 156,
        "averageTransaction": 288.46
      }
    ],
    "forecast": {
      "nextMonth": 48000,
      "confidence": 0.85
    }
  }
}
```

### Get Category Analytics

```http
GET /api/analytics/categories
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "category": "Shopping",
      "currentMonth": 15000,
      "lastMonth": 12000,
      "change": 25,
      "trend": "up",
      "topMerchants": ["Amazon", "Flipkart"]
    }
  ]
}
```

---

## 💸 Budget API

### Get Current Budget

```http
GET /api/budget/current
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "month": 11,
    "year": 2024,
    "budgetLimit": 50000,
    "totalSpent": 45000,
    "remaining": 5000,
    "utilizationPercentage": 90,
    "alertSent": true,
    "categoryBudgets": [
      {
        "category": "Shopping",
        "limit": 20000,
        "spent": 15000,
        "remaining": 5000
      }
    ]
  }
}
```

### Update Budget

```http
PUT /api/budget
Authorization: Bearer <token>
Content-Type: application/json

{
  "monthlyLimit": 60000,
  "categoryLimits": {
    "Shopping": 25000,
    "Food & Dining": 15000,
    "Transportation": 10000
  }
}
```

### Get Budget History

```http
GET /api/budget/history
Authorization: Bearer <token>
```

**Query Parameters:**

- `months` (number): Number of months to retrieve (default: 6)

---

## 🔔 Alerts API

### List Alerts

```http
GET /api/alerts
Authorization: Bearer <token>
```

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `unreadOnly` (boolean): Filter unread alerts
- `type` (string): Filter by alert type

**Response:**

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "uuid",
        "type": "budget_alert",
        "priority": "high",
        "title": "Budget Alert",
        "message": "You've used 90% of your monthly budget",
        "isRead": false,
        "createdAt": "2024-11-04T10:00:00Z",
        "metadata": {
          "budgetUsed": 45000,
          "budgetLimit": 50000
        }
      }
    ],
    "pagination": {
      "page": 1,
      "total": 25,
      "hasMore": true
    },
    "unreadCount": 8
  }
}
```

### Mark Alert as Read

```http
PUT /api/alerts/:id/read
Authorization: Bearer <token>
```

### Mark All as Read

```http
PUT /api/alerts/read-all
Authorization: Bearer <token>
```

### Delete Alert

```http
DELETE /api/alerts/:id
Authorization: Bearer <token>
```

---

## 🔄 Recurring Transactions API

### List Recurring Transactions

```http
GET /api/recurring-transactions
Authorization: Bearer <token>
```

### Create Recurring Transaction

```http
POST /api/recurring-transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "cardId": "uuid",
  "merchantName": "Netflix",
  "amount": 649,
  "category": "Entertainment",
  "frequency": "monthly",
  "startDate": "2024-11-01",
  "dayOfMonth": 1,
  "isActive": true
}
```

---

## 📧 Gmail Integration API

### Connect Gmail

```http
POST /api/gmail/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "authCode": "google_oauth_code"
}
```

### Get Gmail Status

```http
GET /api/gmail/status
Authorization: Bearer <token>
```

### Trigger Email Scan

```http
POST /api/gmail/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-11-04"
}
```

### Get Scan Progress

```http
GET /api/gmail/scan/:jobId
Authorization: Bearer <token>
```

---

## 📄 Export API

### Export Transactions

```http
POST /api/export/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "format": "csv",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "cardIds": ["uuid1", "uuid2"],
  "includeMetadata": true
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "expiresAt": "2024-11-05T10:00:00Z"
  }
}
```

### Generate Report

```http
POST /api/reports/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "reportType": "monthly_summary",
  "month": 11,
  "year": 2024,
  "format": "pdf"
}
```

---

## 🏥 Health Check

### System Health

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-11-04T10:00:00Z",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "gmail": "healthy"
  }
}
```

---

## 📝 Error Responses

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  }
}
```

### Common Error Codes

| Code                  | HTTP Status | Description                             |
| --------------------- | ----------- | --------------------------------------- |
| `AUTH_REQUIRED`       | 401         | Authentication token missing or invalid |
| `AUTH_EXPIRED`        | 401         | Authentication token expired            |
| `FORBIDDEN`           | 403         | Insufficient permissions                |
| `NOT_FOUND`           | 404         | Resource not found                      |
| `VALIDATION_ERROR`    | 400         | Invalid request data                    |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests                       |
| `INTERNAL_ERROR`      | 500         | Internal server error                   |

---

## 🚀 Rate Limiting

- **Authenticated requests:** 1000 requests per hour per user
- **Unauthenticated requests:** 100 requests per hour per IP
- **Bulk operations:** 10 requests per minute

Rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1699099200
```

---

## 📦 Pagination

All list endpoints support pagination:

**Query Parameters:**

- `page`: Page number (1-indexed)
- `limit`: Items per page (max: 100)

**Response:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasMore": true
  }
}
```

---

## 🔗 SDKs & Libraries

- **JavaScript/TypeScript:** `@creditcard-dashboard/sdk`
- **Python:** `creditcard-dashboard`
- **cURL examples:** See `/docs/api-examples.md`

---

**API Version:** 1.0.0  
**Last Updated:** November 4, 2025  
**Support:** api-support@creditcard-dashboard.com
