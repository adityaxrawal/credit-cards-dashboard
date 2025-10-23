#!/bin/bash

# Credit Card Dashboard - Environment Setup Script
# =============================================================================
# This script helps set up environment variables for the Credit Card Dashboard
# It will prompt for required values and generate a .env.local file
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to validate URL format
validate_url() {
    local url=$1
    if [[ $url =~ ^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to validate email format
validate_email() {
    local email=$1
    if [[ $email =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to generate encryption key
generate_encryption_key() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        # Fallback if openssl is not available
        head -c 32 /dev/urandom | xxd -p -c 32
    fi
}

# Function to prompt for input with validation
prompt_with_validation() {
    local prompt=$1
    local validator=$2
    local value=""
    
    while true; do
        read -p "$prompt: " value
        if [ -z "$value" ]; then
            print_error "Value cannot be empty. Please try again."
            continue
        fi
        
        if [ "$validator" = "url" ]; then
            if validate_url "$value"; then
                echo "$value"
                break
            else
                print_error "Invalid URL format. Please enter a valid URL (e.g., https://example.com)"
            fi
        elif [ "$validator" = "email" ]; then
            if validate_email "$value"; then
                echo "$value"
                break
            else
                print_error "Invalid email format. Please enter a valid email address"
            fi
        else
            echo "$value"
            break
        fi
    done
}

# Main setup function
main() {
    clear
    echo "============================================================================="
    echo "🚀 Credit Card Dashboard - Environment Setup"
    echo "============================================================================="
    echo ""
    
    print_info "This script will help you set up environment variables for development."
    print_info "You'll need credentials from Supabase, Google Cloud, and Upstash."
    echo ""
    
    # Check if .env.local already exists
    if [ -f ".env.local" ]; then
        print_warning ".env.local already exists!"
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_info "Setup cancelled. Existing .env.local preserved."
            exit 0
        fi
        echo ""
    fi
    
    # Create temporary file
    temp_file=$(mktemp)
    
    echo "# Credit Card Dashboard - Development Environment Variables" > "$temp_file"
    echo "# Generated on $(date)" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Application URL
    echo "============================================================================="
    print_info "1. Application Configuration"
    echo "============================================================================="
    app_url=$(prompt_with_validation "Enter your application URL (e.g., http://localhost:3000)" "url")
    echo "NEXT_PUBLIC_URL=$app_url" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Supabase Configuration
    echo "============================================================================="
    print_info "2. Supabase Configuration"
    print_info "Get these from: https://supabase.com/dashboard > Your Project > Settings > API"
    echo "============================================================================="
    supabase_url=$(prompt_with_validation "Enter Supabase URL" "url")
    echo "NEXT_PUBLIC_SUPABASE_URL=$supabase_url" >> "$temp_file"
    
    read -p "Enter Supabase Anon Key: " supabase_anon_key
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabase_anon_key" >> "$temp_file"
    
    read -p "Enter Supabase Service Role Key: " supabase_service_key
    echo "SUPABASE_SERVICE_ROLE_KEY=$supabase_service_key" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Google OAuth Configuration
    echo "============================================================================="
    print_info "3. Google OAuth & Gmail API"
    print_info "Get these from: https://console.cloud.google.com > APIs & Services > Credentials"
    echo "============================================================================="
    read -p "Enter Google Client ID: " google_client_id
    echo "GOOGLE_CLIENT_ID=$google_client_id" >> "$temp_file"
    
    read -p "Enter Google Client Secret: " google_client_secret
    echo "GOOGLE_CLIENT_SECRET=$google_client_secret" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Upstash Configuration
    echo "============================================================================="
    print_info "4. Upstash Redis & QStash"
    print_info "Get these from: https://console.upstash.com"
    echo "============================================================================="
    upstash_url=$(prompt_with_validation "Enter Upstash Redis REST URL" "url")
    echo "UPSTASH_REDIS_REST_URL=$upstash_url" >> "$temp_file"
    
    read -p "Enter Upstash Redis REST Token: " upstash_token
    echo "UPSTASH_REDIS_REST_TOKEN=$upstash_token" >> "$temp_file"
    
    read -p "Enter QStash Token (optional, press Enter to skip): " qstash_token
    if [ -n "$qstash_token" ]; then
        echo "QSTASH_TOKEN=$qstash_token" >> "$temp_file"
    else
        echo "# QSTASH_TOKEN=your_qstash_token_here" >> "$temp_file"
    fi
    echo "" >> "$temp_file"
    
    # Generate encryption key
    echo "============================================================================="
    print_info "5. Security Configuration"
    echo "============================================================================="
    print_info "Generating encryption key..."
    encryption_key=$(generate_encryption_key)
    echo "ENCRYPTION_KEY=$encryption_key" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Optional admin API key
    read -p "Enter Admin API Key (optional, press Enter to generate): " admin_key
    if [ -z "$admin_key" ]; then
        admin_key=$(generate_encryption_key | cut -c1-32)
    fi
    echo "ADMIN_API_KEY=$admin_key" >> "$temp_file"
    
    # Move temp file to .env.local
    mv "$temp_file" ".env.local"
    
    echo ""
    echo "============================================================================="
    print_success "Environment setup completed!"
    echo "============================================================================="
    print_success ".env.local file has been created with your configuration."
    echo ""
    print_info "Next steps:"
    echo "1. Review the generated .env.local file"
    echo "2. Install dependencies: npm install or pnpm install"
    echo "3. Run database migrations (if needed)"
    echo "4. Start the development server: npm run dev"
    echo ""
    print_warning "Important: Never commit .env.local to version control!"
    print_warning "Add .env.local to your .gitignore file if not already present."
    echo ""
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Check if this is the correct project
if ! grep -q "credit-card-dashboard" package.json 2>/dev/null; then
    print_warning "This doesn't appear to be the Credit Card Dashboard project."
    read -p "Continue anyway? (y/N): " continue_setup
    if [[ ! $continue_setup =~ ^[Yy]$ ]]; then
        print_info "Setup cancelled."
        exit 0
    fi
fi

# Run main setup
main

print_success "Setup complete! 🎉"