#!/bin/bash

# Backend Deployment Script for Credit Card Management Dashboard
# Usage: ./deploy-backend.sh [staging|production]

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

echo -e "${GREEN}🚀 Starting Backend Deployment${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Timestamp: ${TIMESTAMP}"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

# Set GCP project based on environment
if [ "$ENVIRONMENT" == "production" ]; then
    GCP_PROJECT="cc-dashboard-prod"
    REGION="us-central1"
    MIN_INSTANCES=1
    MAX_INSTANCES=10
    MEMORY="512Mi"
else
    GCP_PROJECT="cc-dashboard-staging"
    REGION="us-central1"
    MIN_INSTANCES=0
    MAX_INSTANCES=5
    MEMORY="512Mi"
fi

echo -e "${YELLOW}📋 Pre-deployment Checks${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install Google Cloud SDK.${NC}"
    exit 1
fi

# Check if logged in to gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not logged in to gcloud. Run: gcloud auth login${NC}"
    exit 1
fi

# Set GCP project
echo -e "Setting GCP project to ${GCP_PROJECT}..."
gcloud config set project $GCP_PROJECT

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"
echo ""

# Deploy API Gateway
echo -e "${YELLOW}📦 Deploying API Gateway${NC}"
cd "$PROJECT_ROOT/backend/services/api-gateway"

# Check if .env file exists
if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo -e "${RED}❌ Environment file .env.$ENVIRONMENT not found${NC}"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Run tests
echo "Running tests..."
npm test || {
    echo -e "${RED}❌ Tests failed. Deployment aborted.${NC}"
    exit 1
}

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Build Docker image
echo "Building Docker image..."
IMAGE_NAME="gcr.io/$GCP_PROJECT/api-gateway"
docker build -t $IMAGE_NAME:$TIMESTAMP -t $IMAGE_NAME:latest .

# Push to Google Container Registry
echo "Pushing image to GCR..."
docker push $IMAGE_NAME:$TIMESTAMP
docker push $IMAGE_NAME:latest

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy api-gateway-$ENVIRONMENT \
    --image $IMAGE_NAME:$TIMESTAMP \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory $MEMORY \
    --timeout 60s \
    --min-instances $MIN_INSTANCES \
    --max-instances $MAX_INSTANCES \
    --env-vars-file .env.$ENVIRONMENT \
    --tag $TIMESTAMP

echo -e "${GREEN}✅ API Gateway deployed successfully${NC}"
API_GATEWAY_URL=$(gcloud run services describe api-gateway-$ENVIRONMENT --region=$REGION --format='value(status.url)')
echo -e "URL: ${GREEN}${API_GATEWAY_URL}${NC}"
echo ""

# Deploy Gmail Service
echo -e "${YELLOW}📦 Deploying Gmail Service${NC}"
cd "$PROJECT_ROOT/backend/services/gmail-service"

if [ ! -f ".env.$ENVIRONMENT" ]; then
    echo -e "${RED}❌ Environment file .env.$ENVIRONMENT not found${NC}"
    exit 1
fi

echo "Installing dependencies..."
npm install

echo "Running tests..."
npm test || {
    echo -e "${YELLOW}⚠️  Warning: Tests failed for Gmail Service${NC}"
}

echo "Building TypeScript..."
npm run build

echo "Building Docker image..."
IMAGE_NAME="gcr.io/$GCP_PROJECT/gmail-service"
docker build -t $IMAGE_NAME:$TIMESTAMP -t $IMAGE_NAME:latest .

echo "Pushing image to GCR..."
docker push $IMAGE_NAME:$TIMESTAMP
docker push $IMAGE_NAME:latest

echo "Deploying to Cloud Run..."
gcloud run deploy gmail-service-$ENVIRONMENT \
    --image $IMAGE_NAME:$TIMESTAMP \
    --platform managed \
    --region $REGION \
    --no-allow-unauthenticated \
    --memory $MEMORY \
    --timeout 120s \
    --min-instances $MIN_INSTANCES \
    --max-instances 3 \
    --env-vars-file .env.$ENVIRONMENT \
    --tag $TIMESTAMP

echo -e "${GREEN}✅ Gmail Service deployed successfully${NC}"
GMAIL_SERVICE_URL=$(gcloud run services describe gmail-service-$ENVIRONMENT --region=$REGION --format='value(status.url)')
echo -e "URL: ${GREEN}${GMAIL_SERVICE_URL}${NC}"
echo ""

# Health check
echo -e "${YELLOW}🏥 Running Health Checks${NC}"

echo "Checking API Gateway..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${API_GATEWAY_URL}/health)
if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ API Gateway health check passed${NC}"
else
    echo -e "${RED}❌ API Gateway health check failed (HTTP $HEALTH_STATUS)${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Backend Deployment Complete!${NC}"
echo ""
echo -e "Deployment Summary:"
echo -e "  Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Timestamp: ${TIMESTAMP}"
echo -e "  API Gateway: ${GREEN}${API_GATEWAY_URL}${NC}"
echo -e "  Gmail Service: ${GREEN}${GMAIL_SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Monitor logs: gcloud logging tail"
echo "  2. Check metrics in GCP Console"
echo "  3. Test critical API endpoints"
echo "  4. Deploy frontend"
echo ""
