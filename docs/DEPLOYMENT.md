# Deployment Guide

## Overview

This guide covers deployment of the Credit Card Dashboard to production using zero-cost infrastructure:

- **Backend**: Render (Free Tier)
- **Frontend**: Vercel (Free Tier)
- **Database**: Supabase (Free Tier)
- **Cache**: Upstash Redis (Free Tier)
- **Monitoring**: Sentry (Free Tier)

## Prerequisites

- GitHub account
- Render account (https://render.com)
- Vercel account (https://vercel.com)
- Supabase account (https://supabase.com)
- Upstash account (https://upstash.com)
- Sentry account (https://sentry.io) - optional
- Google Cloud Console (for Gmail OAuth)

---

## 1. Database Setup (Supabase)

### Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in details:
   - **Name**: credit-card-dashboard
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to your users
   - **Plan**: Free

### Run Migrations

```bash
cd database
npm install

# Set environment variables
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Run all migrations
npm run migrate
```

### Configure Row Level Security (RLS)

All RLS policies are included in migrations. Verify they're enabled:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### Get Connection Details

From Supabase dashboard → Settings → Database:

- Copy **Connection String** (use transaction pooler for backend)
- Copy **Anon Key** (for frontend)
- Copy **Service Role Key** (for backend admin operations)

---

## 2. Cache Setup (Upstash Redis)

### Create Redis Database

1. Go to https://upstash.com and sign in
2. Click "Create Database"
3. Configuration:
   - **Name**: credit-card-cache
   - **Region**: Choose same as Supabase
   - **Type**: Regional (faster, free)

### Get REST API Credentials

From database dashboard:

- Copy **UPSTASH_REDIS_REST_URL**
- Copy **UPSTASH_REDIS_REST_TOKEN**

---

## 3. Google OAuth Setup

### Create OAuth Credentials

1. Go to https://console.cloud.google.com
2. Create a new project: "Credit Card Dashboard"
3. Enable Gmail API:
   - APIs & Services → Enable APIs and Services
   - Search "Gmail API" → Enable
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application Type: Web application
   - Name: Credit Card Dashboard
   - Authorized redirect URIs:
     - `https://your-backend.onrender.com/api/auth/google/callback`
     - `http://localhost:3001/api/auth/google/callback` (for local dev)

### Save Credentials

- Copy **Client ID**
- Copy **Client Secret**

---

## 4. Sentry Setup (Optional)

### Create Sentry Projects

1. Go to https://sentry.io and sign in
2. Create **Backend Project**:
   - Platform: Node.js
   - Name: credit-card-backend
   - Copy DSN
3. Create **Frontend Project**:
   - Platform: Next.js
   - Name: credit-card-frontend
   - Copy DSN

---

## 5. Backend Deployment (Render)

### Prepare Repository

Ensure your repository has:

- `backend/services/api-gateway/package.json`
- `backend/services/api-gateway/Dockerfile` or Render build command
- All migrations in `database/migrations/`

### Create Render Service

1. Go to https://render.com and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configuration:
   - **Name**: credit-card-api
   - **Region**: Choose closest to Supabase
   - **Branch**: prod
   - **Root Directory**: backend/services/api-gateway
   - **Runtime**: Node
   - **Build Command**: `cd ../shared && npm install && cd ../api-gateway && npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Environment Variables

Add in Render dashboard → Environment:

```bash
# Node Environment
NODE_ENV=production
PORT=3001

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://[REGION]-[ID].upstash.io
UPSTASH_REDIS_REST_TOKEN=AYN5ACQ...

# JWT Authentication
JWT_SECRET=<generate-random-string-64-chars>
JWT_REFRESH_SECRET=<generate-random-string-64-chars>
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
SESSION_EXPIRY_SECONDS=604800

# Gmail OAuth
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123
GOOGLE_REDIRECT_URI=https://your-backend.onrender.com/api/auth/google/callback
GMAIL_TOKEN_ENCRYPTION_KEY=<generate-32-char-hex-string>
GMAIL_TOKEN_ENCRYPTION_TTL_DAYS=3650

# Sentry (Optional)
SENTRY_DSN_BACKEND=https://[KEY]@sentry.io/[PROJECT]
SENTRY_TRACES_SAMPLE_RATE=0.1

# CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# Admin Emails
ADMIN_EMAILS=your-email@example.com

# Feature Flags
ENABLE_ANALYTICS_TRACKING=true
ENABLE_FEEDBACK_SYSTEM=true
ENABLE_GMAIL_SYNC=true

# Logging
LOG_LEVEL=info
```

### Deploy

Click "Create Web Service" → Render will build and deploy automatically.

### Verify Deployment

Check health endpoint:

```bash
curl https://your-backend.onrender.com/api/admin/health
```

Expected response:

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 6. Frontend Deployment (Vercel)

### Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### Connect Repository

1. Go to https://vercel.com and sign in
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configuration:
   - **Framework Preset**: Next.js
   - **Root Directory**: frontend
   - **Build Command**: `npm run build`
   - **Output Directory**: .next
   - **Install Command**: `npm install`

### Environment Variables

Add in Vercel dashboard → Settings → Environment Variables:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com

# Sentry (Optional)
NEXT_PUBLIC_SENTRY_DSN=https://[KEY]@sentry.io/[PROJECT]
NEXT_PUBLIC_ENVIRONMENT=production

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_FEEDBACK=true
```

### Deploy

Click "Deploy" → Vercel will build and deploy automatically.

### Verify Deployment

Open your Vercel URL (e.g., `https://your-project.vercel.app`) in a browser.

---

## 7. Database Migrations

### Run Production Migrations

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

cd database
npm run migrate
```

### Verify Migrations

```bash
npm run migrate:status
```

---

## 8. CI/CD Setup (GitHub Actions)

### Add Repository Secrets

Go to GitHub → Repository → Settings → Secrets and variables → Actions

Add the following secrets:

```
RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-...
BACKEND_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
VERCEL_TOKEN=<from vercel.com/account/tokens>
VERCEL_ORG_ID=<from vercel project settings>
VERCEL_PROJECT_ID=<from vercel project settings>
```

### Trigger First Deployment

Push to `prod` branch:

```bash
git checkout -b prod
git push origin prod
```

GitHub Actions will:

1. Run backend tests (with coverage check ≥80%)
2. Run frontend tests (with coverage check ≥70%)
3. Validate database migrations
4. Run security audit
5. Deploy backend to Render
6. Deploy frontend to Vercel
7. Run E2E tests
8. Send notification

---

## 9. Post-Deployment Configuration

### Update OAuth Redirect URI

In Google Cloud Console → Credentials:

- Update redirect URI to production URL
- Test OAuth flow: `https://your-frontend.vercel.app/settings`

### Configure Custom Domain (Optional)

**Vercel:**

1. Project Settings → Domains
2. Add custom domain (e.g., `app.example.com`)
3. Follow DNS configuration instructions

**Render:**

1. Service → Settings → Custom Domains
2. Add custom domain (e.g., `api.example.com`)
3. Follow DNS configuration instructions

### Test Production Deployment

```bash
# Backend health check
curl https://your-backend.onrender.com/api/admin/health

# Frontend health check
curl https://your-frontend.vercel.app

# Test authentication
curl -X POST https://your-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

---

## 10. Monitoring & Maintenance

### Sentry Monitoring

View errors and performance:

- Backend: https://sentry.io/organizations/[ORG]/issues/?project=[BACKEND_PROJECT]
- Frontend: https://sentry.io/organizations/[ORG]/issues/?project=[FRONTEND_PROJECT]

### Admin Health Dashboard

Access system metrics:

```
https://your-frontend.vercel.app/admin/health
```

Shows:

- System uptime
- Cache hit rate
- Database latency
- Memory usage
- API statistics

### Render Dashboard

Monitor:

- Deployment logs
- Service health
- Resource usage
- Request metrics

### Vercel Analytics

Monitor:

- Build logs
- Function invocations
- Bandwidth usage
- Edge network performance

---

## 11. Scaling & Optimization

### Backend Optimization

1. **Enable Redis Caching**:

   - Cache frequently accessed data (user cards, recent transactions)
   - Set appropriate TTL values (5-15 minutes)

2. **Database Connection Pooling**:

   - Use Supabase transaction pooler in DATABASE_URL
   - Configure max connections in connection string

3. **Rate Limiting**:
   - Already configured in backend (100 requests/minute)
   - Adjust `RATE_LIMIT_MAX_REQUESTS` if needed

### Frontend Optimization

1. **Image Optimization**:

   - Use Next.js Image component
   - Enable Vercel Image Optimization

2. **Code Splitting**:

   - Already enabled with Next.js dynamic imports
   - Lazy load components when possible

3. **CDN Caching**:
   - Configured automatically by Vercel
   - Static assets cached at edge

---

## 12. Backup & Recovery

### Database Backups

Supabase automatically backs up daily. To create manual backup:

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
psql $DATABASE_URL < backup-20240101.sql
```

### Configuration Backups

Store all environment variables securely:

- Use password manager (1Password, LastPass)
- Keep encrypted copy in repository (`.env.vault`)

---

## 13. Troubleshooting

### Backend Not Responding

1. Check Render logs: Service → Logs
2. Verify environment variables set correctly
3. Check database connectivity:
   ```bash
   curl https://your-backend.onrender.com/api/admin/health
   ```

### Database Connection Errors

1. Verify DATABASE_URL format
2. Check Supabase project is not paused (free tier pauses after inactivity)
3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

### Redis Connection Errors

1. Verify Upstash credentials
2. Check database is not paused
3. Test connection:
   ```bash
   curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
     "$UPSTASH_REDIS_REST_URL/GET/test"
   ```

### Frontend Build Failures

1. Check Vercel build logs
2. Verify environment variables set
3. Test local build:
   ```bash
   cd frontend
   npm run build
   ```

---

## 14. Cost Monitoring

### Free Tier Limits

Monitor usage to stay within free tiers:

| Service  | Limit                     | Current                | Status  |
| -------- | ------------------------- | ---------------------- | ------- |
| Render   | 750 hours/month           | Auto-sleep after 15min | ✅ Free |
| Vercel   | 100GB bandwidth           | ~5GB typical           | ✅ Free |
| Supabase | 500MB DB, 2GB transfer    | ~100MB typical         | ✅ Free |
| Upstash  | 10K commands/day          | ~2K typical            | ✅ Free |
| Sentry   | 5K errors, 10K perf units | With sampling          | ✅ Free |

**Total Monthly Cost: $0**

---

## 15. Support & Resources

### Documentation

- **Architecture**: `docs/architecture.md`
- **API Reference**: `docs/API.md`
- **Sentry Integration**: `docs/SENTRY_INTEGRATION.md`
- **Phase Completion**: `PHASE_4_COMPLETION.md`

### Support Channels

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@example.com

### Related Links

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Upstash Documentation](https://docs.upstash.com)
- [Sentry Documentation](https://docs.sentry.io)

---

## Quick Reference Commands

```bash
# Deploy to production
git push origin prod

# View backend logs
# (Go to Render dashboard → Logs)

# View frontend logs
vercel logs

# Run migrations
cd database && npm run migrate

# Check deployment health
curl https://your-backend.onrender.com/api/admin/health
curl https://your-frontend.vercel.app

# Generate encryption key (32-char hex)
openssl rand -hex 32

# Generate JWT secret (64 chars)
openssl rand -base64 64 | tr -d '\n'
```

---

**Last Updated**: November 2024  
**Version**: 1.0.0  
**Maintained By**: Credit Card Dashboard Team
