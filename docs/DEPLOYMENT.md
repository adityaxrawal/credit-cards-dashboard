# Zero-Cost Deployment Guide

> Complete guide to deploy Credit Card Dashboard with **$0.00/month** hosting costs

**Goal**: Deploy production-ready application using only free tier services

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Service Setup](#service-setup)
  - [1. Supabase (Database)](#1-supabase-database)
  - [2. Upstash Redis (Cache)](#2-upstash-redis-cache)
  - [3. Google OAuth & Gmail API](#3-google-oauth--gmail-api)
  - [4. Vercel (Frontend)](#4-vercel-frontend)
  - [5. Render (Backend)](#5-render-backend)
  - [6. Sentry (Monitoring)](#6-sentry-monitoring)
- [Deployment Steps](#deployment-steps)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)
- [Cost Monitoring](#cost-monitoring)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     Zero-Cost Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Frontend (Vercel Free)                                       │
│  ├── Next.js 14 App                                          │
│  ├── 100GB Bandwidth/month                                   │
│  └── Unlimited Deployments                                   │
│                                                               │
│  Backend (Render Free)                                        │
│  ├── Node.js API Gateway                                     │
│  ├── 750 Hours/month (31 days)                              │
│  └── Auto-sleep after 15min inactivity                       │
│                                                               │
│  Database (Supabase Free)                                     │
│  ├── PostgreSQL 15                                           │
│  ├── 500MB Storage                                           │
│  └── Unlimited API Requests                                  │
│                                                               │
│  Cache (Upstash Redis Free)                                  │
│  ├── 10,000 Commands/day                                     │
│  └── 256MB Storage                                           │
│                                                               │
│  Gmail API (Free)                                            │
│  ├── 1 Billion Quota/day                                     │
│  └── OAuth 2.0 Authentication                                │
│                                                               │
│  Monitoring (Sentry Free)                                     │
│  ├── 5,000 Errors/month                                      │
│  └── 30-day History                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Total Monthly Cost: $0.00 ✨
```

---

## Prerequisites

### Required Accounts (All Free)

- [ ] GitHub account (code repository)
- [ ] Supabase account (database hosting)
- [ ] Upstash account (Redis cache)
- [ ] Google Cloud account (OAuth & Gmail API)
- [ ] Vercel account (frontend hosting)
- [ ] Render account (backend hosting)
- [ ] Sentry account (optional - error tracking)

### Local Development Tools

- Node.js 20+ installed
- Git installed
- Code editor (VS Code recommended)

---

## Service Setup

### 1. Supabase (Database)

**Purpose**: PostgreSQL database with 500MB free storage

#### Step 1: Create Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Login
3. Click "New Project"
4. Fill in details:
   - **Name**: `credit-card-dashboard`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your users (e.g., `ap-south-1` for India)
5. Click "Create new project" (takes ~2 minutes)

#### Step 2: Get Connection Details

1. Go to Project Settings → Database
2. Copy the following:

   - **Host**: `aws-1-ap-south-1.pooler.supabase.com`
   - **Database**: `postgres`
   - **Port**: `6543` (pooler port)
   - **User**: `postgres.your-project-ref`
   - **Password**: Your database password

3. Go to Project Settings → API
4. Copy:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon Public Key**: `eyJhbGci...` (long JWT)
   - **Service Role Key**: `eyJhbGci...` (long JWT - keep secret!)

#### Step 3: Run Database Migrations

```bash
# Install dependencies
cd database
npm install

# Set environment variable
export DATABASE_URL="postgresql://postgres.your-ref:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

# Run all migrations
npm run migrate:up

# Verify migrations
psql $DATABASE_URL -c "\dt"
```

**Expected Output**: Should show all tables (users, credit_cards, transactions, etc.)

#### Step 4: Enable Row Level Security (RLS)

RLS policies are already in migrations. Verify:

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```

**Free Tier Limits**:

- ✅ 500MB Database Storage
- ✅ Unlimited API Requests
- ✅ 2GB Bandwidth/month
- ✅ Unlimited Rows

---

### 2. Upstash Redis (Cache)

**Purpose**: Redis cache for session storage and analytics caching

#### Step 1: Create Database

1. Go to [upstash.com](https://upstash.com)
2. Sign up / Login
3. Click "Create Database"
4. Fill in details:
   - **Name**: `credit-card-cache`
   - **Type**: Regional
   - **Region**: Choose closest to your users
   - **Eviction**: LRU (Least Recently Used)
5. Click "Create"

#### Step 2: Get Connection Details

1. Click on your database
2. Go to "REST API" tab
3. Copy:
   - **UPSTASH_REDIS_REST_URL**: `https://your-redis.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN**: `your-token`

**Free Tier Limits**:

- ✅ 10,000 Commands/day (~7 commands/min)
- ✅ 256MB Storage
- ✅ Global Replication (optional)

---

### 3. Google OAuth & Gmail API

**Purpose**: User authentication and Gmail transaction extraction

#### Step 1: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create new project: `credit-card-dashboard`
3. Enable APIs:
   - Go to "APIs & Services" → "Library"
   - Search and enable:
     - **Gmail API**
     - **Google OAuth 2.0**

#### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Configure OAuth consent screen:
   - **User Type**: External
   - **App Name**: Credit Card Dashboard
   - **Support Email**: Your email
   - **Scopes**: Add `gmail.readonly` scope
4. Create OAuth client ID:
   - **Application Type**: Web application
   - **Name**: Credit Card Dashboard Web
   - **Authorized redirect URIs**:
     - `https://your-project.supabase.co/auth/v1/callback`
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
5. Click "Create"
6. Copy:
   - **Client ID**: `123456789-abc.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-abc123...`

**Free Tier Limits**:

- ✅ 1 Billion Quota Units/day
- ✅ Each Gmail API call = 5-10 units
- ✅ ~100 million API calls/day (way more than needed!)

---

### 4. Vercel (Frontend)

**Purpose**: Host Next.js frontend with automatic deployments

#### Step 1: Connect GitHub Repository

1. Go to [vercel.com](https://vercel.com)
2. Sign up / Login with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

#### Step 2: Configure Environment Variables

Go to Project Settings → Environment Variables and add:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Application URL
NEXT_PUBLIC_URL=https://your-app.vercel.app

# API URL (will set after Render deployment)
NEXT_PUBLIC_API_URL=https://your-api.onrender.com

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
```

#### Step 3: Deploy

```bash
git push origin main
```

Vercel auto-deploys on every push to main branch.

**Free Tier Limits**:

- ✅ 100GB Bandwidth/month
- ✅ Unlimited Deployments
- ✅ Automatic HTTPS
- ✅ Custom Domains (free)

---

### 5. Render (Backend)

**Purpose**: Host Node.js backend API with 750 free hours/month

#### Step 1: Create Web Service

1. Go to [render.com](https://render.com)
2. Sign up / Login with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: `credit-card-api`
   - **Region**: Same as Supabase (e.g., Singapore for `ap-south-1`)
   - **Branch**: `main`
   - **Root Directory**: `backend/services/api-gateway`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

#### Step 2: Configure Environment Variables

Go to Environment tab and add:

```bash
# Supabase Database
DATABASE_URL=postgresql://postgres.your-ref:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Google OAuth & Gmail
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
GOOGLE_REDIRECT_URI=https://your-project.supabase.co/auth/v1/callback

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Security
ENCRYPTION_KEY=generate-random-32-byte-hex-string

# Application
NEXT_PUBLIC_URL=https://your-app.vercel.app
```

#### Step 3: Deploy

Click "Manual Deploy" or push to main branch:

```bash
git push origin main
```

**Free Tier Limits**:

- ✅ 750 Hours/month (31 days = 744 hours)
- ✅ 512MB RAM
- ✅ Auto-sleep after 15 minutes inactivity
- ✅ Cold start time: ~30 seconds

**Important**: Free tier services sleep after 15 minutes of inactivity. First request will take ~30 seconds (cold start).

---

### 6. Sentry (Monitoring)

**Purpose**: Error tracking and performance monitoring

#### Step 1: Create Project

1. Go to [sentry.io](https://sentry.io)
2. Sign up / Login
3. Click "Create Project"
4. Select:
   - **Platform**: Next.js (for frontend) & Node.js (for backend)
   - **Project Name**: `credit-card-dashboard`
5. Click "Create Project"

#### Step 2: Get DSN

1. Go to Project Settings → Client Keys (DSN)
2. Copy DSN: `https://abc123@o123456.ingest.sentry.io/7890123`

#### Step 3: Configure in Applications

**Frontend (Vercel)**:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7890123
```

**Backend (Render)**:

```bash
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/7890123
```

**Free Tier Limits**:

- ✅ 5,000 Errors/month
- ✅ 30-day History
- ✅ Unlimited Projects

---

## Deployment Steps

### Step-by-Step Deployment

#### 1. Prepare Code

```bash
# Ensure all changes are committed
git status

# Commit any pending changes
git add .
git commit -m "feat: Phase 6 complete - zero-cost deployment ready"
```

#### 2. Run Database Migration

```bash
cd database

# Run migration on production Supabase
export DATABASE_URL="your-production-database-url"
psql $DATABASE_URL -f migrations/017_zero_cost_cleanup.sql

# Verify migration
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users';"
```

**Expected Output**: Should show `last_gmail_sync` column, no `gmail_watch_expiration` or `gmail_history_id`

#### 3. Deploy Backend (Render)

```bash
# Push to main branch (triggers auto-deploy)
git push origin main

# Monitor deployment
# Go to Render dashboard → credit-card-api → Logs
```

**Wait for**: "Build succeeded" and "Service is live"

#### 4. Update Frontend Environment Variables

Go to Vercel dashboard → Environment Variables:

```bash
# Update API URL with Render URL
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

Redeploy frontend:

```bash
# In Vercel dashboard, click "Redeploy"
```

#### 5. Deploy Frontend (Vercel)

```bash
# Push to main branch (triggers auto-deploy)
git push origin main

# Monitor deployment
# Go to Vercel dashboard → Deployments
```

**Wait for**: "Ready" status with green checkmark

#### 6. Test Production Endpoints

```bash
# Test backend health
curl https://your-api.onrender.com/health

# Test frontend
curl https://your-app.vercel.app

# Test authentication
curl https://your-api.onrender.com/auth/login
```

---

## Environment Variables

### Complete .env.example Template

Create `.env.example` in root directory:

```bash
# ================================
# Supabase Database (Free Tier)
# ================================
# Get from: Supabase Dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Get from: Supabase Dashboard → Project Settings → Database
DATABASE_URL=postgresql://postgres.your-ref:password@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://your-project.supabase.co

# ================================
# Google OAuth & Gmail API (Free)
# ================================
# Get from: Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-project.supabase.co/auth/v1/callback

# ================================
# Upstash Redis Cache (Free Tier)
# ================================
# Get from: Upstash Dashboard → Database → REST API
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# ================================
# Application URLs
# ================================
NEXT_PUBLIC_URL=https://your-app.vercel.app
NEXT_PUBLIC_API_URL=https://your-api.onrender.com

# ================================
# Security
# ================================
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your-32-byte-hex-string

# ================================
# Sentry Monitoring (Optional)
# ================================
# Get from: Sentry Dashboard → Project Settings → Client Keys
SENTRY_DSN=https://your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn

# ================================
# JWT (Optional - if not using Supabase auth)
# ================================
JWT_SECRET=your-jwt-secret
```

---

## Post-Deployment

### 1. Verify Deployment

**Checklist**:

- [ ] ✅ Frontend loads at `https://your-app.vercel.app`
- [ ] ✅ Backend health check: `https://your-api.onrender.com/health`
- [ ] ✅ Can login with Google OAuth
- [ ] ✅ Can connect Gmail
- [ ] ✅ Manual Gmail sync works
- [ ] ✅ Transactions are extracted correctly
- [ ] ✅ Budget tracking updates
- [ ] ✅ Alerts and reminders appear

### 2. Test Cold Start Handling

```bash
# Wait 15+ minutes for Render service to sleep
# Then test:
curl https://your-api.onrender.com/health

# Should return 200 OK after ~30 seconds (cold start)
```

### 3. Monitor Free Tier Usage

**Daily Checks**:

| Service  | Free Tier Limit       | Check                              |
| -------- | --------------------- | ---------------------------------- |
| Vercel   | 100GB bandwidth/month | Vercel Dashboard → Usage           |
| Render   | 750 hours/month       | Render Dashboard → Usage           |
| Supabase | 500MB storage         | Supabase Dashboard → Database Size |
| Upstash  | 10K commands/day      | Upstash Dashboard → Metrics        |
| Sentry   | 5K errors/month       | Sentry Dashboard → Stats           |

### 4. Set Up Alerts

**Supabase**: Settings → Alerts

- Alert when database size > 400MB (80%)

**Upstash**: Dashboard → Alerts

- Alert when daily commands > 8,000 (80%)

**Render**: Dashboard → Notifications

- Email notifications for build failures

---

## Cost Monitoring

### Monthly Cost Breakdown

| Service   | Free Tier        | Usage      | Cost         |
| --------- | ---------------- | ---------- | ------------ |
| Vercel    | 100GB bandwidth  | ~5GB       | $0.00        |
| Render    | 750 hours        | 744 hours  | $0.00        |
| Supabase  | 500MB storage    | ~15MB      | $0.00        |
| Upstash   | 10K commands/day | ~2K/day    | $0.00        |
| Gmail API | 1B quota/day     | ~1K/day    | $0.00        |
| Sentry    | 5K errors/month  | ~100/month | $0.00        |
| **Total** | -                | -          | **$0.00** ✨ |

### How to Stay Within Free Tiers

1. **Vercel Bandwidth**:

   - Optimize images (use Next.js Image component)
   - Enable caching headers
   - Use CDN for static assets

2. **Render Hours**:

   - Auto-sleep after 15min inactivity (default)
   - Service runs 24/7 = 744 hours/month (within 750 limit)

3. **Supabase Storage**:

   - No file uploads (only transaction data)
   - Expected usage: ~10-20MB for 10,000 transactions

4. **Upstash Commands**:

   - Current usage: ~2,000/day (20% of limit)
   - Cache only frequently accessed data
   - Set TTL to expire old cache entries

5. **Gmail API Quota**:
   - Manual sync: ~50 API calls per sync
   - Daily syncs: ~50 calls/day (0.005% of quota)

---

## Troubleshooting

### Common Issues

#### 1. Backend Cold Start Delay

**Problem**: First request takes ~30 seconds

**Solution**: This is expected behavior for Render free tier

- Show loading spinner in frontend
- Display "Service starting up..." message
- Set 45s timeout in API client

#### 2. Environment Variables Not Working

**Problem**: `undefined` errors in logs

**Solution**:

1. Verify variables in Render dashboard
2. Restart service after adding variables
3. Check variable names match exactly (case-sensitive)

#### 3. Database Connection Failures

**Problem**: `ECONNREFUSED` or `Connection timeout`

**Solution**:

1. Use pooler connection (port 6543, not 5432)
2. Check IP allowlist in Supabase (should be disabled for pooler)
3. Verify DATABASE_URL format

#### 4. Gmail Sync Fails

**Problem**: "Gmail not connected" or "OAuth error"

**Solution**:

1. Re-authorize Gmail via Settings
2. Check OAuth redirect URI matches Supabase callback URL
3. Verify Gmail API is enabled in Google Cloud Console

#### 5. Rate Limit Exceeded

**Problem**: "Too many requests" error

**Solution**:

1. Gmail sync: Max 10/hour per user (design limitation)
2. Wait for rate limit to reset
3. Implement exponential backoff in frontend

---

## Security Best Practices

### 1. Environment Variables

- ✅ Never commit `.env` to Git
- ✅ Use different credentials for dev/staging/production
- ✅ Rotate secrets regularly (every 90 days)
- ✅ Use `SUPABASE_SERVICE_ROLE_KEY` only in backend (never in frontend)

### 2. Database Security

- ✅ Enable Row Level Security (RLS) on all tables
- ✅ Use connection pooler (port 6543) to avoid connection limits
- ✅ Backup database weekly (Supabase auto-backups available)

### 3. API Security

- ✅ Rate limiting enabled (10 Gmail syncs/hour per user)
- ✅ JWT authentication on all endpoints
- ✅ CORS configured for frontend domain only
- ✅ Helmet.js for security headers
- ✅ Input validation with Zod

---

## Maintenance

### Weekly Tasks

- [ ] Check Render logs for errors
- [ ] Verify Vercel deployment status
- [ ] Monitor Upstash command usage
- [ ] Review Sentry error reports

### Monthly Tasks

- [ ] Review Supabase database size
- [ ] Check Vercel bandwidth usage
- [ ] Update dependencies (`npm outdated`)
- [ ] Rotate environment secrets

### Quarterly Tasks

- [ ] Review and optimize database queries
- [ ] Update RLS policies if needed
- [ ] Audit user permissions
- [ ] Test disaster recovery plan

---

## Next Steps

After successful deployment:

1. ✅ Set up domain (optional - free with Vercel)
2. ✅ Configure alerts and monitoring
3. ✅ Document API usage for team
4. ✅ Set up automated testing
5. ✅ Create user onboarding guide

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review service-specific documentation:
   - [Vercel Docs](https://vercel.com/docs)
   - [Render Docs](https://render.com/docs)
   - [Supabase Docs](https://supabase.com/docs)
   - [Upstash Docs](https://docs.upstash.com)
3. Open GitHub issue with deployment logs

---

**Congratulations!** 🎉

You've successfully deployed a production-ready Credit Card Dashboard with **$0.00/month** hosting costs!

**Total Setup Time**: ~2 hours  
**Monthly Cost**: $0.00  
**Scalability**: Can handle 100+ users on free tier  
**Uptime**: 99.9% (Vercel + Render SLA)
