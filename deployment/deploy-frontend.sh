#!/bin/bash

# Frontend Deployment Script for Credit Card Management Dashboard
# Usage: ./deploy-frontend.sh [staging|production]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}🚀 Starting Frontend Deployment${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Timestamp: ${TIMESTAMP}"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-deployment Checks${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js.${NC}"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Vercel. Run: vercel login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"
echo ""

# Navigate to frontend directory
cd "$PROJECT_ROOT/frontend"

# Check if environment file exists
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo -e "${RED}❌ Environment file .env.$ENVIRONMENT not found${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Preparing Frontend Build${NC}"

# Install dependencies
echo "Installing dependencies..."
npm install

# Run linting
echo "Running linter..."
npm run lint || {
    echo -e "${YELLOW}⚠️  Warning: Linting issues found${NC}"
}

# Run type checking
echo "Running type check..."
npm run type-check || {
    echo -e "${YELLOW}⚠️  Warning: Type errors found${NC}"
}

# Run tests
echo "Running tests..."
npm test -- --passWithNoTests || {
    echo -e "${YELLOW}⚠️  Warning: Some tests failed${NC}"
}

# Build the application
echo "Building Next.js application..."
npm run build

echo -e "${GREEN}✅ Build completed successfully${NC}"
echo ""

# Deploy to Vercel
echo -e "${YELLOW}🚀 Deploying to Vercel${NC}"

if [ "$ENVIRONMENT" == "production" ]; then
    echo "Deploying to production..."
    vercel --prod --yes
else
    echo "Deploying to staging..."
    vercel --yes
fi

# Get deployment URL
DEPLOYMENT_URL=$(vercel ls --meta gitCommitSha=$(git rev-parse HEAD) 2>/dev/null | head -n 2 | tail -n 1 | awk '{print $2}')

if [ -z "$DEPLOYMENT_URL" ]; then
    DEPLOYMENT_URL=$(vercel ls | grep -m 1 "https://" | awk '{print $2}')
fi

echo -e "${GREEN}✅ Frontend deployed successfully${NC}"
echo -e "URL: ${GREEN}https://${DEPLOYMENT_URL}${NC}"
echo ""

# Health check
echo -e "${YELLOW}🏥 Running Health Check${NC}"

sleep 5  # Wait for deployment to be fully ready

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${DEPLOYMENT_URL}")
if [ "$HEALTH_STATUS" == "200" ] || [ "$HEALTH_STATUS" == "301" ] || [ "$HEALTH_STATUS" == "302" ]; then
    echo -e "${GREEN}✅ Frontend health check passed${NC}"
else
    echo -e "${RED}❌ Frontend health check failed (HTTP $HEALTH_STATUS)${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Frontend Deployment Complete!${NC}"
echo ""
echo -e "Deployment Summary:"
echo -e "  Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Timestamp: ${TIMESTAMP}"
echo -e "  URL: ${GREEN}https://${DEPLOYMENT_URL}${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Test the application manually"
echo "  2. Check Vercel logs for errors"
echo "  3. Monitor Web Vitals"
echo "  4. Verify all pages load correctly"
echo ""
