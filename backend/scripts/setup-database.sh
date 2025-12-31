#!/bin/bash

# Financial Tracker - Database Setup Script
# This script runs the schema.sql to set up the database

set -e

echo "========================================="
echo "Financial Tracker Database Setup"
echo "========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    echo "Please set DATABASE_URL in .env file"
    echo "Example: DATABASE_URL=postgresql://user:password@localhost:5432/financial_tracker"
    exit 1
fi

echo "Database URL: ${DATABASE_URL%@*}@***"
echo ""

# Confirm before proceeding
read -p "This will create/update database tables. Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Running schema.sql..."

# Run the schema file
psql "$DATABASE_URL" -f src/db/schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "Tables created/updated:"
    psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" 2>/dev/null || true
else
    echo ""
    echo "❌ Database setup failed!"
    exit 1
fi
