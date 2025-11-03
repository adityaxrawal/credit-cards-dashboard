#!/bin/bash

# Database Migration Script for Credit Card Management Dashboard
# Usage: ./run-migrations.sh [staging|production]

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

echo -e "${GREEN}🗄️  Starting Database Migration${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Timestamp: ${TIMESTAMP}"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo -e "${RED}❌ Error: Environment must be 'staging' or 'production'${NC}"
    exit 1
fi

# Load environment variables
ENV_FILE="$PROJECT_ROOT/backend/services/api-gateway/.env.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
    exit 1
fi

# Source environment file
export $(cat $ENV_FILE | grep DATABASE_URL | xargs)

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set in environment file${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-migration Checks${NC}"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Test database connection
echo "Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to database${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"
echo ""

# Create backup (production only)
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${YELLOW}💾 Creating database backup${NC}"
    BACKUP_DIR="$PROJECT_ROOT/backups"
    mkdir -p $BACKUP_DIR
    BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"
    
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    
    if [ -f "$BACKUP_FILE" ]; then
        echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
        
        # Compress backup
        gzip "$BACKUP_FILE"
        echo -e "${GREEN}✅ Backup compressed: ${BACKUP_FILE}.gz${NC}"
    else
        echo -e "${RED}❌ Backup failed${NC}"
        exit 1
    fi
    echo ""
fi

# Run migrations
echo -e "${YELLOW}🚀 Running Migrations${NC}"

cd "$PROJECT_ROOT/database"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check current migration status
echo "Current migration status:"
node scripts/migrate.js status || true
echo ""

# Run migrations
echo "Applying migrations..."
node scripts/migrate.js up

echo -e "${GREEN}✅ Migrations completed${NC}"
echo ""

# Verify tables exist
echo -e "${YELLOW}🔍 Verifying Database Schema${NC}"

TABLES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "Total tables: $TABLES"

if [ "$TABLES" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Warning: Expected at least 20 tables, found $TABLES${NC}"
fi

# Verify indexes
INDEXES=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")
echo "Total indexes: $INDEXES"

# Verify key tables
echo ""
echo "Verifying key tables..."

REQUIRED_TABLES=("users" "credit_cards" "transactions" "budgets" "alerts" "analytics_cache")

for table in "${REQUIRED_TABLES[@]}"; do
    if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name = '$table';" | grep -q 1; then
        echo -e "  ✅ $table"
    else
        echo -e "  ${RED}❌ $table (missing)${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Database Migration Complete!${NC}"
echo ""
echo -e "Migration Summary:"
echo -e "  Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "  Timestamp: ${TIMESTAMP}"
echo -e "  Tables: ${TABLES}"
echo -e "  Indexes: ${INDEXES}"

if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "  Backup: ${BACKUP_FILE}.gz"
fi

echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Verify data integrity"
echo "  2. Test application with new schema"
echo "  3. Monitor database performance"
echo ""
