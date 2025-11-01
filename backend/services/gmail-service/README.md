# Gmail Service

Microservice for Gmail API integration with OAuth2 authentication, push notifications via Pub/Sub, and automatic watch renewal.

## Features

- **OAuth2 Authentication**: Secure Gmail account connection with refresh token storage
- **Push Notifications**: Real-time email notifications via Google Cloud Pub/Sub
- **Automatic Watch Renewal**: 7-day watches with automated 24-hour renewal window
- **Message Management**: List, fetch, and parse Gmail messages
- **History Tracking**: Incremental sync using Gmail History API

## Prerequisites

- Node.js 18+
- Redis (for job queue)
- Supabase account
- Google Cloud Project with Gmail API enabled
- Google Cloud Pub/Sub topic configured

## Google Cloud Setup

### 1. Create OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API: APIs & Services → Library → Gmail API → Enable
4. Create OAuth credentials: APIs & Services → Credentials → Create Credentials → OAuth client ID
5. Application type: Web application
6. Authorized redirect URIs: Add your callback URL (e.g., `http://localhost:3000/auth/gmail/callback`)
7. Copy Client ID and Client Secret

### 2. Setup Pub/Sub for Push Notifications

1. Go to Pub/Sub in Google Cloud Console
2. Create a topic: `gmail-notifications`
3. Grant Gmail API publish permission:
   ```bash
   gcloud pubsub topics add-iam-policy-binding gmail-notifications \
     --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
     --role=roles/pubsub.publisher
   ```
4. Create a subscription for your service
5. Copy the topic name (format: `projects/PROJECT_ID/topics/gmail-notifications`)

### 3. Configure Supabase

Add the following columns to your `users` table:

```sql
ALTER TABLE users 
ADD COLUMN gmail_refresh_token TEXT,
ADD COLUMN gmail_access_token TEXT,
ADD COLUMN gmail_token_expiry TIMESTAMP,
ADD COLUMN gmail_watch_expiration TIMESTAMP,
ADD COLUMN gmail_history_id VARCHAR(255);
```

## Installation

```bash
cd backend/services/gmail-service
npm install
```

## Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```env
# Server Configuration
GMAIL_SERVICE_PORT=3004
NODE_ENV=development

# Google OAuth2 Configuration
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback

# Gmail Push Notifications
GMAIL_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-notifications

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "gmail-service",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /auth-url
Get Gmail OAuth authorization URL.

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
}
```

### POST /connect
Connect Gmail account after OAuth.

**Request:**
```json
{
  "userId": "user-uuid",
  "authorizationCode": "4/0AX4XfWh..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "email": "user@gmail.com",
    "watchExpiration": "2024-01-08T00:00:00.000Z",
    "historyId": "1234567"
  }
}
```

### POST /disconnect
Disconnect Gmail account.

**Request:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Gmail disconnected successfully"
  }
}
```

### GET /status/:userId
Get Gmail connection status.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "email": "user@gmail.com",
    "watchActive": true,
    "watchExpiration": "2024-01-08T00:00:00.000Z",
    "historyId": "1234567",
    "needsRenewal": false
  }
}
```

### POST /renew-watch
Manually renew Gmail watch.

**Request:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "renewed": true,
    "watchActive": true,
    "watchExpiration": "2024-01-15T00:00:00.000Z",
    "message": "Watch renewed"
  }
}
```

### GET /messages/:userId
List Gmail messages with filters.

**Query Parameters:**
- `query` (string): Gmail search query (e.g., "from:bank@example.com")
- `maxResults` (number): Max results per page (1-500, default: 100)
- `pageToken` (string): Pagination token from previous response
- `after` (ISO date): Filter messages after this date
- `before` (ISO date): Filter messages before this date

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {"id": "msg123", "threadId": "thread123"}
    ],
    "nextPageToken": "token456",
    "resultSizeEstimate": 42
  }
}
```

### GET /messages/:userId/:messageId
Get full message details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg123",
    "threadId": "thread123",
    "labelIds": ["INBOX"],
    "snippet": "Your transaction of Rs. 1,234...",
    "internalDate": "1640995200000",
    "headers": {
      "from": "bank@example.com",
      "to": "user@gmail.com",
      "subject": "Transaction Alert",
      "date": "2024-01-01T12:00:00Z"
    },
    "body": {
      "text": "Full email text...",
      "html": "<html>Full email HTML...</html>"
    }
  }
}
```

### POST /process-notification
Process Pub/Sub notification (internal use).

**Request:**
```json
{
  "emailAddress": "user@gmail.com",
  "historyId": "7654321"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "messageIds": ["msg123", "msg456"],
    "newHistoryId": "7654321"
  }
}
```

## Architecture

### GmailClient
Core OAuth2 client for Gmail API operations:
- Token exchange and refresh
- User profile fetching
- Message listing and retrieval
- MIME body parsing
- Connection management

### GmailWatchManager
Manages Gmail push notifications:
- Setup 7-day watches on INBOX
- Automatic renewal 24 hours before expiration
- History API integration for incremental sync
- Batch renewal for all users (cron job)

## Deployment

### Docker

```bash
# Build image
docker build -t gmail-service .

# Run container
docker run -p 3004:3004 --env-file .env gmail-service
```

### Google Cloud Run

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/gmail-service

# Deploy to Cloud Run
gcloud run deploy gmail-service \
  --image gcr.io/PROJECT_ID/gmail-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Cron Jobs

### Watch Renewal
Setup a cron job to renew expiring watches:

```bash
# Every hour, check and renew watches expiring in 24 hours
0 * * * * curl -X POST http://localhost:3004/renew-all-watches
```

Or use Cloud Scheduler:
```bash
gcloud scheduler jobs create http renew-gmail-watches \
  --schedule="0 * * * *" \
  --uri="https://gmail-service-url/renew-all-watches" \
  --http-method=POST
```

## Error Handling

Common errors:
- **401 Unauthorized**: Invalid or expired OAuth tokens → Redirect user to reconnect
- **403 Forbidden**: Gmail API quota exceeded → Implement rate limiting
- **404 Not Found**: History ID too old → Trigger full sync
- **429 Too Many Requests**: Rate limit hit → Backoff and retry

## Security

- OAuth tokens stored encrypted in Supabase
- Service-to-service communication should use internal network
- Implement rate limiting on public endpoints
- Use HTTPS in production
- Rotate service account keys regularly

## Monitoring

Key metrics to track:
- Watch renewal success rate
- Token refresh failures
- API quota usage
- Message processing latency
- Error rates by endpoint

## License

MIT
