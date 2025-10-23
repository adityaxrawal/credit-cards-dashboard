#!/bin/bash

# Credit Card Dashboard - Production Deployment Script
# This script handles the complete deployment process with proper error handling and verification

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="credit-card-dashboard"
HEALTH_CHECK_URL="https://credit-card-dashboard.vercel.app/api/health"
MAX_RETRIES=5
RETRY_DELAY=10

# Logging function
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
    log "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command_exists node; then
        error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command_exists npm; then
        error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check if Vercel CLI is installed
    if ! command_exists vercel; then
        warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        error "package.json not found. Please run this script from the project root."
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Function to run type checking
run_type_check() {
    log "Running TypeScript type check..."
    
    if npm run type-check; then
        success "Type check passed"
    else
        error "Type check failed. Please fix TypeScript errors before deploying."
        exit 1
    fi
}

# Function to run linter
run_linter() {
    log "Running ESLint..."
    
    if npm run lint; then
        success "Linting passed"
    else
        error "Linting failed. Please fix linting errors before deploying."
        exit 1
    fi
}

# Function to run tests
run_tests() {
    log "Running tests..."
    
    if npm test; then
        success "All tests passed"
    else
        error "Tests failed. Please fix failing tests before deploying."
        exit 1
    fi
}

# Function to build the application
build_application() {
    log "Building application..."
    
    # Clean previous build
    if [ -d ".next" ]; then
        rm -rf .next
        log "Cleaned previous build"
    fi
    
    # Run build
    if npm run build; then
        success "Build completed successfully"
    else
        error "Build failed. Please fix build errors before deploying."
        exit 1
    fi
}

# Function to verify build
verify_build() {
    log "Verifying build artifacts..."
    
    # Check if .next directory exists
    if [ ! -d ".next" ]; then
        error "Build directory (.next) not found"
        exit 1
    fi
    
    # Check if static files exist
    if [ ! -d ".next/static" ]; then
        error "Static files not found in build"
        exit 1
    fi
    
    # Check build size
    BUILD_SIZE=$(du -sh .next | cut -f1)
    log "Build size: $BUILD_SIZE"
    
    success "Build verification passed"
}

# Function to deploy to Vercel
deploy_to_vercel() {
    log "Deploying to Vercel..."
    
    # Check if user is logged in to Vercel
    if ! vercel whoami >/dev/null 2>&1; then
        warning "Not logged in to Vercel. Please login first."
        vercel login
    fi
    
    # Deploy to production
    if vercel --prod --yes; then
        success "Deployment to Vercel completed"
    else
        error "Deployment to Vercel failed"
        exit 1
    fi
}

# Function to get deployment URL
get_deployment_url() {
    log "Getting deployment URL..."
    
    # Get the latest deployment URL
    DEPLOYMENT_URL=$(vercel ls --scope=personal | grep "$PROJECT_NAME" | head -1 | awk '{print $2}')
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        # Fallback to default URL pattern
        DEPLOYMENT_URL="https://$PROJECT_NAME.vercel.app"
    fi
    
    echo "$DEPLOYMENT_URL"
}

# Function to run health check
run_health_check() {
    local url=$1
    log "Running post-deployment health check on $url..."
    
    local retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        log "Health check attempt $((retry_count + 1))/$MAX_RETRIES"
        
        if curl -f -s "$url/api/health" >/dev/null; then
            success "Health check passed"
            return 0
        else
            warning "Health check failed, retrying in $RETRY_DELAY seconds..."
            sleep $RETRY_DELAY
            retry_count=$((retry_count + 1))
        fi
    done
    
    error "Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Function to run smoke tests
run_smoke_tests() {
    local url=$1
    log "Running smoke tests on $url..."
    
    # Test main page
    if curl -f -s "$url" >/dev/null; then
        success "Main page accessible"
    else
        error "Main page not accessible"
        return 1
    fi
    
    # Test API endpoints
    if curl -f -s "$url/api/health" >/dev/null; then
        success "Health API accessible"
    else
        error "Health API not accessible"
        return 1
    fi
    
    success "Smoke tests passed"
}

# Function to output deployment summary
output_summary() {
    local deployment_url=$1
    
    echo ""
    echo "=========================================="
    echo "🚀 DEPLOYMENT COMPLETED SUCCESSFULLY! 🚀"
    echo "=========================================="
    echo ""
    echo "📋 Deployment Summary:"
    echo "  • Project: $PROJECT_NAME"
    echo "  • URL: $deployment_url"
    echo "  • Time: $(date)"
    echo "  • Build Size: $(du -sh .next | cut -f1)"
    echo ""
    echo "🔗 Quick Links:"
    echo "  • Application: $deployment_url"
    echo "  • Health Check: $deployment_url/api/health"
    echo "  • Dashboard: $deployment_url/dashboard"
    echo ""
    echo "📊 Next Steps:"
    echo "  1. Monitor application performance"
    echo "  2. Check error rates in logs"
    echo "  3. Verify all features work correctly"
    echo "  4. Update team on successful deployment"
    echo ""
}

# Function to handle deployment failure
handle_failure() {
    error "Deployment failed at step: $1"
    echo ""
    echo "🔧 Troubleshooting Steps:"
    echo "  1. Check the error messages above"
    echo "  2. Verify all environment variables are set"
    echo "  3. Ensure all dependencies are installed"
    echo "  4. Check Vercel deployment logs"
    echo "  5. Consider running rollback script if needed"
    echo ""
    echo "📞 Need Help?"
    echo "  • Check logs: vercel logs"
    echo "  • View deployments: vercel ls"
    echo "  • Get help: vercel help"
    echo ""
    exit 1
}

# Main deployment function
main() {
    echo ""
    echo "🚀 Starting Credit Card Dashboard Deployment"
    echo "=============================================="
    echo ""
    
    # Store start time
    START_TIME=$(date +%s)
    
    # Run deployment steps
    check_prerequisites || handle_failure "Prerequisites Check"
    run_type_check || handle_failure "Type Check"
    run_linter || handle_failure "Linting"
    
    # Skip tests if --skip-tests flag is provided
    if [[ "$*" != *"--skip-tests"* ]]; then
        run_tests || handle_failure "Tests"
    else
        warning "Skipping tests as requested"
    fi
    
    build_application || handle_failure "Build"
    verify_build || handle_failure "Build Verification"
    deploy_to_vercel || handle_failure "Vercel Deployment"
    
    # Get deployment URL
    DEPLOYMENT_URL=$(get_deployment_url)
    
    # Run post-deployment checks
    if run_health_check "$DEPLOYMENT_URL" && run_smoke_tests "$DEPLOYMENT_URL"; then
        # Calculate deployment time
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        
        success "Deployment completed in ${DURATION}s"
        output_summary "$DEPLOYMENT_URL"
    else
        handle_failure "Post-deployment Verification"
    fi
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function with all arguments
main "$@"