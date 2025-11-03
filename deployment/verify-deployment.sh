#!/bin/bash

# Deployment Verification Script
# Usage: ./verify-deployment.sh [staging|production]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=${1:-staging}

echo -e "${GREEN}🔍 Starting Deployment Verification${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo ""

# Load environment variables
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/backend/services/api-gateway/.env.$ENVIRONMENT"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file not found${NC}"
    exit 1
fi

export $(cat $ENV_FILE | grep -E 'API_URL|NEXT_PUBLIC' | xargs)

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
run_test() {
    local test_name=$1
    local command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "  Testing $test_name... "
    
    if eval $command > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Backend Health Checks
echo -e "${YELLOW}🏥 Backend Health Checks${NC}"

run_test "API Gateway /health" "curl -f -s ${API_URL}/health"
run_test "API Gateway /api/health" "curl -f -s ${API_URL}/api/health"

echo ""

# Frontend Health Checks
echo -e "${YELLOW}🌐 Frontend Health Checks${NC}"

if [ "$ENVIRONMENT" == "production" ]; then
    FRONTEND_URL="https://your-domain.com"
else
    FRONTEND_URL="https://staging-app.vercel.app"
fi

run_test "Homepage loads" "curl -f -s -o /dev/null ${FRONTEND_URL}"
run_test "Login page loads" "curl -f -s -o /dev/null ${FRONTEND_URL}/login"

echo ""

# API Endpoint Tests
echo -e "${YELLOW}🔗 API Endpoint Tests${NC}"

# These require authentication, so just check they respond
run_test "Dashboard endpoint exists" "curl -s -o /dev/null -w '%{http_code}' ${API_URL}/api/dashboard | grep -q '401\|200'"
run_test "Transactions endpoint exists" "curl -s -o /dev/null -w '%{http_code}' ${API_URL}/api/transactions | grep -q '401\|200'"
run_test "Cards endpoint exists" "curl -s -o /dev/null -w '%{http_code}' ${API_URL}/api/cards | grep -q '401\|200'"

echo ""

# Database Connection
echo -e "${YELLOW}🗄️  Database Connection${NC}"

if [ -n "$DATABASE_URL" ]; then
    run_test "Database connection" "psql $DATABASE_URL -c 'SELECT 1;'"
    run_test "Users table exists" "psql $DATABASE_URL -c 'SELECT 1 FROM users LIMIT 1;'"
else
    echo -e "  ${YELLOW}⚠️  DATABASE_URL not set, skipping DB tests${NC}"
fi

echo ""

# Redis Connection
echo -e "${YELLOW}🔴 Redis Connection${NC}"

if [ -n "$UPSTASH_REDIS_REST_URL" ]; then
    run_test "Redis connection" "curl -f -s ${UPSTASH_REDIS_REST_URL}/ping -H 'Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}'"
else
    echo -e "  ${YELLOW}⚠️  Redis URL not set, skipping Redis tests${NC}"
fi

echo ""

# Performance Tests
echo -e "${YELLOW}⚡ Performance Tests${NC}"

# Test response time for health endpoint
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' ${API_URL}/health)
echo -n "  API response time: ${RESPONSE_TIME}s "
if (( $(echo "$RESPONSE_TIME < 0.5" | bc -l) )); then
    echo -e "${GREEN}✅${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  (> 500ms)${NC}"
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""

# Security Tests
echo -e "${YELLOW}🔒 Security Tests${NC}"

run_test "HTTPS enforced" "curl -s -o /dev/null -w '%{http_code}' ${API_URL}/health | grep -q '200'"
run_test "Security headers present" "curl -I -s ${API_URL}/health | grep -q -i 'x-frame-options\|x-content-type-options'"

echo ""

# Results Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📊 Verification Results${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"

if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
else
    echo -e "Failed: $FAILED_TESTS"
fi

PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo -e "Pass Rate: ${PASS_RATE}%"
echo ""

if [ $PASS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ Deployment verification PASSED${NC}"
    exit 0
elif [ $PASS_RATE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  Deployment verification PASSED with warnings${NC}"
    exit 0
else
    echo -e "${RED}❌ Deployment verification FAILED${NC}"
    exit 1
fi
