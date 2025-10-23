#!/bin/bash

# Credit Card Dashboard - Rollback Script
# This script handles rolling back to the previous Vercel deployment with proper verification

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="credit-card-dashboard"
HEALTH_CHECK_TIMEOUT=30
MAX_RETRIES=5
RETRY_DELAY=10

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites for rollback..."
    
    # Check if Vercel CLI is installed
    if ! command_exists vercel; then
        error "Vercel CLI is not installed. Please install it first: npm install -g vercel"
        exit 1
    fi
    
    # Check if user is logged in to Vercel
    if ! vercel whoami >/dev/null 2>&1; then
        error "Not logged in to Vercel. Please login first: vercel login"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Function to get current deployment info
get_current_deployment() {
    log "Getting current deployment information..."
    
    # Get current production deployment
    CURRENT_DEPLOYMENT=$(vercel ls --scope=personal | grep "$PROJECT_NAME" | grep "READY" | head -1)
    
    if [ -z "$CURRENT_DEPLOYMENT" ]; then
        error "No current deployment found for $PROJECT_NAME"
        exit 1
    fi
    
    CURRENT_URL=$(echo "$CURRENT_DEPLOYMENT" | awk '{print $2}')
    CURRENT_ID=$(echo "$CURRENT_DEPLOYMENT" | awk '{print $1}')
    
    log "Current deployment: $CURRENT_URL (ID: $CURRENT_ID)"
    echo "$CURRENT_ID"
}

# Function to get previous deployment
get_previous_deployment() {
    log "Finding previous deployment..."
    
    # Get list of deployments, skip the current one, and get the next ready deployment
    PREVIOUS_DEPLOYMENT=$(vercel ls --scope=personal | grep "$PROJECT_NAME" | grep "READY" | sed -n '2p')
    
    if [ -z "$PREVIOUS_DEPLOYMENT" ]; then
        error "No previous deployment found for rollback"
        exit 1
    fi
    
    PREVIOUS_URL=$(echo "$PREVIOUS_DEPLOYMENT" | awk '{print $2}')
    PREVIOUS_ID=$(echo "$PREVIOUS_DEPLOYMENT" | awk '{print $1}')
    
    log "Previous deployment: $PREVIOUS_URL (ID: $PREVIOUS_ID)"
    echo "$PREVIOUS_ID"
}

# Function to confirm rollback
confirm_rollback() {
    local current_id=$1
    local previous_id=$2
    
    echo ""
    echo "🚨 ROLLBACK CONFIRMATION"
    echo "========================"
    echo "Current deployment ID: $current_id"
    echo "Target deployment ID:  $previous_id"
    echo ""
    
    if [[ "$*" == *"--force"* ]]; then
        warning "Force flag detected, skipping confirmation"
        return 0
    fi
    
    read -p "Are you sure you want to rollback? This will affect production users. (yes/no): " -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Rollback cancelled by user"
        exit 0
    fi
}

# Function to perform rollback
perform_rollback() {
    local previous_id=$1
    
    log "Performing rollback to deployment: $previous_id"
    
    # Promote the previous deployment to production
    if vercel promote "$previous_id" --scope=personal; then
        success "Rollback completed successfully"
    else
        error "Rollback failed"
        exit 1
    fi
}

# Function to verify rollback
verify_rollback() {
    local target_url=$1
    
    log "Verifying rollback success..."
    
    # Wait a moment for DNS propagation
    sleep 5
    
    local retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        log "Verification attempt $((retry_count + 1))/$MAX_RETRIES"
        
        # Check if the health endpoint responds
        if curl -f -s --max-time $HEALTH_CHECK_TIMEOUT "$target_url/api/health" >/dev/null; then
            success "Rollback verification passed"
            return 0
        else
            warning "Verification failed, retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
            retry_count=$((retry_count + 1))
        fi
    done
    
    error "Rollback verification failed after $MAX_RETRIES attempts"
    return 1
}

# Function to run post-rollback health checks
run_health_checks() {
    local url=$1
    
    log "Running post-rollback health checks..."
    
    # Test main application
    if curl -f -s --max-time $HEALTH_CHECK_TIMEOUT "$url" >/dev/null; then
        success "Main application is accessible"
    else
        error "Main application is not accessible"
        return 1
    fi
    
    # Test health endpoint
    if curl -f -s --max-time $HEALTH_CHECK_TIMEOUT "$url/api/health" >/dev/null; then
        success "Health API is responding"
    else
        error "Health API is not responding"
        return 1
    fi
    
    # Test authentication endpoint
    if curl -f -s --max-time $HEALTH_CHECK_TIMEOUT "$url/api/auth/session" >/dev/null; then
        success "Authentication API is accessible"
    else
        warning "Authentication API may have issues (this might be expected)"
    fi
    
    success "Health checks completed"
}

# Function to notify team
notify_team() {
    local current_id=$1
    local previous_id=$2
    local rollback_url=$3
    
    log "Preparing team notification..."
    
    # Create notification message
    NOTIFICATION_MESSAGE="🚨 PRODUCTION ROLLBACK COMPLETED

Project: $PROJECT_NAME
Time: $(date)
Rolled back from: $current_id
Rolled back to: $previous_id
Current URL: $rollback_url

Reason: Manual rollback initiated
Status: ✅ Successful

Next Steps:
1. Monitor application performance
2. Check error rates and logs
3. Investigate issues that caused rollback
4. Plan fix and re-deployment

Health Check: $rollback_url/api/health
Dashboard: $rollback_url/dashboard"

    echo ""
    echo "📧 TEAM NOTIFICATION"
    echo "==================="
    echo "$NOTIFICATION_MESSAGE"
    echo ""
    
    # Save notification to file
    echo "$NOTIFICATION_MESSAGE" > "rollback-notification-$(date +%Y%m%d-%H%M%S).txt"
    success "Notification saved to file"
    
    # If Slack webhook is configured, send notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        log "Sending Slack notification..."
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$NOTIFICATION_MESSAGE\"}" \
            "$SLACK_WEBHOOK_URL" || warning "Failed to send Slack notification"
    fi
    
    # If email is configured, send notification
    if [ -n "$NOTIFICATION_EMAIL" ] && command_exists mail; then
        log "Sending email notification..."
        echo "$NOTIFICATION_MESSAGE" | mail -s "🚨 Production Rollback - $PROJECT_NAME" "$NOTIFICATION_EMAIL" || warning "Failed to send email notification"
    fi
}

# Function to output rollback summary
output_summary() {
    local rollback_url=$1
    local duration=$2
    
    echo ""
    echo "=========================================="
    echo "🔄 ROLLBACK COMPLETED SUCCESSFULLY! 🔄"
    echo "=========================================="
    echo ""
    echo "📋 Rollback Summary:"
    echo "  • Project: $PROJECT_NAME"
    echo "  • URL: $rollback_url"
    echo "  • Time: $(date)"
    echo "  • Duration: ${duration}s"
    echo ""
    echo "🔗 Quick Links:"
    echo "  • Application: $rollback_url"
    echo "  • Health Check: $rollback_url/api/health"
    echo "  • Dashboard: $rollback_url/dashboard"
    echo ""
    echo "📊 Next Steps:"
    echo "  1. Monitor application performance closely"
    echo "  2. Check error rates and user feedback"
    echo "  3. Investigate root cause of issues"
    echo "  4. Plan and test fixes before re-deployment"
    echo "  5. Update incident documentation"
    echo ""
    echo "📞 Support Commands:"
    echo "  • View logs: vercel logs"
    echo "  • List deployments: vercel ls"
    echo "  • Get help: vercel help"
    echo ""
}

# Function to handle rollback failure
handle_failure() {
    local step=$1
    
    error "Rollback failed at step: $step"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    echo "  1. Check Vercel CLI authentication"
    echo "  2. Verify deployment IDs exist"
    echo "  3. Check network connectivity"
    echo "  4. Review Vercel deployment logs"
    echo "  5. Contact Vercel support if needed"
    echo ""
    echo "📞 Emergency Contacts:"
    echo "  • Vercel Support: https://vercel.com/support"
    echo "  • Team Lead: [Add contact information]"
    echo "  • DevOps: [Add contact information]"
    echo ""
    exit 1
}

# Main rollback function
main() {
    echo ""
    echo "🔄 Starting Credit Card Dashboard Rollback"
    echo "==========================================="
    echo ""
    
    # Store start time
    START_TIME=$(date +%s)
    
    # Check prerequisites
    check_prerequisites || handle_failure "Prerequisites Check"
    
    # Get deployment information
    CURRENT_ID=$(get_current_deployment) || handle_failure "Getting Current Deployment"
    PREVIOUS_ID=$(get_previous_deployment) || handle_failure "Getting Previous Deployment"
    
    # Confirm rollback
    confirm_rollback "$CURRENT_ID" "$PREVIOUS_ID" "$@"
    
    # Perform rollback
    perform_rollback "$PREVIOUS_ID" || handle_failure "Performing Rollback"
    
    # Get the rollback URL
    ROLLBACK_URL="https://$PROJECT_NAME.vercel.app"
    
    # Verify rollback
    if verify_rollback "$ROLLBACK_URL" && run_health_checks "$ROLLBACK_URL"; then
        # Calculate rollback time
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        
        success "Rollback completed successfully in ${DURATION}s"
        
        # Notify team
        notify_team "$CURRENT_ID" "$PREVIOUS_ID" "$ROLLBACK_URL"
        
        # Output summary
        output_summary "$ROLLBACK_URL" "$DURATION"
    else
        handle_failure "Rollback Verification"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --force    Skip confirmation prompt"
    echo "  --help     Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SLACK_WEBHOOK_URL     Slack webhook for notifications"
    echo "  NOTIFICATION_EMAIL    Email address for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                    Interactive rollback"
    echo "  $0 --force           Force rollback without confirmation"
    echo ""
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        show_usage
        exit 0
        ;;
    *)
        # Handle script interruption
        trap 'error "Rollback interrupted"; exit 1' INT TERM
        
        # Run main function with all arguments
        main "$@"
        ;;
esac