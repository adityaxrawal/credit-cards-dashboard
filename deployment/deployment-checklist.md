# Production Deployment Checklist

**Version:** 1.0.0  
**Target Launch Date:** November 13, 2025  
**Deployment Type:** First Production Release

---

## 🎯 Pre-Deployment Checklist

### 📋 Phase 1: Code & Tests (Complete Before Deployment)

#### Code Quality

- [x] All features implemented
- [x] Code reviewed
- [x] No critical bugs
- [x] TypeScript compilation successful
- [x] Linting passes
- [x] No console.log statements in production code

#### Testing

- [x] Unit tests passing (target: 90%)
- [x] Integration tests passing
- [ ] E2E tests passing
- [x] Load testing completed
- [x] Security audit completed
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Mobile responsiveness verified

#### Documentation

- [x] README.md updated
- [x] API documentation complete
- [x] User guide created
- [x] Architecture documentation current
- [x] Environment setup guide available

---

### 🔐 Phase 2: Security & Secrets

#### Environment Variables

- [ ] Production `.env` files created (NOT in git)
- [ ] All secrets rotated for production
- [ ] Encryption keys generated (32+ bytes)
- [ ] JWT secrets strong and unique
- [ ] Database credentials secured
- [ ] API keys configured

**Required Environment Variables:**

```bash
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/login

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=

# Encryption
ENCRYPTION_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Redis
REDIS_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# API
API_URL=https://your-api.run.app
NODE_ENV=production

# Frontend
NEXT_PUBLIC_API_URL=https://your-api.run.app
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# GCP
GCP_PROJECT_ID=
GCP_SERVICE_ACCOUNT_KEY_PATH=
```

#### Security Checklist

- [x] HTTPS enforced
- [x] CORS configured correctly
- [x] Helmet middleware enabled
- [ ] Rate limiting active
- [x] SQL injection protection
- [x] XSS protection
- [ ] CSRF tokens implemented
- [x] Secrets encrypted
- [x] Database credentials secure
- [ ] Security headers configured

---

### 🗄️ Phase 3: Database

#### Production Database Setup

- [ ] Supabase production project created
- [ ] Database migrations applied
- [ ] Performance indexes created
- [ ] Row Level Security (RLS) policies enabled
- [ ] Database backups configured
- [ ] Connection pooling configured

#### Run Migrations

```bash
cd database
export DATABASE_URL="production_database_url"
npm run migrate:up
```

#### Verify Database

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public';

-- Verify RLS
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

---

### ☁️ Phase 4: Infrastructure

#### Google Cloud Platform

- [ ] Production GCP project created
- [ ] Service accounts configured
- [ ] Pub/Sub topics created
- [ ] Pub/Sub subscriptions created
- [ ] Cloud Scheduler jobs configured
- [ ] Cloud Run services deployed
- [ ] IAM roles assigned
- [ ] Billing alerts set up

**GCP Setup Commands:**

```bash
# Create project
gcloud projects create cc-dashboard-prod

# Enable APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  gmail.googleapis.com

# Create Pub/Sub resources
gcloud pubsub topics create gmail-notifications
gcloud pubsub subscriptions create gmail-sub \
  --topic=gmail-notifications
```

#### Vercel (Frontend)

- [ ] Production project linked
- [ ] Environment variables configured
- [ ] Custom domain configured
- [ ] SSL certificate verified
- [ ] Build settings optimized
- [ ] Analytics enabled

**Vercel Setup:**

```bash
cd frontend
vercel --prod
vercel env pull .env.production
```

#### Cloud Run (Backend)

- [ ] API Gateway service deployed
- [ ] Gmail Service deployed
- [ ] Auto-scaling configured
- [ ] Health checks configured
- [ ] Logging configured
- [ ] Monitoring enabled

**Deploy to Cloud Run:**

```bash
cd backend/services/api-gateway
gcloud builds submit --tag gcr.io/PROJECT_ID/api-gateway
gcloud run deploy api-gateway \
  --image gcr.io/PROJECT_ID/api-gateway \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 60s \
  --min-instances 1 \
  --max-instances 10
```

#### Upstash Redis

- [ ] Production Redis instance created
- [ ] Connection configured
- [ ] Eviction policy set
- [ ] Monitoring enabled

---

### 📊 Phase 5: Monitoring & Logging

#### Error Tracking (Sentry)

- [ ] Sentry project created
- [ ] DSN configured in frontend
- [ ] DSN configured in backend
- [ ] Source maps uploaded
- [ ] Alert rules configured
- [ ] Team notifications set up

#### Logging

- [ ] Google Cloud Logging configured
- [ ] Log levels set correctly (info/warn/error)
- [ ] Sensitive data not logged
- [ ] Log retention policy set
- [ ] Log-based alerts configured

#### Performance Monitoring

- [ ] Google Analytics configured
- [ ] Web Vitals tracking enabled
- [ ] Custom events tracked
- [ ] Conversion funnels set up
- [ ] Performance budgets defined

#### Uptime Monitoring

- [ ] Uptime robot configured
- [ ] Health check endpoints monitored
- [ ] Alert notifications set up
- [ ] Status page created (optional)

**Services to Monitor:**

- Frontend (Vercel)
- API Gateway (Cloud Run)
- Gmail Service (Cloud Run)
- Database (Supabase)
- Redis (Upstash)

---

### 🧪 Phase 6: Testing in Production-like Environment

#### Staging Deployment

- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Test critical user journeys
- [ ] Verify external integrations (Gmail, Google OAuth)
- [ ] Load test staging
- [ ] Security scan staging

#### Critical Path Testing

- [ ] User registration
- [ ] Login/Logout
- [ ] Add credit card
- [ ] Add transaction
- [ ] Connect Gmail
- [ ] Set budget
- [ ] Generate report
- [ ] Export data

#### Performance Validation

- [ ] Page load time < 2s
- [ ] API response time < 200ms (p95)
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Redis cache working

---

### 📱 Phase 7: DNS & Domain

- [ ] Domain purchased/configured
- [ ] DNS records updated
- [ ] SSL certificates issued
- [ ] WWW redirect configured
- [ ] DNS propagation verified

**DNS Records:**

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com

Type: A
Name: @
Value: 76.76.21.21
```

---

### 🔄 Phase 8: CI/CD Pipeline

#### GitHub Actions

- [ ] Workflows configured
- [ ] Secrets added to GitHub
- [ ] Branch protection enabled
- [ ] Auto-deployment on main branch
- [ ] Test runs before deployment
- [ ] Rollback procedure documented

**Required GitHub Secrets:**

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `GCP_SA_KEY`
- `GCP_PROJECT_ID`
- `DATABASE_URL`
- All environment variables

---

### 📖 Phase 9: Documentation & Support

- [x] User guide published
- [x] API documentation available
- [x] FAQ created
- [ ] Support email configured
- [ ] Help desk ready (if applicable)
- [ ] Social media accounts created

---

### 🚀 Phase 10: Launch Day Preparation

#### Pre-Launch (1 Day Before)

- [ ] Final code freeze
- [ ] All tests passing
- [ ] Beta feedback addressed
- [ ] Staging fully tested
- [ ] Team briefing completed
- [ ] Support channels ready
- [ ] Monitoring dashboards open
- [ ] Rollback plan reviewed

#### Launch Day Checklist

- [ ] Deploy backend services
- [ ] Deploy frontend
- [ ] Verify health checks
- [ ] Test critical paths
- [ ] Monitor error rates
- [ ] Watch server metrics
- [ ] Monitor user signups
- [ ] Be ready for support requests

#### Post-Launch (First 24 Hours)

- [ ] Monitor continuously
- [ ] Respond to issues quickly
- [ ] Track user signups
- [ ] Gather initial feedback
- [ ] Fix critical bugs immediately
- [ ] Update status page

---

## 🚨 Rollback Plan

### When to Rollback

- Critical bugs affecting > 50% of users
- Security vulnerability discovered
- Data loss or corruption
- Complete service outage
- Payment processing issues

### Rollback Steps

#### Frontend Rollback (Vercel)

```bash
vercel rollback production
```

#### Backend Rollback (Cloud Run)

```bash
# List revisions
gcloud run revisions list --service=api-gateway

# Rollback to previous
gcloud run services update-traffic api-gateway \
  --to-revisions=PREVIOUS_REVISION=100
```

#### Database Rollback

```bash
# Restore from backup
# Use Supabase dashboard or:
psql $DATABASE_URL < backup.sql
```

---

## 📊 Success Metrics

### Day 1 Targets

- System uptime: 99%+
- Error rate: < 1%
- User signups: > 10
- No critical bugs
- Support response time: < 1 hour

### Week 1 Targets

- System uptime: 99.5%+
- Error rate: < 0.5%
- User signups: > 100
- Active users: > 50
- Support satisfaction: > 4/5

---

## 🛠️ Deployment Commands Reference

### Build & Deploy

**Frontend:**

```bash
cd frontend
npm run build
vercel --prod
```

**Backend API Gateway:**

```bash
cd backend/services/api-gateway
npm run build
gcloud builds submit --tag gcr.io/PROJECT_ID/api-gateway
gcloud run deploy api-gateway --image gcr.io/PROJECT_ID/api-gateway
```

**Database Migrations:**

```bash
cd database
npm run migrate:up
```

### Verification

**Check Frontend:**

```bash
curl https://your-domain.vercel.app/
```

**Check API Health:**

```bash
curl https://your-api.run.app/health
```

**Check Database:**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

---

## 📞 Emergency Contacts

### Team

- **Tech Lead:** [Name] - [Email] - [Phone]
- **DevOps:** [Name] - [Email] - [Phone]
- **On-Call:** [Name] - [Email] - [Phone]

### Services

- **Vercel Support:** support@vercel.com
- **Google Cloud:** https://cloud.google.com/support
- **Supabase Support:** support@supabase.com

---

## ✅ Final Sign-Off

Before going live, all stakeholders must approve:

- [ ] **Tech Lead:** Code quality approved
- [ ] **QA Lead:** All tests passing
- [ ] **Security Lead:** Security audit passed
- [ ] **Product Owner:** Features complete
- [ ] **DevOps:** Infrastructure ready

**Deployment Approved By:**

- Name: ******\_\_\_******
- Date: ******\_\_\_******
- Time: ******\_\_\_******

---

## 🎉 Post-Deployment

### Immediate (First Hour)

- [ ] Verify deployment successful
- [ ] Check all health endpoints
- [ ] Monitor error rates
- [ ] Test critical paths manually
- [ ] Post launch announcement

### First 24 Hours

- [ ] Monitor continuously
- [ ] Respond to issues
- [ ] Gather feedback
- [ ] Track metrics
- [ ] Plan hotfixes if needed

### First Week

- [ ] Review all metrics
- [ ] Analyze user behavior
- [ ] Prioritize feedback
- [ ] Plan iteration 1
- [ ] Update documentation

---

**Deployment Status:** ⏳ Checklist In Progress  
**Last Updated:** November 4, 2025  
**Next Review:** Before Launch
