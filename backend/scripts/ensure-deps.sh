#!/bin/bash
# ensure-deps.sh
# Ensures backend dependencies are properly installed before running checks

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MODULES="$BACKEND_DIR/node_modules"
EXPECTED_PACKAGES=462

# Count installed packages
if [ -d "$NODE_MODULES" ]; then
  ACTUAL_COUNT=$(ls "$NODE_MODULES" | wc -l | tr -d ' ')
else
  ACTUAL_COUNT=0
fi

# Check if critical packages exist
TYPESCRIPT_EXISTS=false
TSC_ALIAS_EXISTS=false

if [ -d "$NODE_MODULES/typescript" ]; then
  TYPESCRIPT_EXISTS=true
fi

if [ -d "$NODE_MODULES/tsc-alias" ]; then
  TSC_ALIAS_EXISTS=true
fi

# If less than expected packages or critical packages missing, reinstall
if [ "$ACTUAL_COUNT" -lt "$EXPECTED_PACKAGES" ] || [ "$TYPESCRIPT_EXISTS" = false ] || [ "$TSC_ALIAS_EXISTS" = false ]; then
  echo "⚠️  Backend dependencies incomplete (found $ACTUAL_COUNT packages, expected $EXPECTED_PACKAGES+)"
  echo "🔧 Reinstalling backend dependencies..."
  cd "$BACKEND_DIR"
  npm install --silent
  echo "✓ Backend dependencies installed"
fi
