#!/bin/bash

# Financial Tracker - Cron Job Setup Script
# This script sets up cron jobs for scheduled tasks

set -e

echo "========================================="
echo "Financial Tracker Cron Job Setup"
echo "========================================="

# Get the directory of the backend
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_PATH="$(which node)"

echo "Backend directory: $BACKEND_DIR"
echo "Node path: $NODE_PATH"
echo ""

# Define cron jobs
CRON_JOBS=(
    # Balance snapshot - every day at midnight
    "0 0 * * * cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts balance_snapshot >> /var/log/financial-tracker/balance-snapshot.log 2>&1"
    
    # EMI reminder - every day at 8 AM
    "0 8 * * * cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts emi_reminder >> /var/log/financial-tracker/emi-reminder.log 2>&1"
    
    # Bill reminder - every day at 9 AM
    "0 9 * * * cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts bill_reminder >> /var/log/financial-tracker/bill-reminder.log 2>&1"
    
    # Analytics cache refresh - every 6 hours
    "0 */6 * * * cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts analytics_cache_refresh >> /var/log/financial-tracker/analytics-cache.log 2>&1"
    
    # Bill auto-detection - every Sunday at 2 AM
    "0 2 * * 0 cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts bill_auto_detection >> /var/log/financial-tracker/bill-detection.log 2>&1"
    
    # Recurring pattern detector - every Sunday at 3 AM
    "0 3 * * 0 cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts recurring_pattern_detector >> /var/log/financial-tracker/recurring-pattern.log 2>&1"
    
    # Monthly summary - 1st of every month at 1 AM
    "0 1 1 * * cd $BACKEND_DIR && $NODE_PATH -r ts-node/register src/jobs/scheduler.ts monthly_summary >> /var/log/financial-tracker/monthly-summary.log 2>&1"
)

echo "The following cron jobs will be set up:"
echo ""
for job in "${CRON_JOBS[@]}"; do
    echo "  $job"
done
echo ""

# Create log directory
echo "Creating log directory..."
sudo mkdir -p /var/log/financial-tracker
sudo chown $(whoami) /var/log/financial-tracker

# Ask for confirmation
read -p "Add these cron jobs? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Write cron jobs
echo ""
echo "Setting up cron jobs..."

# Get existing crontab (if any)
EXISTING_CRON=$(crontab -l 2>/dev/null || true)

# Remove existing financial-tracker jobs
EXISTING_CRON=$(echo "$EXISTING_CRON" | grep -v "financial-tracker" | grep -v "scheduler.ts" || true)

# Create new crontab
{
    echo "$EXISTING_CRON"
    echo ""
    echo "# Financial Tracker Scheduled Jobs"
    for job in "${CRON_JOBS[@]}"; do
        echo "$job"
    done
} | crontab -

echo ""
echo "✅ Cron jobs set up successfully!"
echo ""
echo "Current crontab:"
crontab -l

echo ""
echo "Job Logs Location: /var/log/financial-tracker/"
echo ""
echo "To manually run a job:"
echo "  cd $BACKEND_DIR"
echo "  npx ts-node src/jobs/scheduler.ts <job_name>"
echo ""
echo "Available jobs:"
echo "  - balance_snapshot"
echo "  - monthly_summary"
echo "  - emi_reminder"
echo "  - update_emi_dates"
echo "  - bill_auto_detection"
echo "  - recurring_pattern_detector"
echo "  - analytics_cache_refresh"
echo "  - bill_reminder"
echo "  - all_daily"
echo "  - all_hourly"
