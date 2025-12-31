#!/bin/bash

# Financial Tracker - API Endpoint Verification Script
# This script tests all major API endpoints

set -e

BASE_URL="${BASE_URL:-http://localhost:3001/api}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo "========================================="
echo "Financial Tracker API Verification"
echo "========================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    local url="$BASE_URL$endpoint"
    local auth_header=""
    
    if [ -n "$AUTH_TOKEN" ]; then
        auth_header="-H \"Authorization: Bearer $AUTH_TOKEN\""
    fi
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
        -H "Content-Type: application/json" \
        ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} 2>/dev/null)
    
    if [ "$response" == "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} $method $endpoint - $description (${response})"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $method $endpoint - Expected $expected_status, got $response"
        ((FAILED++))
    fi
}

echo "Testing public endpoints..."
echo "-------------------------------------------"
test_endpoint "GET" "/monitoring/health" "200" "Health check"

echo ""
echo "Testing authentication..."
echo "-------------------------------------------"
# These will return 401 without valid token
test_endpoint "GET" "/dashboard/summary" "401" "Dashboard (requires auth)"
test_endpoint "GET" "/accounts" "401" "Accounts (requires auth)"
test_endpoint "GET" "/loans" "401" "Loans (requires auth)"
test_endpoint "GET" "/goals" "401" "Goals (requires auth)"

if [ -n "$AUTH_TOKEN" ]; then
    echo ""
    echo "Testing authenticated endpoints..."
    echo "-------------------------------------------"
    
    # Dashboard
    test_endpoint "GET" "/dashboard/summary" "200" "Dashboard summary"
    test_endpoint "GET" "/dashboard/alerts" "200" "Dashboard alerts"
    test_endpoint "GET" "/dashboard/cashflow" "200" "Dashboard cashflow"
    test_endpoint "GET" "/dashboard/recent" "200" "Recent transactions"
    
    # Accounts
    test_endpoint "GET" "/accounts" "200" "List accounts"
    test_endpoint "GET" "/accounts/summary" "200" "Account summary"
    
    # Loans
    test_endpoint "GET" "/loans" "200" "List loans"
    test_endpoint "GET" "/loans/summary" "200" "Loan summary"
    
    # Goals
    test_endpoint "GET" "/goals" "200" "List goals"
    test_endpoint "GET" "/goals/summary" "200" "Goal summary"
    
    # Transfers
    test_endpoint "GET" "/transfers/history" "200" "Transfer history"
    test_endpoint "GET" "/transfers/potential-matches" "200" "Potential matches"
    
    # Import
    test_endpoint "GET" "/import/templates" "200" "Import templates"
    test_endpoint "GET" "/import/history" "200" "Import history"
    
    # Shared Expenses
    test_endpoint "GET" "/shared-expenses" "200" "Shared expenses"
    test_endpoint "GET" "/shared-expenses/summary" "200" "Settlement summary"
    
    # Currency
    test_endpoint "GET" "/currency/supported" "200" "Supported currencies"
    test_endpoint "GET" "/currency/rates" "200" "Exchange rates"
    
    # Security
    test_endpoint "GET" "/security/lock/settings" "200" "Lock settings"
    test_endpoint "GET" "/security/audit" "200" "Audit log"
    test_endpoint "GET" "/security/activity" "200" "Activity log"
fi

echo ""
echo "========================================="
echo "Verification Results"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
    exit 1
fi
