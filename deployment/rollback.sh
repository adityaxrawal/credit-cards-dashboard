#!/bin/bash

# Rollback Script for Credit Card Management Dashboard
# Usage: ./rollback.sh [frontend|backend|database|all] [staging|production]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
SERVICE=${1:-all}
ENVIRONMENT=${2:-staging}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${RED}⚠️  ROLLBACK INITIATED${NC}"
echo -e "Service: ${YELLOW}${SERVICE}${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo ""

# Confirmation prompt
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${RED}⚠️  WARNING: You are about to rollback PRODUCTION${NC}"
    read -p "Are you sure? Type 'yes' to continue: " confirmation
    if [ "$confirmation" != "yes" ]; then
        echo "Rollback cancelled"
        exit 0
    fi
fi

# Set GCP project
if [ "$ENVIRONMENT" == "production" ]; then
    GCP_PROJECT="cc-dashboard-prod"
    REGION="us-central1"
else
    GCP_PROJECT="cc-dashboard-staging"
    REGION="us-central1"
fi

gcloud config set project $GCP_PROJECT

# Rollback Frontend
rollback_frontend() {
    echo -e "${YELLOW}🔄 Rolling back Frontend${NC}"
    
    cd "$PROJECT_ROOT/frontend"
    
    # Rollback Vercel deployment
    vercel rollback --yes
    
    echo -e "${GREEN}✅ Frontend rolled back${NC}"
}

# Rollback Backend
rollback_backend() {
    echo -e "${YELLOW}🔄 Rolling back Backend${NC}"
    
    # Get previous revision for API Gateway
    PREVIOUS_REVISION=$(gcloud run revisions list \
        --service=api-gateway-$ENVIRONMENT \
        --region=$REGION \
        --format="value(name)" \
        --limit=2 | tail -n 1)
    
    if [ -z "$PREVIOUS_REVISION" ]; then
        echo -e "${RED}❌ No previous revision found for API Gateway${NC}"
    else
        echo "Rolling back API Gateway to $PREVIOUS_REVISION..."
        gcloud run services update-traffic api-gateway-$ENVIRONMENT \
            --to-revisions=$PREVIOUS_REVISION=100 \
            --region=$REGION
        echo -e "${GREEN}✅ API Gateway rolled back${NC}"
    fi
    
    # Get previous revision for Gmail Service
    PREVIOUS_REVISION=$(gcloud run revisions list \
        --service=gmail-service-$ENVIRONMENT \
        --region=$REGION \
        --format="value(name)" \
        --limit=2 | tail -n 1)
    
    if [ -z "$PREVIOUS_REVISION" ]; then
        echo -e "${RED}❌ No previous revision found for Gmail Service${NC}"
    else
        echo "Rolling back Gmail Service to $PREVIOUS_REVISION..."
        gcloud run services update-traffic gmail-service-$ENVIRONMENT \
            --to-revisions=$PREVIOUS_REVISION=100 \
            --region=$REGION
        echo -e "${GREEN}✅ Gmail Service rolled back${NC}"
    fi
}

# Rollback Database
rollback_database() {
    echo -e "${YELLOW}🔄 Rolling back Database${NC}"
    echo -e "${RED}⚠️  WARNING: Database rollback requires manual intervention${NC}"
    echo ""
    echo "To rollback the database:"
    echo "1. Identify the backup to restore from /backups/"
    echo "2. Run: psql \$DATABASE_URL < backup_file.sql"
    echo "3. Or use Supabase dashboard to restore from point-in-time backup"
    echo ""
    echo -e "${YELLOW}Database rollback must be done manually${NC}"
}

# Execute rollback based on service
case $SERVICE in
    frontend)
        rollback_frontend
        ;;
    backend)
        rollback_backend
        ;;
    database)
        rollback_database
        ;;
    all)
        rollback_backend
        rollback_frontend
        echo -e "${YELLOW}Note: Database rollback must be done manually if needed${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid service: $SERVICE${NC}"
        echo "Usage: ./rollback.sh [frontend|backend|database|all] [staging|production]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Rollback Complete${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Verify services are running correctly"
echo "  2. Run verification script: ./verify-deployment.sh $ENVIRONMENT"
echo "  3. Monitor error rates and logs"
echo "  4. Investigate root cause of issues"
echo ""
