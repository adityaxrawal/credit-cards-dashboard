# Backend Environment Variables - Complete Reference# Backend Environment Reference

> **Production-ready environment configuration for Credit Card Dashboard**This doc enumerates all required and optional environment variables for the backend (API Gateway + Shared services), their purpose, and default behavior.

## Quick Start## Required

````bash- SUPABASE_URL: Supabase project URL

# 1. Copy template- SUPABASE_SERVICE_ROLE_KEY: Service role key used by backend (never expose to frontend)

cp .env.example .env- ENCRYPTION_KEY: 32-byte key used to encrypt Gmail refresh tokens (AES-256)

- JWT_SECRET: JWT signing secret

# 2. Generate secrets- JWT_REFRESH_SECRET: JWT refresh token signing secret

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

## Recommended

# 3. Fill in your values

# 4. Never commit .env!- FRONTEND_URL: Allowed CORS origin (e.g. http://localhost:3000)

```- APP_VERSION: Version string for headers/metrics



---## Redis (choose one)



## Required Variables- UPSTASH_REDIS_REST_URL: Upstash REST URL (preferred for serverless)

- UPSTASH_REDIS_REST_TOKEN: Upstash REST token

### Database- USE_IOREDIS: "true" to force ioredis TCP client

- REDIS_URL: Redis connection string for ioredis

| Variable | Type | Description | Where to Find |

|----------|------|-------------|---------------|If none provided, a Mock Redis is used (good for local dev and tests).

| `SUPABASE_URL` | URL | Supabase project URL | Supabase Dashboard → Settings → API |

| `SUPABASE_SERVICE_ROLE_KEY` | string | Backend service key (⚠️ Secret!) | Supabase Dashboard → Settings → API → service_role |## Monitoring / Error Tracking



### Security- GLITCHTIP_DSN or SENTRY_DSN: Error tracking DSN

- GLITCHTIP_ENABLED or SENTRY_ENABLED: "true" to enable

| Variable | Type | Min Length | Description |

|----------|------|------------|-------------|## Rate Limiting

| `ENCRYPTION_KEY` | string | 32 chars | Encrypts Gmail tokens |

| `JWT_SECRET` | string | 32 chars | Signs access tokens |- RATE_LIMIT_WINDOW_MS: Global rate limit window (ms). Default 900000 (15m)

| `JWT_REFRESH_SECRET` | string | 32 chars | Signs refresh tokens |- RATE_LIMIT_MAX: Global max per window. Default 100

- RATE_LIMIT_GMAIL_MAX: Strict limiter for Gmail routes (default 10)

**Generate secure secrets:**- RATE_LIMIT_AUTH_MAX: Strict limiter for Auth routes (default 20)

```bash

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"## Logging

````

- LOG_LEVEL: winston level (error|warn|info|debug). Default info

### Redis (Choose One Option)- ENABLE_FILE_LOGGING: "true" to write logs/\* files locally

**Option A: Upstash (Production)**## Notes

- `UPSTASH_REDIS_REST_URL` - Upstash REST URL

- `UPSTASH_REDIS_REST_TOKEN` - Upstash REST token- Secrets should never be committed. Use .env.local and environment providers.

- Rotate secrets periodically. Steps:

**Option B: Local Redis (Development)** 1. Generate new value

- `USE_IOREDIS=true` 2. Update provider envs (Render, Vercel)

- `REDIS_URL=redis://localhost:6379` 3. Redeploy backend
  4. Invalidate old tokens/keys

---

See backend/.env.example for a template.

## Optional Variables

### Application

| Variable       | Default                 | Description                              |
| -------------- | ----------------------- | ---------------------------------------- |
| `NODE_ENV`     | `development`           | Environment: development/production/test |
| `PORT`         | `3001`                  | API server port                          |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin                      |
| `APP_VERSION`  | `1.0.0`                 | App version for logging                  |

### Google OAuth (Gmail Sync)

| Variable               | Required If   | Description            |
| ---------------------- | ------------- | ---------------------- |
| `GOOGLE_CLIENT_ID`     | Gmail enabled | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Gmail enabled | Google OAuth secret    |

Get from: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### Error Tracking

**Sentry:**

- `SENTRY_DSN` - Sentry project DSN
- `SENTRY_ENABLED=true` - Enable Sentry

**GlitchTip (Open Source):**

- `GLITCHTIP_DSN` - GlitchTip DSN
- `GLITCHTIP_ENABLED=true` - Enable GlitchTip

### Rate Limiting

| Variable               | Default  | Description                |
| ---------------------- | -------- | -------------------------- |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Window in ms (15 min)      |
| `RATE_LIMIT_MAX`       | `100`    | Global max requests/window |
| `RATE_LIMIT_AUTH_MAX`  | `5`      | Auth endpoints max         |
| `RATE_LIMIT_GMAIL_MAX` | `10`     | Gmail endpoints max        |

### Logging

| Variable              | Default | Description           |
| --------------------- | ------- | --------------------- |
| `LOG_LEVEL`           | `info`  | error/warn/info/debug |
| `ENABLE_FILE_LOGGING` | `false` | Write logs to ./logs/ |

---

## Environment Examples

### Development (.env)

```bash
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your-32-char-encryption-key
JWT_SECRET=your-32-char-jwt-secret
JWT_REFRESH_SECRET=your-32-char-refresh-secret

# Redis (local)
USE_IOREDIS=true
REDIS_URL=redis://localhost:6379

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Logging
LOG_LEVEL=debug
ENABLE_FILE_LOGGING=true
```

### Production (Render/Vercel Environment Variables)

```bash
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com

# Database
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Security - ROTATE EVERY 90 DAYS
ENCRYPTION_KEY=production-encryption-key-32-chars
JWT_SECRET=production-jwt-secret-32-chars
JWT_REFRESH_SECRET=production-refresh-secret-32-chars

# Redis (Upstash free tier)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Google OAuth
GOOGLE_CLIENT_ID=prod-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=prod-client-secret

# Error Tracking
SENTRY_ENABLED=true
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Rate Limiting (stricter in prod)
RATE_LIMIT_MAX=50
RATE_LIMIT_AUTH_MAX=3
RATE_LIMIT_GMAIL_MAX=5

# Logging
LOG_LEVEL=info
ENABLE_FILE_LOGGING=false
```

---

## Security Best Practices

### ✅ DO

- Use cryptographically random secrets (min 32 chars)
- Rotate secrets every 90 days
- Use different secrets per environment
- Store production secrets in platform environment managers (Render, Vercel)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend

### ❌ DON'T

- Commit `.env` to Git
- Share secrets via email/Slack
- Reuse secrets across environments
- Use weak or short secrets (<32 chars)

### Secret Rotation Schedule

| Secret                    | Frequency     | Action on Breach               |
| ------------------------- | ------------- | ------------------------------ |
| JWT Secrets               | 90 days       | Immediate - forces re-login    |
| ENCRYPTION_KEY            | 180 days      | Immediate - re-encrypt data    |
| SUPABASE_SERVICE_ROLE_KEY | On compromise | Immediate - rotate in Supabase |
| Google OAuth              | 180 days      | Immediate - rotate in GCP      |

---

## Validation

The app validates all env vars on startup using Zod schemas (`src/config/env.ts`).

**Validation Rules:**

- Required vars must be present
- URLs must be valid URLs
- Secrets must meet minimum length (32 chars)
- At least one Redis config must be provided

**Test validation:**

```bash
npm run dev  # Will show validation errors immediately
```

---

## Troubleshooting

### "Missing or invalid environment variables"

```bash
# Check .env exists
ls -la .env

# Verify required vars
grep SUPABASE_URL .env
grep JWT_SECRET .env

# Check .env.example for reference
cat .env.example
```

### "Redis connection failed"

```bash
# For Upstash: Check both are set
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# For local: Check Redis running
redis-cli ping  # Should return "PONG"
```

### "Database connection error"

```bash
# Test Supabase connection
curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     "$SUPABASE_URL/rest/v1/"

# Should return 200 OK
```

### "JWT validation failed"

- JWT_SECRET changed → All users must re-login
- Tokens expired → Normal behavior (1h for access, 7d for refresh)
- Check token format in request headers

---

## Platform-Specific Setup

### Render

1. Go to Environment tab
2. Add each variable manually
3. Enable "Auto-Deploy" from GitHub
4. Secrets are encrypted at rest

### Vercel

1. Project Settings → Environment Variables
2. Add for Production/Preview/Development
3. Secrets encrypted, never logged

### Docker

```dockerfile
# Don't bake secrets into image!
# Pass via docker run
docker run -e SUPABASE_URL=... -e JWT_SECRET=... your-image
```

---

## Quick Reference

**Minimum viable .env:**

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_KEY=... (32+ chars)
JWT_SECRET=... (32+ chars)
JWT_REFRESH_SECRET=... (32+ chars)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

**Development additions:**

```bash
USE_IOREDIS=true
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
ENABLE_FILE_LOGGING=true
```

**Production additions:**

```bash
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
SENTRY_ENABLED=true
SENTRY_DSN=...
```

---

**Last Updated:** November 2025  
**Version:** 1.0.0

For architecture details, see [updated-architecture.md](./updated-architecture.md)
