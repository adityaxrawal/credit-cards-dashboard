#!/bin/bash

# GlitchTip Deployment Script for Google Cloud Run
# Phase 6: Post-Launch & Optimization

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GlitchTip Deployment to Google Cloud Run${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Load configuration if exists
if [ -f "deployment/glitchtip/glitchtip-config.env" ]; then
    echo -e "${YELLOW}Loading configuration from glitchtip-config.env...${NC}"
    source deployment/glitchtip/glitchtip-config.env
fi

# Check required variables
REQUIRED_VARS=("PROJECT_ID" "REGION" "DB_PASSWORD" "SECRET_KEY" "REDIS_URL" "GLITCHTIP_DOMAIN")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set${NC}"
        echo "Please create deployment/glitchtip/glitchtip-config.env with required variables"
        exit 1
    fi
done

# Set defaults
SERVICE_NAME="${SERVICE_NAME:-glitchtip}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-glitchtip-db}"
DB_NAME="${DB_NAME:-glitchtip}"
DB_USER="${DB_USER:-glitchtip}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Database Instance: $DB_INSTANCE_NAME"
echo ""

# Confirm deployment
read -p "Deploy GlitchTip to Google Cloud Run? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Step 1: Build Docker image
echo -e "${GREEN}Step 1: Building Docker image...${NC}"
cd deployment/glitchtip
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest .
cd ../..

# Step 2: Push to Google Container Registry
echo -e "${GREEN}Step 2: Pushing image to GCR...${NC}"
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Step 3: Get Cloud SQL connection name
echo -e "${GREEN}Step 3: Getting Cloud SQL connection name...${NC}"
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME \
    --project=$PROJECT_ID \
    --format='value(connectionName)')

if [ -z "$CONNECTION_NAME" ]; then
    echo -e "${RED}Error: Could not get Cloud SQL connection name${NC}"
    echo "Make sure the database instance exists: $DB_INSTANCE_NAME"
    exit 1
fi

echo "  Connection Name: $CONNECTION_NAME"

# Step 4: Deploy to Cloud Run
echo -e "${GREEN}Step 4: Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
    --platform managed \
    --region $REGION \
    --project $PROJECT_ID \
    --allow-unauthenticated \
    --min-instances 0 \
    --max-instances 5 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --set-env-vars="DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME" \
    --set-env-vars="REDIS_URL=$REDIS_URL" \
    --set-env-vars="SECRET_KEY=$SECRET_KEY" \
    --set-env-vars="GLITCHTIP_DOMAIN=$GLITCHTIP_DOMAIN" \
    --set-env-vars="ENVIRONMENT=production" \
    --set-env-vars="ENABLE_OPEN_USER_REGISTRATION=False" \
    --set-env-vars="DEFAULT_FROM_EMAIL=noreply@yourdomain.com" \
    --set-cloudsql-instances=$CONNECTION_NAME

# Step 5: Get service URL
echo -e "${GREEN}Step 5: Getting service URL...${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --project $PROJECT_ID \
    --format='value(status.url)')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "GlitchTip URL: ${GREEN}$SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Run database migrations: ./deployment/glitchtip/migrate.sh"
echo "2. Create superuser account: ./deployment/glitchtip/create-superuser.sh"
echo "3. Access GlitchTip at: $SERVICE_URL"
echo "4. Create a project and copy the DSN"
echo "5. Update GLITCHTIP_DSN in your application .env files"
echo ""
