# Monitoring System Migration Plan: Sentry → GlitchTip

**Date:** November 4, 2025  
**Phase:** 6 - Post-Launch & Optimization  
**Objective:** Migrate from paid Sentry cloud to self-hosted GlitchTip on Google Cloud

---

## Executive Summary

Migrate error tracking and monitoring from Sentry (paid SaaS) to **GlitchTip** (open-source, self-hosted) to:
- **Eliminate recurring costs** (Sentry paid plans start at $26/month)
- **Full data ownership** and control
- **Sentry SDK compatibility** (no major code changes needed)
- **Host on Google Cloud** (existing infrastructure)

### Why GlitchTip?

1. **✅ Sentry SDK Compatible** - Uses existing Sentry client SDKs (minimal code changes)
2. **✅ Open Source** - MIT licensed, full control
3. **✅ Simple Architecture** - Django backend + PostgreSQL (easier than Sentry self-hosted)
4. **✅ Docker-based** - Easy deployment to Google Cloud Run
5. **✅ Lower Resource Requirements** - vs Sentry's 4 CPU/16GB RAM minimum
6. **✅ Active Development** - Regular updates and community support

### Comparison: Sentry Self-Hosted vs GlitchTip

| Feature | Sentry Self-Hosted | GlitchTip |
|---------|-------------------|-----------|
| **Resources** | 4 CPU, 16GB RAM, 20GB disk | 2 CPU, 4GB RAM, 10GB disk |
| **Complexity** | High (Kafka, Clickhouse, Redis, etc.) | Low (Django, PostgreSQL, Redis) |
| **Setup Time** | 2-3 hours | 30-60 minutes |
| **SDK Compatibility** | Native | Sentry SDK compatible |
| **License** | FSL (Fair Source, limited commercial use) | MIT (fully open) |
| **Cloud Deployment** | Requires Kubernetes/VM | Cloud Run ready |

---

## Migration Architecture

### Current Architecture (Sentry Cloud)
```
┌─────────────────┐
│  API Gateway    │──┐
│  Analytics Svc  │  │
│  Feedback Svc   │  ├──► Sentry Cloud API
│  Monitoring     │  │    (sentry.io)
└─────────────────┘──┘
```

### Target Architecture (GlitchTip Self-Hosted)
```
┌─────────────────┐         ┌──────────────────┐
│  API Gateway    │──┐      │  GlitchTip       │
│  Analytics Svc  │  │      │  (Cloud Run)     │
│  Feedback Svc   │  ├──────►  - Django API    │
│  Monitoring     │  │      │  - PostgreSQL    │◄─── Google Cloud SQL
└─────────────────┘──┘      │  - Redis Cache   │◄─── Upstash Redis
                             └──────────────────┘
```

### Google Cloud Resources Required

1. **Cloud Run Service** - GlitchTip backend (containerized)
2. **Cloud SQL (PostgreSQL)** - Error data storage
3. **Upstash Redis** - Caching (existing, reuse)
4. **Cloud Storage** - File uploads/attachments (optional)
5. **Cloud Load Balancer** - SSL termination

**Estimated Monthly Cost:** $15-25 (vs $26+ for Sentry)

---

## Implementation Plan (8 Tasks)

### Task 1: Research & Setup GlitchTip Environment
**Duration:** 2 hours  
**Priority:** High

- [x] Research GlitchTip features and limitations
- [ ] Create Google Cloud project resources:
  - Cloud SQL PostgreSQL instance (db-f1-micro for testing)
  - Configure networking and firewall rules
- [ ] Set up local Docker development environment
- [ ] Test GlitchTip locally with docker-compose

**Deliverables:**
- Local GlitchTip instance running
- Google Cloud infrastructure provisioned

---

### Task 2: Deploy GlitchTip to Google Cloud Run
**Duration:** 3 hours  
**Priority:** High

**Steps:**
1. Create Dockerfile for GlitchTip
2. Build and push to Google Container Registry
3. Deploy to Cloud Run with:
   - Min instances: 0 (cost optimization)
   - Max instances: 5
   - Memory: 512MB-1GB
   - CPU: 1
4. Configure environment variables:
   - `DATABASE_URL` (Cloud SQL connection)
   - `REDIS_URL` (Upstash)
   - `SECRET_KEY`
   - `GLITCHTIP_DOMAIN`
5. Set up Cloud SQL Proxy for database connection
6. Configure custom domain and SSL

**Deliverables:**
- GlitchTip running on Cloud Run
- Public URL with SSL (e.g., `glitchtip.yourdomain.com`)
- Admin account created

---

### Task 3: Update Monitoring Module
**Duration:** 2 hours  
**Priority:** High

**Files to Modify:**
- `backend/shared/monitoring/sentry-config.ts` → `error-tracking-config.ts`
- `backend/shared/monitoring/logger.ts`
- `backend/shared/monitoring/index.ts`

**Changes:**
```typescript
// Instead of Sentry.io DSN
const dsn = process.env.SENTRY_DSN; // OLD

// Use self-hosted GlitchTip DSN
const dsn = process.env.GLITCHTIP_DSN; // NEW
// Example: https://abc123@glitchtip.yourdomain.com/1
```

**Key Points:**
- GlitchTip is **100% Sentry SDK compatible**
- Only DSN URL needs to change
- All Sentry SDK methods work as-is (`captureError`, `captureMessage`, etc.)

**Deliverables:**
- Renamed config file
- Updated DSN configuration
- Type definitions updated

---

### Task 4: Update Service Integrations
**Duration:** 1.5 hours  
**Priority:** Medium

**Files to Update:**
1. `backend/services/api-gateway/src/middleware/monitoring.middleware.ts`
2. `backend/services/analytics-service/src/analytics.service.ts`
3. `backend/services/api-gateway/src/services/feedback.service.ts`

**Changes:**
- Update import statements
- Verify error capture still works
- Test performance monitoring

**Deliverables:**
- All services using GlitchTip
- Imports updated
- No breaking changes

---

### Task 5: Update Configuration & Documentation
**Duration:** 1 hour  
**Priority:** Medium

**Files to Update:**
1. `.env.example` - Add GlitchTip variables
2. `PHASE_6_INSTALLATION_GUIDE.md` - Update setup instructions
3. `deployment/deploy-backend.sh` - Update environment variables
4. Create `docs/GLITCHTIP_DEPLOYMENT.md` - Deployment guide

**Environment Variables:**
```bash
# Remove
SENTRY_DSN=
SENTRY_ENABLED=

# Add
GLITCHTIP_DSN=https://abc123@glitchtip.yourdomain.com/1
GLITCHTIP_ENABLED=true
GLITCHTIP_ENVIRONMENT=production
```

**Deliverables:**
- Updated documentation
- Deployment scripts updated
- Configuration files updated

---

### Task 6: Database Migration & Data Sync
**Duration:** 1 hour  
**Priority:** Low

**Note:** Historical Sentry data cannot be migrated (proprietary format)

**Approach:**
- Start fresh with GlitchTip (recommended)
- Document any critical errors from Sentry before migration
- Keep Sentry account read-only for 30 days (grace period)

**Deliverables:**
- GlitchTip database initialized
- Migration strategy documented

---

### Task 7: Testing & Validation
**Duration:** 2 hours  
**Priority:** Critical

**Test Scenarios:**
1. **Error Capture:**
   - Trigger validation error → Verify in GlitchTip
   - Trigger 500 error → Verify stack trace
   - Trigger unhandled exception → Verify context data

2. **Performance Monitoring:**
   - Make API requests → Verify response times logged
   - Check transaction data → Verify spans captured

3. **User Context:**
   - Authenticated request error → Verify user data attached
   - Anonymous request error → Verify IP/user-agent captured

4. **Integrations:**
   - Test email notifications
   - Test alert webhooks

**Deliverables:**
- Test results documented
- All scenarios passing
- Performance benchmarks

---

### Task 8: Production Deployment
**Duration:** 2 hours  
**Priority:** Critical

**Deployment Steps:**
1. **Preparation:**
   - Backup current monitoring configuration
   - Document rollback procedure
   - Set up monitoring for GlitchTip itself

2. **Deployment:**
   - Deploy updated backend services to Cloud Run
   - Update environment variables in production
   - Verify health endpoints

3. **Monitoring:**
   - Monitor for 48 hours
   - Check error capture rate
   - Verify no gaps in monitoring

4. **Cleanup:**
   - Disable Sentry integration (keep account for 30 days)
   - Update team documentation
   - Train team on GlitchTip UI

**Rollback Plan:**
- Revert environment variables to Sentry DSN
- Redeploy previous service versions
- Time to rollback: ~5 minutes

**Deliverables:**
- Production deployment successful
- 48-hour monitoring report
- Team training completed

---

## Resource Requirements

### Development
- **Time:** 12-15 hours total
- **Skills:** Docker, Google Cloud, TypeScript, Python/Django (basic)

### Infrastructure Costs (Monthly)
- **Cloud Run:** ~$5-10 (pay-per-use)
- **Cloud SQL (db-f1-micro):** ~$7
- **Load Balancer:** ~$5
- **Storage:** ~$1
- **Total:** ~$15-25/month (vs $26+ Sentry)

### Maintenance
- **Weekly:** 15 minutes (check logs, uptime)
- **Monthly:** 1 hour (updates, optimization)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| GlitchTip downtime | Medium | Auto-scaling, health checks, alerts |
| Feature gaps vs Sentry | Low | GlitchTip has all essential features |
| Migration data loss | Low | Start fresh, document critical errors |
| Team unfamiliarity | Low | UI very similar to Sentry |
| Performance issues | Low | Load testing before production |

---

## Success Metrics

1. **Cost Savings:** >90% reduction (from $26/month → $15-25/month)
2. **Uptime:** >99.5% (matching Cloud Run SLA)
3. **Error Capture Rate:** 100% (no missed errors)
4. **Response Time:** <200ms for error ingestion
5. **Team Adoption:** 100% comfortable with UI in 1 week

---

## Timeline

| Week | Tasks | Status |
|------|-------|--------|
| Week 1 | Tasks 1-3: Setup, Deploy, Update Module | 🔄 In Progress |
| Week 2 | Tasks 4-6: Integrations, Config, Testing | ⏳ Planned |
| Week 3 | Tasks 7-8: Production Deploy, Monitor | ⏳ Planned |

**Total Duration:** 2-3 weeks (part-time)

---

## Next Steps

1. ✅ Create migration plan (this document)
2. 🔄 Provision Google Cloud resources
3. ⏳ Deploy GlitchTip to Cloud Run
4. ⏳ Update monitoring module
5. ⏳ Test in development
6. ⏳ Deploy to production
7. ⏳ Monitor and optimize

---

## Appendix

### Useful Links
- [GlitchTip Documentation](https://glitchtip.com/documentation)
- [GlitchTip GitLab](https://gitlab.com/glitchtip/glitchtip-backend)
- [Docker Deployment Guide](https://glitchtip.com/documentation/install#docker)
- [Sentry SDK Compatibility](https://docs.sentry.io/platforms/)

### Alternative Solutions Considered
1. **Sentry Self-Hosted:** Too complex (Kafka, Clickhouse, high resources)
2. **Rollbar:** Still paid SaaS
3. **Bugsnag:** Still paid SaaS
4. **Custom Solution:** Too much development time

**Decision:** GlitchTip - Best balance of features, simplicity, and cost
