# Phase 6 - Installation & Verification Guide

## 🎯 Quick Installation

Follow these steps to deploy Phase 6 features to production.

---

## Step 1: Install Dependencies

```bash
# Install monitoring module
cd monitoring
npm install

# Verify installation
npm list @sentry/node winston redis

# Expected output:
# @sentry/node@7.91.0
# winston@3.11.0
# redis@4.6.11
```

---

## Step 2: Configure Environment Variables

Add these to your `.env` or deployment configuration:

```env
# Sentry Configuration (Required for error tracking)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENABLED=true

# Logging Configuration
LOG_LEVEL=info
NODE_ENV=production

# Database Pool Configuration
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000

# Application Version
APP_VERSION=1.0.0
```

**Where to get Sentry DSN:**
1. Sign up at https://sentry.io
2. Create new project
3. Copy DSN from project settings
4. Paste into `SENTRY_DSN` variable

---

## Step 3: Run Database Migrations

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Run migrations in order
psql $DATABASE_URL -f database/migrations/014_analytics_tracking.sql
psql $DATABASE_URL -f database/migrations/015_feedback_system.sql
psql $DATABASE_URL -f database/migrations/016_performance_indexes.sql

# Verify migrations
psql $DATABASE_URL -c "\dt" | grep -E "(user_sessions|user_feedback|mv_monthly_spending)"

# Expected output should show:
# user_sessions
# user_feedback
# mv_monthly_spending
# ... and other new tables
```

---

## Step 4: Build and Deploy

```bash
# Build monitoring module
cd monitoring
npm run build

# Build backend with new features
cd ../backend/services/api-gateway
npm run build

# Build frontend with optimizations
cd ../../../frontend
npm run build

# Deploy using your method (Vercel, Cloud Run, etc.)
# Example for Vercel:
vercel --prod
```

---

## Step 5: Verify Deployment

### 5.1 Check Health Endpoint

```bash
# Test health endpoint (should return 200)
curl https://your-api-url/api/monitoring/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": 1699123456789,
#   "services": {
#     "database": { "status": "up", "latency": 45 },
#     "redis": { "status": "up", "latency": 12 },
#     "api": { "status": "up" }
#   },
#   "uptime": 123456,
#   "version": "1.0.0"
# }
```

### 5.2 Check Metrics Endpoint

```bash
# Get access token
TOKEN=$(curl -X POST https://your-api-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  | jq -r '.accessToken')

# Test metrics endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://your-api-url/api/monitoring/metrics

# Expected response:
# {
#   "success": true,
#   "data": {
#     "cache": {
#       "hits": 1234,
#       "misses": 234,
#       "total": 1468,
#       "hitRate": "84.06%"
#     },
#     "timestamp": 1699123456789
#   }
# }
```

### 5.3 Verify Health Dashboard

1. Navigate to: `https://your-app-url/admin/health`
2. Login with admin credentials
3. Verify you see:
   - Overall system status
   - Service health cards (database, Redis, API)
   - Cache performance metrics
   - System information

### 5.4 Test Feedback Widget

1. Navigate to any page in the app
2. Look for floating blue button in bottom-right corner
3. Click button to open feedback form
4. Submit test feedback
5. Check database:

```bash
psql $DATABASE_URL -c "SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT 1;"
```

### 5.5 Verify Sentry Integration

1. Trigger a test error (optional):

```bash
curl https://your-api-url/api/test-error
```

2. Check Sentry dashboard at https://sentry.io
3. Verify error appears with full context

---

## Step 6: Setup Scheduled Tasks

Add these cron jobs for maintenance:

```bash
# Edit crontab
crontab -e

# Add these lines:

# Refresh materialized views every hour
0 * * * * psql $DATABASE_URL -c "SELECT refresh_analytics_views();"

# Update table statistics daily at 2 AM
0 2 * * * psql $DATABASE_URL -c "SELECT update_table_statistics();"

# Cleanup old records weekly on Sunday at 3 AM
0 3 * * 0 psql $DATABASE_URL -c "SELECT cleanup_old_records();"
```

**For Cloud Functions (Alternative to Cron):**

Create scheduled Cloud Functions:

```yaml
# cloud-scheduler-config.yaml
- name: refresh-analytics
  schedule: "0 * * * *"
  url: https://your-api-url/api/admin/maintenance/refresh-views
  
- name: update-statistics
  schedule: "0 2 * * *"
  url: https://your-api-url/api/admin/maintenance/update-stats
  
- name: cleanup-records
  schedule: "0 3 * * 0"
  url: https://your-api-url/api/admin/maintenance/cleanup
```

---

## Step 7: Configure Monitoring Alerts

### Sentry Alerts

1. Go to Sentry project settings
2. Navigate to Alerts
3. Create alert rules:
   - **High Error Rate:** >10 errors in 5 minutes
   - **Slow Response:** p95 > 1 second
   - **Critical Error:** Any error with severity: critical

### Health Check Monitoring

Setup external monitoring (e.g., UptimeRobot, Pingdom):

```
Endpoint: https://your-api-url/api/monitoring/health
Interval: 5 minutes
Alert on: Non-200 response
```

---

## ✅ Verification Checklist

Run through this checklist to ensure everything is working:

### Backend Verification

- [ ] Health endpoint returns 200 OK
- [ ] Metrics endpoint returns cache stats
- [ ] Database has new tables (analytics, feedback)
- [ ] Materialized views exist and have data
- [ ] Sentry receives test errors
- [ ] Logs are being written to files
- [ ] Redis metrics are being collected

```bash
# Quick verification script
./scripts/verify-phase6.sh
```

### Frontend Verification

- [ ] Health dashboard loads at `/admin/health`
- [ ] System status shows "healthy"
- [ ] Service health cards display correctly
- [ ] Cache metrics show percentage
- [ ] Auto-refresh works (30s interval)
- [ ] Feedback widget appears on pages
- [ ] Feedback form submits successfully

### Performance Verification

- [ ] Bundle size reduced (check build output)
- [ ] API responses < 200ms (p95)
- [ ] Database queries < 50ms (check logs)
- [ ] Cache hit rate > 80%
- [ ] Page load time < 2s

```bash
# Performance test
npm run test:performance
```

### Database Verification

```sql
-- Check analytics tables
SELECT COUNT(*) FROM user_sessions;
SELECT COUNT(*) FROM page_views;
SELECT COUNT(*) FROM user_events;

-- Check feedback tables
SELECT COUNT(*) FROM user_feedback;
SELECT COUNT(*) FROM feature_requests;
SELECT COUNT(*) FROM nps_surveys;

-- Check indexes (should see many new indexes)
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Check materialized views
SELECT * FROM mv_monthly_spending LIMIT 5;
SELECT * FROM mv_merchant_spending LIMIT 5;
```

---

## 🔧 Troubleshooting

### Issue: Health endpoint returns 503

**Possible causes:**
- Database connection failed
- Redis connection failed
- Environment variables not set

**Fix:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Verify environment variables
env | grep -E "(DATABASE_URL|REDIS_URL|SENTRY)"
```

### Issue: Feedback widget not appearing

**Possible causes:**
- Component not imported in layout
- JavaScript error preventing render

**Fix:**
```typescript
// Check frontend/src/app/layout.tsx
import FeedbackWidget from '@/components/feedback/FeedbackWidget';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
```

### Issue: Slow queries after migration

**Possible causes:**
- Indexes not created
- Statistics not updated

**Fix:**
```sql
-- Verify indexes exist
\d+ transactions

-- Update statistics
ANALYZE transactions;
ANALYZE credit_cards;
ANALYZE alerts;

-- Refresh materialized views
SELECT refresh_analytics_views();
```

### Issue: High memory usage

**Possible causes:**
- Too many database connections
- Metrics buffer too large

**Fix:**
```env
# Reduce connection pool
DB_POOL_MAX=10
DB_POOL_MIN=2
```

---

## 📊 Monitoring Dashboard

After deployment, monitor these metrics:

### Daily Checks
- Error rate in Sentry
- API response times
- Cache hit rate
- Active user sessions

### Weekly Reviews
- User feedback summary
- Performance trends
- Database growth
- Feature request priorities

### Monthly Analysis
- NPS score trends
- Top error patterns
- Resource utilization
- Capacity planning

---

## 🎉 Success!

If all verification steps pass, Phase 6 is successfully deployed!

**What's working:**
✅ Real-time error tracking  
✅ Performance monitoring  
✅ User analytics  
✅ Feedback collection  
✅ Health monitoring  
✅ Optimized performance  

**Next steps:**
1. Monitor metrics for first week
2. Review initial user feedback
3. Fine-tune alert thresholds
4. Plan feature enhancements based on feedback

---

## 📞 Support

If you encounter issues:

1. Check logs: `/logs/error.log` and `/logs/combined.log`
2. Review Sentry errors: https://sentry.io
3. Check health dashboard: `/admin/health`
4. Run verification script: `./scripts/verify-phase6.sh`
5. Consult documentation: `PHASE_6_COMPLETION_REPORT.md`

---

**Installation Guide Version:** 1.0  
**Last Updated:** November 4, 2025  
**Phase Status:** ✅ PRODUCTION READY
