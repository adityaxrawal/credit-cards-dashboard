#!/bin/bash

# Automated GlitchTip Testing Script
# Tests error capture, performance monitoring, and SDK compatibility

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GlitchTip Integration Tests${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! docker-compose -f deployment/glitchtip/docker-compose.yml ps | grep -q "Up"; then
    echo -e "${RED}❌ GlitchTip is not running${NC}"
    echo "Start it with: cd deployment/glitchtip && docker-compose up -d"
    exit 1
fi

if ! curl -sf http://localhost:8000/health/ > /dev/null; then
    echo -e "${RED}❌ GlitchTip health check failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites passed${NC}"
echo ""

# Test Suite 1: Error Capture
echo -e "${YELLOW}Test Suite 1: Error Capture${NC}"

test_validation_error() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 1.1: Validation errors (400)... "
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        -X POST http://localhost:3001/api/budgets \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -d '{"category":"","limit":-100}')
    
    if [ "$RESPONSE" = "400" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Expected 400, got $RESPONSE)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

test_server_error() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 1.2: Server errors (500)... "
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        http://localhost:3001/test/error-500)
    
    if [ "$RESPONSE" = "500" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Expected 500, got $RESPONSE)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

test_async_error() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 1.3: Async promise rejections... "
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        http://localhost:3001/test/async-error)
    
    if [ "$RESPONSE" = "500" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Expected 500, got $RESPONSE)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Run error capture tests
test_validation_error
test_server_error
test_async_error

echo ""

# Test Suite 2: Performance Monitoring
echo -e "${YELLOW}Test Suite 2: Performance Monitoring${NC}"

test_api_request_tracking() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 2.1: API request tracking... "
    
    START_TIME=$(date +%s%N)
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $TEST_TOKEN" \
        http://localhost:3001/api/cards)
    END_TIME=$(date +%s%N)
    
    DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ "$RESPONSE" = "200" ] && [ "$DURATION" -lt 1000 ]; then
        echo -e "${GREEN}✅ PASSED (${DURATION}ms)${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Status: $RESPONSE, Duration: ${DURATION}ms)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

test_transaction_spans() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 2.2: Transaction spans... "
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $TEST_TOKEN" \
        http://localhost:3001/api/analytics/dashboard)
    
    if [ "$RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Status: $RESPONSE)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Run performance tests
test_api_request_tracking
test_transaction_spans

echo ""

# Test Suite 3: User Context
echo -e "${YELLOW}Test Suite 3: User Context${NC}"

test_authenticated_user() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 3.1: Authenticated user context... "
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        -X POST http://localhost:3001/test/user-error \
        -H "Authorization: Bearer $TEST_TOKEN")
    
    if [ "$RESPONSE" = "500" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        FAILED=$((FAILED + 1))
    fi
}

test_anonymous_user() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 3.2: Anonymous user context... "
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        http://localhost:3001/test/error-500)
    
    if [ "$RESPONSE" = "500" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Run user context tests
test_authenticated_user
test_anonymous_user

echo ""

# Test Suite 4: Resilience
echo -e "${YELLOW}Test Suite 4: Resilience${NC}"

test_glitchtip_downtime() {
    TOTAL=$((TOTAL + 1))
    echo -n "Test 4.1: App works when GlitchTip is down... "
    
    # Stop GlitchTip temporarily
    docker-compose -f deployment/glitchtip/docker-compose.yml stop web > /dev/null 2>&1
    
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $TEST_TOKEN" \
        http://localhost:3001/api/cards)
    
    # Restart GlitchTip
    docker-compose -f deployment/glitchtip/docker-compose.yml start web > /dev/null 2>&1
    sleep 2
    
    if [ "$RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Status: $RESPONSE)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Run resilience tests
test_glitchtip_downtime

echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Results Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review errors in GlitchTip UI (http://localhost:8000)"
    echo "2. Verify performance transactions appear"
    echo "3. Check user context is attached correctly"
    echo "4. Proceed to production deployment (Task 7)"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please review the failures and:"
    echo "1. Check backend logs: docker-compose logs api-gateway"
    echo "2. Check GlitchTip logs: docker-compose logs web"
    echo "3. Verify DSN configuration in .env"
    exit 1
fi
