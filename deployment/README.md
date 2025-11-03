# Deployment Scripts

This directory contains automated deployment scripts for the Credit Card Management Dashboard.

---

## 📁 Scripts Overview

### `deploy-backend.sh`

Automated backend deployment to Google Cloud Run.

**Usage:**

```bash
./deploy-backend.sh [staging|production]
```

### `deploy-frontend.sh`

Automated frontend deployment to Vercel.

**Usage:**

```bash
./deploy-frontend.sh [staging|production]
```

### `run-migrations.sh`

Database migration execution script.

**Usage:**

```bash
./run-migrations.sh [staging|production]
```

### `verify-deployment.sh`

Post-deployment verification script.

**Usage:**

```bash
./verify-deployment.sh [staging|production]
```

### `rollback.sh`

Automated rollback script.

**Usage:**

```bash
./rollback.sh [frontend|backend|all]
```

---

## 🚀 Quick Deploy

### Full Deployment (All Services)

```bash
# Deploy to staging
./deploy-all.sh staging

# Deploy to production
./deploy-all.sh production
```

### Individual Services

```bash
# Backend only
./deploy-backend.sh production

# Frontend only
./deploy-frontend.sh production
```

---

## 🔄 Pre-Deployment

Before running any deployment:

1. Ensure environment variables are configured
2. Run tests: `npm test`
3. Build locally: `npm run build`
4. Review checklist: `deployment-checklist.md`

---

## 📊 Post-Deployment

After deployment:

1. Run verification: `./verify-deployment.sh production`
2. Check monitoring dashboards
3. Monitor error rates
4. Test critical paths manually

---

## 🚨 Emergency Rollback

If issues occur:

```bash
# Rollback everything
./rollback.sh all

# Or rollback specific service
./rollback.sh frontend
./rollback.sh backend
```

---

## 📝 Documentation

- **Deployment Checklist:** `deployment-checklist.md`
- **Dry Run Report:** `dry-run-report.md`
- **Architecture:** `/docs/architecture.md`
