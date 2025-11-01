#!/bin/bash

# Database Migration Runner for Phase 2
# This script provides instructions and automates database migration

echo "📊 Phase 2 Database Migration"
echo "========================================"
echo ""
echo "The migration file contains:"
echo "  - Add 5 Gmail columns to 'users' table"
echo "  - Create 'email_processing_log' table"
echo "  - Create 'scan_jobs' table"
echo "  - Add 'email_message_id' to 'transactions' table"
echo "  - Create 11 indexes"
echo "  - Create 2 triggers"
echo ""
echo "Migration file: backend/database/migrations/002_phase2_email_integration.sql"
echo ""
echo "Option 1: Run via Supabase Dashboard (RECOMMENDED)"
echo "---------------------------------------------------"
echo "1. Open https://supabase.com/dashboard/project/ythuxanwxzdwtuwotcha/sql"
echo "2. Click 'New Query'"
echo "3. Copy the contents of: backend/database/migrations/002_phase2_email_integration.sql"
echo "4. Paste into the SQL editor"
echo "5. Click 'Run' or press Cmd+Enter"
echo ""
echo "Option 2: Run via psql (if you have database password)"
echo "-------------------------------------------------------"
echo "psql 'postgresql://postgres.ythuxanwxzdwtuwotcha@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require' \\"
echo "  -f backend/database/migrations/002_phase2_email_integration.sql"
echo ""
echo "Option 3: Open migration file to copy"
echo "--------------------------------------"

# Try to open the migration file in default editor
MIGRATION_FILE="./migrations/002_phase2_email_integration.sql"

if [ -f "$MIGRATION_FILE" ]; then
    echo "Opening migration file..."
    cat "$MIGRATION_FILE"
    echo ""
    echo "----------------------------------------"
    echo "✓ Migration file displayed above"
    echo "  Copy this SQL and run it in Supabase Dashboard"
else
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi
