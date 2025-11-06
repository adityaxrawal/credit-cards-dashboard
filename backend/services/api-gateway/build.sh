#!/bin/bash

# Build Script for API Gateway
# Handles shared package dependency and TypeScript compilation

set -e

echo "🔨 Starting build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared package if it exists
if [ -d "../../shared" ]; then
  echo "📦 Building shared package..."
  cd ../../shared
  npm install
  npm run build
  cd -
fi

# Build API Gateway
echo "🔧 Building API Gateway..."
tsc

# Transform path aliases
echo "🔄 Transforming path aliases..."
npx tsc-alias

echo "✅ Build complete!"
