#!/bin/bash

# Credit Card Dashboard - Infrastructure Setup Script
# This script sets up all required infrastructure services

set -e

echo "🚀 Credit Card Dashboard - Infrastructure Setup"
echo "================================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Check prerequisites
echo "1. Checking prerequisites..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: v$NPM_VERSION"
else
    print_error "npm is not installed."
    exit 1
fi

# Check gcloud CLI
if command -v gcloud &> /dev/null; then
    print_success "Google Cloud CLI installed"
else
    print_warning "Google Cloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
fi

# Check git
if command -v git &> /dev/null; then
    print_success "Git installed"
else
    print_error "Git is not installed."
    exit 1
fi

echo ""
echo "2. Google Cloud Platform Setup"
echo ""

read -p "Enter your GCP Project ID (or press Enter to skip): " GCP_PROJECT_ID

if [ -n "$GCP_PROJECT_ID" ]; then
    print_info "Setting up GCP project: $GCP_PROJECT_ID"
    
    # Set project
    gcloud config set project "$GCP_PROJECT_ID"
    
    # Enable required APIs
    print_info "Enabling required APIs..."
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable pubsub.googleapis.com
    gcloud services enable cloudscheduler.googleapis.com
    gcloud services enable gmail.googleapis.com
    
    print_success "GCP services enabled"
    
    # Create service account
    print_info "Creating Cloud Run service account..."
    gcloud iam service-accounts create cloud-run-sa --display-name="Cloud Run Service Account" || true
    
    # Create Pub/Sub topic
    print_info "Creating Pub/Sub topic for Gmail..."
    gcloud pubsub topics create gmail-notifications || true
    gcloud pubsub subscriptions create gmail-sub --topic=gmail-notifications || true
    
    print_success "GCP setup complete"
else
    print_warning "Skipping GCP setup"
fi

echo ""
echo "3. Supabase Setup"
echo ""

print_info "Please complete the following steps manually:"
print_info "1. Go to https://supabase.com and create a new project"
print_info "2. Name it 'credit-card-dashboard'"
print_info "3. Save the following credentials:"
print_info "   - SUPABASE_URL"
print_info "   - SUPABASE_ANON_KEY"
print_info "   - SUPABASE_SERVICE_ROLE_KEY"
print_info "   - DATABASE_URL"

read -p "Press Enter once you have the Supabase credentials..."

echo ""
echo "4. Upstash Redis Setup"
echo ""

print_info "Please complete the following steps manually:"
print_info "1. Go to https://upstash.com and create a new Redis database"
print_info "2. Name it 'cc-dashboard-cache'"
print_info "3. Choose the same region as your Supabase project"
print_info "4. Save the following credentials:"
print_info "   - REDIS_URL"
print_info "   - UPSTASH_REDIS_REST_URL"
print_info "   - UPSTASH_REDIS_REST_TOKEN"

read -p "Press Enter once you have the Upstash credentials..."

echo ""
echo "5. Google OAuth Setup"
echo ""

print_info "Please complete the following steps manually:"
print_info "1. Go to https://console.cloud.google.com/apis/credentials"
print_info "2. Create OAuth 2.0 Client ID"
print_info "3. Application type: Web application"
print_info "4. Authorized redirect URIs:"
print_info "   - http://localhost:3000/auth/callback (development)"
print_info "   - https://your-domain.vercel.app/auth/callback (production)"
print_info "5. Save the following credentials:"
print_info "   - GOOGLE_CLIENT_ID"
print_info "   - GOOGLE_CLIENT_SECRET"

read -p "Press Enter once you have the Google OAuth credentials..."

echo ""
echo "6. Vercel Setup"
echo ""

print_info "Setting up Vercel..."

if command -v vercel &> /dev/null; then
    print_success "Vercel CLI installed"
else
    print_info "Installing Vercel CLI..."
    npm install -g vercel
fi

print_info "Please run 'vercel login' and 'vercel link' in the frontend directory"

echo ""
echo "7. Environment Variables Setup"
echo ""

print_info "Creating environment files from examples..."

# Root .env
if [ ! -f .env ]; then
    cp .env.example .env
    print_success "Created .env"
else
    print_warning ".env already exists"
fi

# Frontend .env.local
if [ ! -f frontend/.env.local ]; then
    cp frontend/.env.example frontend/.env.local
    print_success "Created frontend/.env.local"
else
    print_warning "frontend/.env.local already exists"
fi

# Backend .env
if [ ! -f backend/services/api-gateway/.env ]; then
    cp backend/services/api-gateway/.env.example backend/services/api-gateway/.env
    print_success "Created backend/services/api-gateway/.env"
else
    print_warning "backend/services/api-gateway/.env already exists"
fi

# Shared .env
if [ ! -f backend/shared/.env ]; then
    cp backend/shared/.env.example backend/shared/.env
    print_success "Created backend/shared/.env"
else
    print_warning "backend/shared/.env already exists"
fi

# Database .env
if [ ! -f database/.env ]; then
    cp database/.env.example database/.env
    print_success "Created database/.env"
else
    print_warning "database/.env already exists"
fi

print_warning "⚠️  IMPORTANT: Edit all .env files and fill in the actual values!"

echo ""
echo "8. Install Dependencies"
echo ""

read -p "Install all npm dependencies? (y/n): " INSTALL_DEPS

if [ "$INSTALL_DEPS" = "y" ]; then
    print_info "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    print_success "Frontend dependencies installed"
    
    print_info "Installing backend dependencies..."
    cd backend/services/api-gateway && npm install && cd ../../..
    print_success "Backend dependencies installed"
    
    print_info "Installing shared dependencies..."
    cd backend/shared && npm install && cd ../..
    print_success "Shared dependencies installed"
    
    print_info "Installing database dependencies..."
    cd database && npm install && cd ..
    print_success "Database dependencies installed"
else
    print_warning "Skipping dependency installation"
fi

echo ""
echo "9. Database Migration"
echo ""

read -p "Run database migration? (Make sure DATABASE_URL is set) (y/n): " RUN_MIGRATION

if [ "$RUN_MIGRATION" = "y" ]; then
    print_info "Running database migration..."
    cd database && npm run migrate:up && cd ..
    print_success "Database migration completed"
else
    print_warning "Skipping database migration"
    print_info "You can run it later with: cd database && npm run migrate:up"
fi

echo ""
echo "================================================"
echo "✅ Infrastructure Setup Complete!"
echo "================================================"
echo ""
print_info "Next Steps:"
print_info "1. Edit all .env files with your actual credentials"
print_info "2. Run database migration (if skipped): cd database && npm run migrate:up"
print_info "3. Start development servers:"
print_info "   - Backend: cd backend/services/api-gateway && npm run dev"
print_info "   - Frontend: cd frontend && npm run dev"
print_info "4. Access the app at http://localhost:3000"
echo ""
print_info "For detailed instructions, see README.md and docs/DEVELOPMENT_PHASES.md"
echo ""
