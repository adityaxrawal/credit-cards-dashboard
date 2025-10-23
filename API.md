# 📚 API Documentation

This document provides comprehensive documentation for the Credit Card Dashboard API endpoints.

## 🔐 Authentication

Most API endpoints require authentication. The application uses Supabase Auth with Google OAuth.

### Authentication Headers

```http
Authorization: Bearer <supabase_jwt_token>
```

For admin endpoints:
```http
Authorization: Bearer <admin_api_key>
```

## 📊 Health & Monitoring

### Health Check

Check the overall health of the application and its dependencies.

**Endpoint:** `GET /api/health`

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy" | "unhealthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "responseTime": "150ms",
  "checks": {
    "database": true,
    "redis": true,
    "env": true
  },
  "details": {
    "database": "Connected to Supabase",
    "redis": "Connected to Upstash Redis",
    "env": "All required environment variables loaded"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

**Example:**
```bash
curl https://your-domain.com/api/health
```

### System Metrics

Get detailed system metrics and statistics (Admin only).

**Endpoint:** `GET /api/metrics`

**Authentication:** Admin API key required

**Headers:**
```http
Authorization: Bearer <admin_api_key>
```

**Response:**
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "responseTime": 250,
  "system": {
    "uptime": "2h 30m",
    "memory": {
      "used": "150MB",
      "total": "512MB",
      "rss": "200MB"
    },
    "environment": "production",
    "nodeVersion": "v18.17.0",
    "platform": "linux"
  },
  "database": {
    "totalUsers": 150,
    "totalCards": 300,
    "totalTransactions": 5000,
    "totalStatements": 120,
    "totalSpendingLimits": 75,
    "totalCardPerks": 45
  },
  "realtime": {
    "activeConnections": 25,
    "totalEvents": 1500
  },
  "queue": {
    "pendingJobs": 5,
    "completedJobs": 2500,
    "failedJobs": 10,
    "queueLength": 5
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer your-admin-api-key" \
     https://your-domain.com/api/metrics
```

## 🔑 Authentication

### OAuth Callback

Handle Google OAuth callback and create/update user session.

**Endpoint:** `POST /api/auth/callback`

**Authentication:** None (OAuth flow)

**Request Body:**
```json
{
  "code": "oauth_authorization_code",
  "state": "csrf_state_token"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "isNewUser": false
}
```

### Gmail Setup

Set up Gmail API access for email parsing.

**Endpoint:** `POST /api/gmail/setup`

**Authentication:** Required

**Request Body:**
```json
{
  "accessToken": "gmail_access_token",
  "refreshToken": "gmail_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Gmail access configured successfully"
}
```

## 💳 Credit Cards

### Get User Cards

Retrieve all credit cards for the authenticated user.

**Endpoint:** `GET /api/cards`

**Authentication:** Required

**Query Parameters:**
- `include_perks` (optional): Include card perks data
- `include_limits` (optional): Include spending limits data

**Response:**
```json
{
  "cards": [
    {
      "id": "card_uuid",
      "user_id": "user_uuid",
      "bank_name": "HDFC Bank",
      "card_name": "HDFC Regalia",
      "last_four_digits": "1234",
      "card_type": "credit",
      "credit_limit": 500000,
      "available_credit": 450000,
      "statement_date": 15,
      "due_date": 5,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "perks": [...],
      "spending_limits": [...]
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     "https://your-domain.com/api/cards?include_perks=true"
```

### Add Credit Card

Add a new credit card for the user.

**Endpoint:** `POST /api/cards`

**Authentication:** Required

**Request Body:**
```json
{
  "bank_name": "HDFC Bank",
  "card_name": "HDFC Regalia",
  "last_four_digits": "1234",
  "card_type": "credit",
  "credit_limit": 500000,
  "statement_date": 15,
  "due_date": 5
}
```

**Response:**
```json
{
  "success": true,
  "card": {
    "id": "card_uuid",
    "user_id": "user_uuid",
    "bank_name": "HDFC Bank",
    "card_name": "HDFC Regalia",
    "last_four_digits": "1234",
    "card_type": "credit",
    "credit_limit": 500000,
    "available_credit": 500000,
    "statement_date": 15,
    "due_date": 5,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Credit Card

Update an existing credit card.

**Endpoint:** `PUT /api/cards/[id]`

**Authentication:** Required

**Request Body:**
```json
{
  "card_name": "HDFC Regalia Gold",
  "credit_limit": 750000
}
```

**Response:**
```json
{
  "success": true,
  "card": {
    "id": "card_uuid",
    "card_name": "HDFC Regalia Gold",
    "credit_limit": 750000,
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Delete Credit Card

Delete a credit card.

**Endpoint:** `DELETE /api/cards/[id]`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Credit card deleted successfully"
}
```

## 💰 Transactions

### Get Transactions

Retrieve transactions for the authenticated user.

**Endpoint:** `GET /api/transactions`

**Authentication:** Required

**Query Parameters:**
- `card_id` (optional): Filter by specific card
- `type` (optional): Filter by transaction type (`current` | `statement`)
- `category` (optional): Filter by category
- `limit` (optional): Number of transactions to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `start_date` (optional): Filter from date (ISO string)
- `end_date` (optional): Filter to date (ISO string)

**Response:**
```json
{
  "transactions": [
    {
      "id": "transaction_uuid",
      "card_id": "card_uuid",
      "amount": 2500.00,
      "merchant": "Amazon India",
      "category": "shopping",
      "transaction_date": "2024-01-01T10:30:00.000Z",
      "description": "Online purchase",
      "transaction_type": "debit",
      "status": "completed",
      "created_at": "2024-01-01T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <jwt_token>" \
     "https://your-domain.com/api/transactions?card_id=card_uuid&limit=20"
```

### Add Transaction

Add a new transaction manually.

**Endpoint:** `POST /api/transactions`

**Authentication:** Required

**Request Body:**
```json
{
  "card_id": "card_uuid",
  "amount": 2500.00,
  "merchant": "Local Restaurant",
  "category": "dining",
  "transaction_date": "2024-01-01T19:30:00.000Z",
  "description": "Dinner with friends",
  "transaction_type": "debit"
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "transaction_uuid",
    "card_id": "card_uuid",
    "amount": 2500.00,
    "merchant": "Local Restaurant",
    "category": "dining",
    "transaction_date": "2024-01-01T19:30:00.000Z",
    "description": "Dinner with friends",
    "transaction_type": "debit",
    "status": "completed",
    "created_at": "2024-01-01T19:30:00.000Z"
  }
}
```

### Update Transaction

Update an existing transaction.

**Endpoint:** `PUT /api/transactions/[id]`

**Authentication:** Required

**Request Body:**
```json
{
  "category": "entertainment",
  "description": "Movie tickets"
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": "transaction_uuid",
    "category": "entertainment",
    "description": "Movie tickets",
    "updated_at": "2024-01-01T20:00:00.000Z"
  }
}
```

### Delete Transaction

Delete a transaction.

**Endpoint:** `DELETE /api/transactions/[id]`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

## 📊 Analytics

### Spending Analytics

Get spending analytics and insights.

**Endpoint:** `GET /api/analytics/spending`

**Authentication:** Required

**Query Parameters:**
- `period` (optional): Time period (`week` | `month` | `quarter` | `year`)
- `card_id` (optional): Filter by specific card
- `category` (optional): Filter by category

**Response:**
```json
{
  "summary": {
    "totalSpent": 45000.00,
    "transactionCount": 125,
    "averageTransaction": 360.00,
    "period": "month"
  },
  "categoryBreakdown": [
    {
      "category": "shopping",
      "amount": 15000.00,
      "percentage": 33.33,
      "transactionCount": 45
    },
    {
      "category": "dining",
      "amount": 12000.00,
      "percentage": 26.67,
      "transactionCount": 30
    }
  ],
  "dailySpending": [
    {
      "date": "2024-01-01",
      "amount": 2500.00,
      "transactionCount": 3
    }
  ],
  "cardBreakdown": [
    {
      "card_id": "card_uuid",
      "card_name": "HDFC Regalia",
      "amount": 25000.00,
      "percentage": 55.56
    }
  ]
}
```

### Category Analytics

Get detailed category-wise spending analysis.

**Endpoint:** `GET /api/analytics/categories`

**Authentication:** Required

**Response:**
```json
{
  "categories": [
    {
      "category": "shopping",
      "currentMonth": 15000.00,
      "previousMonth": 12000.00,
      "change": 25.00,
      "trend": "up",
      "topMerchants": [
        {
          "merchant": "Amazon India",
          "amount": 8000.00,
          "transactionCount": 15
        }
      ]
    }
  ]
}
```

## 🎯 Spending Limits

### Get Spending Limits

Get all spending limits for the user.

**Endpoint:** `GET /api/spending-limits`

**Authentication:** Required

**Response:**
```json
{
  "limits": [
    {
      "id": "limit_uuid",
      "card_id": "card_uuid",
      "category": "shopping",
      "limit_amount": 20000.00,
      "spent_amount": 15000.00,
      "period": "monthly",
      "alert_threshold": 80,
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Set Spending Limit

Create or update a spending limit.

**Endpoint:** `POST /api/spending-limits`

**Authentication:** Required

**Request Body:**
```json
{
  "card_id": "card_uuid",
  "category": "dining",
  "limit_amount": 10000.00,
  "period": "monthly",
  "alert_threshold": 75
}
```

**Response:**
```json
{
  "success": true,
  "limit": {
    "id": "limit_uuid",
    "card_id": "card_uuid",
    "category": "dining",
    "limit_amount": 10000.00,
    "spent_amount": 0.00,
    "period": "monthly",
    "alert_threshold": 75,
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## 📄 Statements

### Get Statements

Retrieve credit card statements.

**Endpoint:** `GET /api/statements`

**Authentication:** Required

**Query Parameters:**
- `card_id` (optional): Filter by specific card
- `year` (optional): Filter by year
- `month` (optional): Filter by month

**Response:**
```json
{
  "statements": [
    {
      "id": "statement_uuid",
      "card_id": "card_uuid",
      "statement_date": "2024-01-15",
      "due_date": "2024-02-05",
      "total_amount": 45000.00,
      "minimum_due": 4500.00,
      "previous_balance": 0.00,
      "payments_credits": 0.00,
      "purchases": 45000.00,
      "fees_charges": 0.00,
      "interest_charges": 0.00,
      "status": "generated",
      "created_at": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

### Get Statement Details

Get detailed statement with transactions.

**Endpoint:** `GET /api/statements/[id]`

**Authentication:** Required

**Response:**
```json
{
  "statement": {
    "id": "statement_uuid",
    "card_id": "card_uuid",
    "statement_date": "2024-01-15",
    "due_date": "2024-02-05",
    "total_amount": 45000.00,
    "minimum_due": 4500.00,
    "transactions": [
      {
        "id": "transaction_uuid",
        "amount": 2500.00,
        "merchant": "Amazon India",
        "transaction_date": "2024-01-01T10:30:00.000Z",
        "category": "shopping"
      }
    ]
  }
}
```

## 🔄 Real-time Events

### Server-Sent Events

Subscribe to real-time updates for transactions and notifications.

**Endpoint:** `GET /api/events`

**Authentication:** Required

**Headers:**
```http
Accept: text/event-stream
Cache-Control: no-cache
```

**Event Types:**
- `transaction`: New transaction added
- `statement`: New statement generated
- `limit_alert`: Spending limit alert
- `payment_reminder`: Payment due reminder

**Example Event:**
```
event: transaction
data: {"type":"transaction","data":{"id":"transaction_uuid","amount":2500.00,"merchant":"Amazon India"}}

event: limit_alert
data: {"type":"limit_alert","data":{"category":"shopping","spent":18000,"limit":20000,"percentage":90}}
```

**Example:**
```javascript
const eventSource = new EventSource('/api/events', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## 📧 Email Processing

### Sync Emails

Manually trigger email synchronization.

**Endpoint:** `POST /api/emails/sync`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Email sync initiated",
  "jobId": "job_uuid"
}
```

### Email Processing Status

Check the status of email processing jobs.

**Endpoint:** `GET /api/emails/status`

**Authentication:** Required

**Response:**
```json
{
  "status": "processing",
  "totalEmails": 150,
  "processedEmails": 120,
  "newTransactions": 25,
  "errors": 2,
  "lastSync": "2024-01-01T10:00:00.000Z"
}
```

## ❌ Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Missing or invalid authentication
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

### Rate Limiting

API endpoints are rate-limited:
- **General endpoints**: 100 requests per minute
- **Auth endpoints**: 10 requests per minute
- **Email sync**: 5 requests per hour

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 🔧 Testing

### Test with cURL

```bash
# Health check
curl https://your-domain.com/api/health

# Get cards (authenticated)
curl -H "Authorization: Bearer <jwt_token>" \
     https://your-domain.com/api/cards

# Add transaction
curl -X POST \
     -H "Authorization: Bearer <jwt_token>" \
     -H "Content-Type: application/json" \
     -d '{"card_id":"card_uuid","amount":1500,"merchant":"Test Store"}' \
     https://your-domain.com/api/transactions
```

### Postman Collection

A Postman collection is available at `/docs/postman/Credit-Card-Dashboard.postman_collection.json` with all endpoints pre-configured.

---

For more information, see the main [README.md](./README.md) file.