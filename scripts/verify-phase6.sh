#!/bin/bash

# Phase 6 Verification Script
# Verifies all Phase 6 features are correctly deployed

set -e

echo "🚀 Phase 6 Verification Script"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

info() {
    echo -e "ℹ️  $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "1️⃣  Checking Prerequisites"
echo "------------------------"

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    pass "Node.js is installed ($NODE_VERSION)"
else
    fail "Node.js is not installed"
fi

# Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    pass "npm is installed ($NPM_VERSION)"
else
    fail "npm is not installed"
fi

# Check psql
if command_exists psql; then
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    pass "PostgreSQL client is installed ($PSQL_VERSION)"
else
    warn "PostgreSQL client not installed - skipping database checks"
fi

echo ""
echo "2️⃣  Checking Files and Directories"
echo "--------------------------------"

# Check monitoring module
if [ -d "monitoring" ]; then
    pass "Monitoring module directory exists"
    
    # Check key files
    for file in "sentry-config.ts" "logger.ts" "metrics-collector.ts" "health-check.ts"; do
        if [ -f "monitoring/$file" ]; then
            pass "monitoring/$file exists"
        else
            fail "monitoring/$file is missing"
        fi
    done
    
    # Check package.json
    if [ -f "monitoring/package.json" ]; then
        pass "monitoring/package.json exists"
    else
        fail "monitoring/package.json is missing"
    fi
else
    fail "Monitoring module directory not found"
fi

# Check database migrations
for migration in "014_analytics_tracking.sql" "015_feedback_system.sql" "016_performance_indexes.sql"; do
    if [ -f "database/migrations/$migration" ]; then
        pass "Migration $migration exists"
    else
        fail "Migration $migration is missing"
    fi
done

# Check backend services
if [ -f "backend/services/analytics-service/src/analytics.service.ts" ]; then
    pass "Analytics service exists"
else
    fail "Analytics service is missing"
fi

if [ -f "backend/services/api-gateway/src/services/feedback.service.ts" ]; then
    pass "Feedback service exists"
else
    fail "Feedback service is missing"
fi

# Check frontend components
if [ -f "frontend/src/app/(dashboard)/admin/health/page.tsx" ]; then
    pass "Health dashboard exists"
else
    fail "Health dashboard is missing"
fi

if [ -f "frontend/src/components/feedback/FeedbackWidget.tsx" ]; then
    pass "Feedback widget exists"
else
    fail "Feedback widget is missing"
fi

echo ""
echo "3️⃣  Checking Dependencies"
echo "----------------------"

# Check monitoring dependencies
if [ -f "monitoring/package.json" ]; then
    cd monitoring
    
    if [ -d "node_modules" ]; then
        # Check for key packages
        for package in "@sentry/node" "winston" "redis"; do
            if [ -d "node_modules/$package" ]; then
                pass "$package is installed"
            else
                fail "$package is not installed"
            fi
        done
    else
        warn "monitoring/node_modules not found - run 'npm install' in monitoring/"
    fi
    
    cd ..
fi

echo ""
echo "4️⃣  Checking Environment Variables"
echo "--------------------------------"

# Check if .env file exists
if [ -f ".env" ]; then
    pass ".env file exists"
    
    # Check required variables
    source .env 2>/dev/null || true
    
    if [ -n "$SENTRY_DSN" ]; then
        pass "SENTRY_DSN is set"
    else
        warn "SENTRY_DSN is not set - Sentry won't work"
    fi
    
    if [ -n "$DATABASE_URL" ]; then
        pass "DATABASE_URL is set"
    else
        fail "DATABASE_URL is not set"
    fi
    
    if [ -n "$REDIS_URL" ]; then
        pass "REDIS_URL is set"
    else
        warn "REDIS_URL is not set - Metrics collection may not work"
    fi
else
    warn ".env file not found"
fi

echo ""
echo "5️⃣  Checking Database (if accessible)"
echo "-----------------------------------"

if command_exists psql && [ -n "$DATABASE_URL" ]; then
    # Check if database is accessible
    if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        pass "Database is accessible"
        
        # Check for analytics tables
        TABLES=("user_sessions" "page_views" "user_events" "user_feedback" "feature_requests")
        for table in "${TABLES[@]}"; do
            if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table');" | grep -q "t"; then
                pass "Table $table exists"
            else
                warn "Table $table does not exist - run migrations"
            fi
        done
        
        # Check for materialized views
        MVS=("mv_monthly_spending" "mv_merchant_spending")
        for mv in "${MVS[@]}"; do
            if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM pg_matviews WHERE matviewname = '$mv');" | grep -q "t"; then
                pass "Materialized view $mv exists"
            else
                warn "Materialized view $mv does not exist - run migrations"
            fi
        done
        
    else
        warn "Cannot connect to database - skipping database checks"
    fi
else
    warn "Skipping database checks (psql not available or DATABASE_URL not set)"
fi

echo ""
echo "6️⃣  Checking Build Configuration"
echo "------------------------------"

# Check Next.js config
if [ -f "frontend/next.config.optimized.js" ]; then
    pass "Optimized Next.js config exists"
else
    warn "Optimized Next.js config not found"
fi

# Check if frontend builds
info "Testing frontend build..."
cd frontend
if npm run build >/dev/null 2>&1; then
    pass "Frontend builds successfully"
else
    fail "Frontend build failed"
fi
cd ..

echo ""
echo "7️⃣  Checking Documentation"
echo "-----------------------"

DOCS=("PHASE_6_COMPLETION_REPORT.md" "PHASE_6_IMPLEMENTATION_SUMMARY.md" "PHASE_6_INSTALLATION_GUIDE.md" "post-launch-issues-log.md")
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        pass "$doc exists"
    else
        warn "$doc is missing"
    fi
done

echo ""
echo "==============================="
echo "📊 Verification Results"
echo "==============================="
echo ""
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Phase 6 is correctly installed.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Deploy to production"
    echo "2. Run database migrations"
    echo "3. Set environment variables"
    echo "4. Setup scheduled tasks"
    echo "5. Monitor health dashboard"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review the failures above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Run 'npm install' in monitoring/"
    echo "2. Run database migrations"
    echo "3. Set environment variables in .env"
    echo "4. Install missing dependencies"
    exit 1
fi
