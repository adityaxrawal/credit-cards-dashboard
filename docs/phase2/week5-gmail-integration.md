# Phase 2 - Week 5: Gmail API Integration

## Overview

Week 5 implements the foundational Gmail integration infrastructure including OAuth2 authentication, secure token management, and the email fetching pipeline.

## Implemented Components

### 1. Token Manager (`token-manager.ts`)

**Purpose**: Securely manage Gmail OAuth tokens with encryption and automatic refresh.

**Features**:

- AES-256-GCM encryption for refresh token storage
- Automatic token refresh with expiry detection (5-minute buffer)
- Token revocation and cleanup
- Secure decryption on retrieval

**Key Methods**:

- `storeTokens()` - Encrypt and store OAuth tokens
- `getTokens()` - Retrieve and decrypt tokens
- `isTokenExpired()` - Check if token needs refresh
- `refreshAccessToken()` - Refresh expired access token
- `getValidAccessToken()` - Get valid token, refreshing if needed
- `revokeTokens()` - Revoke and remove tokens
- `hasValidTokens()` - Check if user has valid tokens

**Security**:

- 32-byte encryption key (AES-256)
- IV (Initialization Vector) randomized per encryption
- Auth tag for integrity verification
- Tokens never logged in plain text

### 2. Email Fetcher (`email-fetcher.ts`)

**Purpose**: Fetch and normalize Gmail messages into consistent structure.

**Features**:

- Fetch single or batch emails
- Base64url decoding for email content
- Header extraction (From, To, Subject, Date)
- Body extraction (plain text and HTML)
- History API support for incremental sync
- Message listing with Gmail query syntax

**Key Methods**:

- `fetchEmail()` - Fetch single email by ID
- `fetchEmailsBatch()` - Fetch multiple emails (batched in groups of 50)
- `listMessages()` - List message IDs matching query
- `getHistory()` - Get messages added since historyId

**Normalized Email Structure**:

```typescript
interface NormalizedEmail {
  id: string;
  threadId: string;
  historyId: string;
  from: string;
  to: string[];
  subject: string;
  date: Date;
  bodyPlain: string;
  bodyHtml: string;
  labels: string[];
  snippet: string;
  internalDate: number;
}
```

### 3. Logger with PII Masking (`utils/logger.ts`)

**Purpose**: Structured logging with automatic PII redaction.

**Features**:

- Pino-based structured logging
- Automatic PII masking (emails, card numbers, phone numbers)
- Sensitive field redaction (passwords, tokens)
- Pretty printing in development
- JSON logging in production

**Masked Patterns**:

- Email addresses → `[EMAIL]`
- Card numbers → `[CARD]`
- Phone numbers → `[PHONE]`
- Passwords/tokens → `[REDACTED]`

### 4. Enhanced Gmail Client

**Improvements**:

- Integrated with TokenManager for automatic token refresh
- Simplified initialization (no manual token handling)
- Improved error logging with PII masking
- Automatic OAuth token refresh on expiry

### 5. Database Schema Enhancements

**New Tables**:

- `email_processing_queue` - Queue for Pub/Sub messages
- `email_processing_dlq` - Dead letter queue for failed processing
- `manual_review_queue` - Low-confidence extractions requiring review
- `email_processing_metrics` - Observability metrics
- `fingerprint` column on `transactions` - For deduplication

### 6. Frontend Gmail Integration UI

**Component**: `GmailIntegrationCard.tsx`

**Features**:

- Connection status display
- Connect/Disconnect Gmail
- Watch expiration warnings
- Reauthorization flow
- Last sync timestamp
- Error handling and user feedback

**States**:

- Not connected - Shows connect button with explanation
- Connected - Shows email, status, watch expiration
- Watch expiring - Shows warning and reauthorize button
- Watch expired - Shows error and reauthorize button

## Configuration

### Environment Variables

Required in `.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key
# Or fallback to JWT_SECRET
JWT_SECRET=your_jwt_secret_32_chars_min

# Gmail Pub/Sub (for Week 6)
GMAIL_PUBSUB_TOPIC=projects/PROJECT_ID/topics/gmail-notifications
GMAIL_PUBSUB_SUBSCRIPTION=projects/PROJECT_ID/subscriptions/gmail-subscription

# Feature Flags
FEATURE_FLAG_EMAIL_INTEGRATION=true
GMAIL_MOCK_MODE=false # true for testing

# Service
GMAIL_SERVICE_PORT=3004
NODE_ENV=development
LOG_LEVEL=debug
```

## Testing

### Unit Tests

**Token Manager Tests** (`tests/token-manager.test.ts`):

- ✅ Encryption/decryption consistency
- ✅ Token storage with encryption
- ✅ Token retrieval and decryption
- ✅ Expiry detection (5-minute buffer)
- ✅ Auto-refresh on expired token
- ✅ Token revocation
- ✅ Error handling (no tokens, database errors)
- ✅ hasValidTokens check

**Coverage**: 100% for TokenManager

### Running Tests

```bash
cd backend/services/gmail-service
npm install
npm test
npm run test:coverage
```

### Test Configuration

- Jest with ts-jest
- Coverage threshold: 80% (branches, functions, lines, statements)
- Setup file: `tests/setup.ts` (environment variables, mocks)
- Test timeout: 10s

## API Endpoints

### Backend (Gmail Service)

#### `GET /health`

Health check endpoint.

**Response**:

```json
{
  "status": "ok",
  "service": "gmail-service",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `GET /auth-url`

Get Gmail OAuth authorization URL.

**Response**:

```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
}
```

#### `POST /connect`

Connect Gmail account.

**Request**:

```json
{
  "userId": "uuid",
  "authorizationCode": "4/0Axxxxx..."
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "connected": true,
    "email": "user@gmail.com",
    "watchExpiration": "2024-01-08T00:00:00.000Z",
    "historyId": "123456"
  }
}
```

#### `POST /disconnect`

Disconnect Gmail account.

**Request**:

```json
{
  "userId": "uuid"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "message": "Gmail disconnected successfully"
  }
}
```

### Frontend API (API Gateway)

These endpoints should be proxied through the API Gateway with authentication.

#### `GET /api/gmail/status`

Get current Gmail connection status for authenticated user.

**Headers**: `Authorization: Bearer {token}`

**Response**:

```json
{
  "connected": true,
  "email": "user@gmail.com",
  "watchExpiration": "2024-01-08T00:00:00.000Z",
  "historyId": "123456",
  "lastSync": "2024-01-01T12:00:00.000Z"
}
```

#### `GET /api/gmail/auth-url`

Get authorization URL (proxied from gmail-service).

#### `POST /api/gmail/connect`

Connect Gmail (proxied from gmail-service).

#### `POST /api/gmail/disconnect`

Disconnect Gmail (proxied from gmail-service).

## Security Considerations

### Token Security

1. **Encryption at Rest**:

   - Refresh tokens encrypted with AES-256-GCM
   - 16-byte random IV per encryption
   - Auth tag for integrity verification

2. **Access Tokens**:

   - Stored in plaintext (short-lived, 1 hour)
   - Auto-refresh 5 minutes before expiry

3. **Encryption Key**:
   - 32-byte minimum
   - Store in environment variable
   - Rotate periodically

### PII Protection

1. **Logging**:

   - Email addresses masked as `[EMAIL]`
   - Card numbers masked as `[CARD]`
   - Tokens always `[REDACTED]`

2. **Never Log**:
   - Refresh tokens
   - Access tokens
   - Email content (in production)
   - User passwords

### OAuth Scopes

**Required Scopes**:

- `https://www.googleapis.com/auth/gmail.readonly` - Read-only email access
- `openid` - User identification
- `email` - User email address
- `profile` - User profile info

**Principles**:

- Read-only access (no send/delete)
- Minimal scope necessary
- User can revoke anytime

## Migration

### Run Migration

```bash
cd backend/database
npm run migrate up
```

### Migration File

`002_phase2_email_integration.sql` adds:

- Gmail columns to `users` table
- `email_processing_queue` table
- `email_processing_dlq` table
- `manual_review_queue` table
- `email_processing_metrics` table
- `fingerprint` column to `transactions`
- Triggers for `updated_at` columns

## Next Steps (Week 6)

1. **Pub/Sub Listener Service**:

   - Set up local Pub/Sub emulator
   - Create listener service
   - Implement message queue with Redis
   - Handle visibility timeout and retries

2. **Email Processor Worker**:

   - Classify emails (transaction vs. other)
   - Extract transaction data
   - Write to database
   - Handle failures and DLQ

3. **Idempotency**:
   - Fingerprint-based deduplication
   - Handle duplicate notifications
   - Ensure exactly-once processing

## Troubleshooting

### Token Refresh Fails

**Symptom**: Errors like "Token refresh failed" or "Invalid grant"

**Solutions**:

1. User needs to reauthorize (refresh token may be revoked)
2. Check OAuth consent screen settings (must request offline access)
3. Verify `prompt: consent` in OAuth URL generation

### Encryption/Decryption Errors

**Symptom**: "Invalid encrypted token format" or "Decryption failed"

**Solutions**:

1. Verify `ENCRYPTION_KEY` is consistent (32 bytes minimum)
2. Check if encryption key changed (re-encrypt all tokens)
3. Validate encrypted format: `iv:authTag:encryptedData`

### Gmail API Rate Limits

**Limits**:

- 250 quota units per user per second
- 1 billion quota units per day

**Solutions**:

1. Implement exponential backoff
2. Batch requests where possible
3. Use caching for repeated lookups

### Watch Expiration

**Symptom**: No new emails processed after 7 days

**Solutions**:

1. Implement automatic watch renewal (background job)
2. Check watch expiration in database
3. Reauthorize if watch expired

## Monitoring

### Key Metrics

1. **Token Operations**:

   - `tokens_stored_total` - Total tokens stored
   - `tokens_refreshed_total` - Total refreshes
   - `tokens_refresh_errors_total` - Refresh failures

2. **Email Fetching**:

   - `emails_fetched_total` - Total emails fetched
   - `emails_fetch_errors_total` - Fetch failures
   - `email_fetch_duration_ms` - Fetch latency

3. **Gmail API**:
   - `gmail_api_calls_total` - Total API calls
   - `gmail_api_errors_total` - API errors
   - `gmail_api_quota_remaining` - Remaining quota

### Logging

**Log Levels**:

- `error` - Errors requiring attention
- `warn` - Warnings (e.g., token revocation failed but continued)
- `info` - Important operations (token stored, email fetched)
- `debug` - Detailed debugging (set `LOG_LEVEL=debug`)

**Structured Logs**:

```json
{
  "level": "info",
  "msg": "Gmail tokens stored successfully",
  "userId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## References

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
