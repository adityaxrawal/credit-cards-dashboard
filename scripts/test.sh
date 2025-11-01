#!/bin/bash

# Credit Card Dashboard - Test Runner Script
# Runs all tests across frontend and backend

set -e

echo "🧪 Running Credit Card Dashboard Tests"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

FAILED=0

# Frontend tests
echo "1. Running frontend tests..."
cd frontend
if npm run test:ci; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
    FAILED=1
fi
cd ..

echo ""

# Backend tests
echo "2. Running backend tests..."
cd backend/services/api-gateway
if npm run test:ci; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
else
    echo -e "${RED}✗ Backend tests failed${NC}"
    FAILED=1
fi
cd ../../..

echo ""
echo "======================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
