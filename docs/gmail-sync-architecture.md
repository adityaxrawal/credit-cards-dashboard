# Gmail Sync Architecture

## Overview

The Gmail Sync feature automatically extracts credit card transaction information from emails, eliminating manual data entry. This document describes the complete architecture, flow, and implementation details.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Gmail Account                     │
│  (Transaction emails from banks, credit card companies, etc.)   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ OAuth 2.0 Authorization
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Google OAuth 2.0 Server                       │
│   - Issues access tokens (1 hour expiry)                        │
│   - Issues refresh tokens (stored encrypted)                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Access Token
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                        Gmail API Client                          │
│  Backend: /api/gmail/* endpoints                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. OAuth Flow Handler                                    │  │
│  │     - Generate authorization URL                          │  │
│  │     - Handle OAuth callback                               │  │
│  │     - Store encrypted refresh token                       │  │
│  │  2. Token Manager                                         │  │
│  │     - Refresh expired access tokens                       │  │
│  │     - Handle token revocation                             │  │
│  │  3. Email Fetcher                                         │  │
│  │     - Query Gmail API for transaction emails              │  │
│  │     - Rate limiting & pagination                          │  │
│  │  4. Email Classifier                                      │  │
│  │     - Identify transaction-related emails                 │  │
│  │     - Filter spam/promotions                              │  │
│  │  5. Transaction Extractor                                 │  │
│  │     - Parse email content                                 │  │
│  │     - Extract structured data                             │  │
│  │  6. Deduplication Engine                                  │  │
│  │     - Check email_message_id uniqueness                   │  │
│  │     - Prevent duplicate transactions                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ Extracted Transactions
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Supabase Database                             │
│  - transactions table (with email_message_id)                   │
│  - gmail_tokens table (encrypted refresh tokens)                │
│  - gmail_sync_logs table (sync history & errors)                │
└──────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### 1. Initial Authorization

```
Client                    Backend                    Google OAuth
  │                          │                            │
  │  GET /api/gmail/auth     │                            │
  │ ────────────────────────>│                            │
  │                          │                            │
  │  Authorization URL       │                            │
  │ <────────────────────────│                            │
  │                          │                            │
  │  Open URL in browser     │                            │
  │ ───────────────────────────────────────────────────>  │
  │                          │                            │
  │                          │  User grants permissions   │
  │                          │                            │
  │  Redirect to callback    │                            │
  │ <──────────────────────────────────────────────────┘  │
  │                          │                            │
  │  GET /api/gmail/callback?code=...                     │
  │ ────────────────────────>│                            │
  │                          │                            │
  │                          │  Exchange code for tokens  │
  │                          │ ──────────────────────────>│
  │                          │                            │
  │                          │  Access + Refresh Tokens   │
  │                          │ <──────────────────────────│
  │                          │                            │
  │  Success + User Info     │  Store encrypted tokens    │
  │ <────────────────────────│                            │
```

### 2. Token Refresh (Automatic)

```typescript
// Token Manager automatically refreshes expired tokens
async function getValidAccessToken(userId: string): Promise<string> {
  const token = await getStoredToken(userId);

  if (isExpired(token.accessToken)) {
    const newToken = await oauth2Client.refreshAccessToken(token.refreshToken);
    await updateStoredToken(userId, newToken);
    return newToken.accessToken;
  }

  return token.accessToken;
}
```

## Email Sync Flow

### Complete Sync Process

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INITIATE SYNC                                                 │
│    POST /api/gmail/sync                                          │
│    { force: false, maxResults: 50 }                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 2. VALIDATE & AUTHENTICATE                                       │
│    - Check user authentication (JWT)                             │
│    - Verify Gmail authorization exists                           │
│    - Get valid access token (refresh if needed)                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 3. QUERY GMAIL API                                               │
│    Query: "transaction OR payment OR charged OR purchase"        │
│    - Fetch last 50 messages (or maxResults)                      │
│    - Filter by date (last 30 days default)                       │
│    - Exclude spam/trash                                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 4. FETCH EMAIL CONTENT                                           │
│    For each message:                                             │
│    - Get full message with body                                  │
│    - Extract headers (from, subject, date)                       │
│    - Decode HTML/plain text body                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 5. CLASSIFY EMAILS                                               │
│    Score each email based on:                                    │
│    - Sender domain (bank domains = high score)                   │
│    - Subject keywords ("transaction", "payment")                 │
│    - Body patterns (currency symbols, amounts)                   │
│    - Filter: score >= 0.6 to proceed                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 6. EXTRACT TRANSACTION DATA                                      │
│    For each classified email:                                    │
│    - Amount: Regex patterns for currency amounts                 │
│    - Merchant: Parse business names                              │
│    - Date: Extract transaction date (default to email date)      │
│    - Card: Last 4 digits of card number                          │
│    - Category: Basic categorization rules                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 7. DEDUPLICATION CHECK                                           │
│    For each extracted transaction:                               │
│    - Check if email_message_id exists in DB                      │
│    - Skip if already processed                                   │
│    - Prevents duplicate entries from re-syncs                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 8. INSERT TRANSACTIONS                                           │
│    - Insert new transactions into database                       │
│    - Store email_message_id for deduplication                    │
│    - Log processing status (success/error)                       │
│    - Update sync statistics                                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│ 9. RETURN SYNC RESULTS                                           │
│    {                                                              │
│      processed: 50,    // Total emails processed                 │
│      inserted: 12,     // New transactions added                 │
│      skipped: 38,      // Already exists or not relevant         │
│      errors: 0         // Failed to process                      │
│    }                                                              │
└───────────────────────────────────────────────────────────────────┘
```

## Data Models

### Gmail Tokens Table

```sql
CREATE TABLE gmail_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,  -- Encrypted
  token_expiry TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### Transactions with Email Tracking

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  merchant VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  transaction_date DATE NOT NULL,
  card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  email_message_id VARCHAR(255),  -- Gmail message ID for deduplication
  source VARCHAR(50) DEFAULT 'manual',  -- 'manual' | 'gmail' | 'api'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email_message_id)  -- Prevent duplicate emails
);

CREATE INDEX idx_transactions_email_message_id
  ON transactions(email_message_id);
```

### Sync Logs

```sql
CREATE TABLE gmail_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,
  emails_processed INTEGER DEFAULT 0,
  transactions_inserted INTEGER DEFAULT 0,
  transactions_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  status VARCHAR(50),  -- 'success' | 'partial' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation Details

### Email Classifier

```typescript
interface ClassificationResult {
  isTransaction: boolean;
  confidence: number;
  reason: string;
}

class EmailClassifier {
  // Known bank/financial institution domains
  private trustedDomains = [
    "chase.com",
    "bankofamerica.com",
    "citi.com",
    "americanexpress.com",
    "discover.com",
    "capitalone.com",
  ];

  // Transaction keywords
  private transactionKeywords = [
    "transaction",
    "payment",
    "charged",
    "purchase",
    "authorization",
    "declined",
    "approved",
  ];

  classify(email: GmailMessage): ClassificationResult {
    let score = 0;

    // Check sender domain (40% weight)
    if (this.isTrustedSender(email.from)) {
      score += 0.4;
    }

    // Check subject line (30% weight)
    const subjectScore = this.scoreKeywords(email.subject);
    score += subjectScore * 0.3;

    // Check email body (30% weight)
    const bodyScore = this.scoreKeywords(email.body);
    score += bodyScore * 0.3;

    return {
      isTransaction: score >= 0.6,
      confidence: score,
      reason: this.getClassificationReason(score),
    };
  }
}
```

### Transaction Extractor

```typescript
class TransactionExtractor {
  // Regex patterns for amount extraction
  private amountPatterns = [
    /\$[\d,]+\.\d{2}/g, // $123.45
    /USD\s*[\d,]+\.\d{2}/gi, // USD 123.45
    /[\d,]+\.\d{2}\s*USD/gi, // 123.45 USD
  ];

  // Merchant extraction patterns
  private merchantPatterns = [
    /(?:at|from)\s+([A-Z][A-Za-z0-9\s&'-]+)/,
    /merchant[:\s]+([A-Za-z0-9\s&'-]+)/i,
  ];

  extract(email: GmailMessage): TransactionData | null {
    const amount = this.extractAmount(email.body);
    const merchant = this.extractMerchant(email.body, email.subject);
    const date = this.extractDate(email.body) || email.date;
    const cardLast4 = this.extractCardNumber(email.body);

    if (!amount || !merchant) {
      return null;
    }

    return {
      amount,
      merchant,
      date,
      cardLast4,
      category: this.inferCategory(merchant),
      emailMessageId: email.id,
      source: "gmail",
    };
  }

  private extractAmount(text: string): number | null {
    for (const pattern of this.amountPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        const amount = parseFloat(matches[0].replace(/[^\d.]/g, ""));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    return null;
  }
}
```

### Rate Limiter

```typescript
class GmailRateLimiter {
  private static readonly QUOTA_PER_DAY = 1000000000; // 1 billion per day
  private static readonly REQUESTS_PER_SECOND = 250;
  private static readonly REQUESTS_PER_USER_PER_SECOND = 25;

  async checkLimit(userId: string): Promise<boolean> {
    const userKey = `gmail:ratelimit:${userId}`;
    const current = await redis.get(userKey);

    if (current && parseInt(current) >= this.REQUESTS_PER_USER_PER_SECOND) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    await redis.incr(userKey);
    await redis.expire(userKey, 1); // 1 second TTL

    return true;
  }
}
```

## Error Handling

### Common Errors & Solutions

| Error                      | Cause                         | Solution                            |
| -------------------------- | ----------------------------- | ----------------------------------- |
| `invalid_grant`            | Refresh token expired/revoked | User must re-authorize              |
| `insufficient_permissions` | Missing Gmail API scope       | Check OAuth scopes                  |
| `quota_exceeded`           | Gmail API quota limit         | Implement backoff, reduce frequency |
| `UNAUTHENTICATED`          | Access token expired          | Auto-refresh with refresh token     |
| `NOT_FOUND`                | Message deleted               | Skip and continue                   |

### Error Recovery Strategy

```typescript
async function syncWithRetry(userId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await performSync(userId);
    } catch (error) {
      if (error.code === "invalid_grant") {
        // Cannot retry - need re-authorization
        throw new Error("Authorization expired. Please reconnect Gmail.");
      }

      if (error.code === "quota_exceeded") {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }

      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}
```

## Security Considerations

### Token Storage

1. **Encryption at Rest**
   - Refresh tokens encrypted using AES-256-GCM
   - Encryption key stored in environment (not in database)
   - Never log or expose tokens in API responses

2. **Access Control**
   - Each user can only access their own tokens
   - Row-Level Security (RLS) enforced in Supabase
   - Token operations require valid JWT

### API Security

1. **Rate Limiting**
   - 10 requests per 15 minutes for Gmail endpoints
   - Prevents abuse and quota exhaustion
   - Per-user rate limiting

2. **Input Validation**
   - Validate all Gmail API responses
   - Sanitize extracted transaction data
   - Prevent injection attacks

3. **Scope Minimization**
   - Only request `gmail.readonly` scope
   - No write access to user's Gmail
   - No access to contacts or other Google services

## Performance Optimization

### Caching Strategy

```typescript
// Cache sync status to avoid redundant checks
const cacheKey = `gmail:sync:${userId}:status`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const status = await getSyncStatus(userId);
await redis.set(cacheKey, JSON.stringify(status), "EX", 60);
```

### Batch Processing

```typescript
// Process emails in batches to avoid memory issues
const BATCH_SIZE = 10;

for (let i = 0; i < messages.length; i += BATCH_SIZE) {
  const batch = messages.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map((msg) => processMessage(msg)));
}
```

### Database Optimization

```sql
-- Indexes for fast lookups
CREATE INDEX idx_transactions_user_date
  ON transactions(user_id, transaction_date DESC);

CREATE INDEX idx_gmail_tokens_user
  ON gmail_tokens(user_id);

-- Partial index for Gmail transactions
CREATE INDEX idx_transactions_gmail_source
  ON transactions(user_id)
  WHERE source = 'gmail';
```

## Monitoring & Observability

### Key Metrics

```typescript
// Track sync performance
metricsCollector.recordSync({
  userId,
  duration: syncEndTime - syncStartTime,
  emailsProcessed: stats.processed,
  transactionsInserted: stats.inserted,
  errors: stats.errors,
});

// Log to Sentry for errors
if (stats.errors > 0) {
  Sentry.captureMessage("Gmail sync completed with errors", {
    level: "warning",
    extra: { userId, stats },
  });
}
```

### Logging

```typescript
logger.info("Gmail sync started", { userId, maxResults });
logger.debug("Fetched emails from Gmail", { count: messages.length });
logger.warn("Email classification failed", { emailId, reason });
logger.error("Transaction extraction error", { emailId, error });
```

## Frontend Integration

### React Hook Example

```typescript
function useGmailSync() {
  const [status, setStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [stats, setStats] = useState<SyncStats | null>(null);

  const authorize = async () => {
    const { authUrl } = await fetch("/api/gmail/auth").then((r) => r.json());
    window.location.href = authUrl;
  };

  const sync = async () => {
    setStatus("syncing");
    try {
      const result = await fetch("/api/gmail/sync", { method: "POST" }).then(
        (r) => r.json()
      );
      setStats(result);
      setStatus("success");
    } catch (error) {
      setStatus("error");
    }
  };

  return { status, stats, authorize, sync };
}
```

## Future Enhancements

1. **ML-Based Classification**
   - Train model on user-labeled emails
   - Improve extraction accuracy
   - Adaptive learning

2. **Real-time Sync**
   - Gmail Push Notifications (watch API)
   - Webhook-based processing
   - Instant transaction updates

3. **Multi-Account Support**
   - Link multiple Gmail accounts
   - Aggregate transactions across accounts
   - Unified dashboard

4. **Advanced Categorization**
   - Auto-categorize based on merchant
   - Learn from user corrections
   - Suggest category changes

5. **Receipt Attachment Processing**
   - Extract data from PDF receipts
   - OCR for images
   - Itemized breakdown

## Troubleshooting

### User Cannot Authorize Gmail

**Check:**

- Google OAuth credentials configured
- Redirect URI matches exactly
- Gmail API enabled in Google Cloud Console

### Sync Returns 0 Transactions

**Check:**

- User has transaction emails in last 30 days
- Email query is not too restrictive
- Classifier confidence threshold not too high

### Duplicate Transactions

**Check:**

- `email_message_id` unique constraint exists
- Deduplication logic is executed
- Database constraint is enforced

### Token Refresh Fails

**Check:**

- Refresh token not expired (6 months for testing apps)
- User hasn't revoked access
- OAuth credentials still valid

---

**Last Updated:** November 7, 2024  
**Version:** 1.0.0  
**Author:** Backend Team
