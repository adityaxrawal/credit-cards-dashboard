#!/bin/bash

# ================================
# Database Migration Script
# Migration: 017_zero_cost_cleanup.sql
# ================================

set -e  # Exit on error

echo "========================================="
echo "Database Migration: Zero-Cost Cleanup"
echo "Migration: 017_zero_cost_cleanup.sql"
echo "Date: $(date)"
echo "========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env"
    exit 1
fi

echo "📋 Pre-Migration Checklist:"
echo "1. Backup database (recommended)"
echo "2. Test migration on local database first"
echo "3. Verify no active users during migration"
echo ""

# Ask for confirmation
read -p "Have you completed the pre-migration checklist? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled. Complete checklist first."
    exit 0
fi

echo ""
echo "========================================="
echo "Step 1: Backup Current Database Schema"
echo "========================================="
echo ""

# Create backups directory
mkdir -p database/backups

# Backup users table schema
echo "📦 Backing up users table schema..."
psql "$DATABASE_URL" -c "\d users" > "database/backups/users_schema_backup_$(date +%Y%m%d_%H%M%S).sql"

# Backup uploaded_statements table if exists
echo "📦 Checking for uploaded_statements table..."
psql "$DATABASE_URL" -c "\d uploaded_statements" > "database/backups/uploaded_statements_schema_backup_$(date +%Y%m%d_%H%M%S).sql" 2>/dev/null || echo "✓ No uploaded_statements table found (expected)"

echo "✅ Backup completed"
echo ""

echo "========================================="
echo "Step 2: Verify Migration File"
echo "========================================="
echo ""

if [ ! -f "database/migrations/017_zero_cost_cleanup.sql" ]; then
    echo "❌ Error: Migration file not found"
    exit 1
fi

echo "✅ Migration file found"
echo ""

echo "========================================="
echo "Step 3: Execute Migration"
echo "========================================="
echo ""

echo "🔄 Running migration..."
psql "$DATABASE_URL" -f "database/migrations/017_zero_cost_cleanup.sql"

if [ $? -eq 0 ]; then
    echo "✅ Migration executed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""

echo "========================================="
echo "Step 4: Verify Migration Changes"
echo "========================================="
echo ""

echo "🔍 Verifying schema changes..."

# Check for last_gmail_sync column
echo "Checking for last_gmail_sync column..."
psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_gmail_sync';"

# Check gmail_watch_expiration is removed
echo "Verifying gmail_watch_expiration is removed..."
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gmail_watch_expiration';" | grep -q "0 rows" && echo "✅ gmail_watch_expiration removed" || echo "⚠️ gmail_watch_expiration still exists"

# Check gmail_history_id is removed
echo "Verifying gmail_history_id is removed..."
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'gmail_history_id';" | grep -q "0 rows" && echo "✅ gmail_history_id removed" || echo "⚠️ gmail_history_id still exists"

# Check index exists
echo "Verifying index idx_users_last_gmail_sync exists..."
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_last_gmail_sync';"

# Check uploaded_statements table is dropped
echo "Verifying uploaded_statements table is dropped..."
psql "$DATABASE_URL" -c "\dt uploaded_statements" 2>&1 | grep -q "Did not find" && echo "✅ uploaded_statements table dropped" || echo "⚠️ uploaded_statements table still exists"

echo ""
echo "========================================="
echo "Step 5: Test Queries"
echo "========================================="
echo ""

echo "🧪 Testing query performance..."

# Test query on new index
echo "Testing last_gmail_sync query..."
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT id, email, last_gmail_sync FROM users WHERE last_gmail_sync IS NOT NULL LIMIT 10;"

echo ""

echo "========================================="
echo "Migration Summary"
echo "========================================="
echo ""
echo "✅ Migration 017_zero_cost_cleanup.sql completed"
echo ""
echo "Changes applied:"
echo "  - Removed: gmail_watch_expiration column"
echo "  - Removed: gmail_history_id column"
echo "  - Added: last_gmail_sync column"
echo "  - Created: idx_users_last_gmail_sync index"
echo "  - Dropped: uploaded_statements table"
echo ""
echo "Next steps:"
echo "  1. Verify application works with new schema"
echo "  2. Test manual Gmail sync functionality"
echo "  3. Monitor logs for any migration-related errors"
echo "  4. Update any application code if needed"
echo ""
echo "Backup files saved in: database/backups/"
echo ""
echo "========================================="
echo "✅ Migration Complete"
echo "========================================="
