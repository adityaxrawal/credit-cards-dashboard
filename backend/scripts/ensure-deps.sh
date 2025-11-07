#!/bin/bash
# ensure-deps.sh
# Ensures backend dependencies are properly installed before running checks

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_MODULES="$BACKEND_DIR/node_modules"
EXPECTED_PACKAGES=330  # Minimum expected (actual clean install gives ~339)

# Function to check if a package is properly installed
check_package_integrity() {
  local package_name=$1
  local package_path="$NODE_MODULES/$package_name"
  
  if [ ! -d "$package_path" ]; then
    return 1
  fi
  
  # Check if package.json exists
  if [ ! -f "$package_path/package.json" ]; then
    return 1
  fi
  
  # For typescript, check if lib/tsc.js exists
  if [ "$package_name" = "typescript" ]; then
    if [ ! -f "$package_path/lib/tsc.js" ]; then
      return 1
    fi
  fi
  
  # For tsc-alias, check if dist exists
  if [ "$package_name" = "tsc-alias" ]; then
    if [ ! -d "$package_path/dist" ]; then
      return 1
    fi
  fi
  
  return 0
}

# Count installed packages
if [ -d "$NODE_MODULES" ]; then
  ACTUAL_COUNT=$(ls "$NODE_MODULES" | wc -l | tr -d ' ')
else
  ACTUAL_COUNT=0
fi

# Check critical packages
NEEDS_REINSTALL=false

if [ "$ACTUAL_COUNT" -lt "$EXPECTED_PACKAGES" ]; then
  NEEDS_REINSTALL=true
fi

if ! check_package_integrity "typescript"; then
  echo "⚠️  TypeScript package is missing or corrupted"
  NEEDS_REINSTALL=true
fi

if ! check_package_integrity "tsc-alias"; then
  echo "⚠️  tsc-alias package is missing or corrupted"
  NEEDS_REINSTALL=true
fi

# If less than expected packages or critical packages missing, reinstall
if [ "$NEEDS_REINSTALL" = true ]; then
  echo "⚠️  Backend dependencies incomplete or corrupted (found $ACTUAL_COUNT packages, expected $EXPECTED_PACKAGES+)"
  echo "🔧 Reinstalling backend dependencies..."
  cd "$BACKEND_DIR"
  rm -rf node_modules
  npm install --silent
  NEW_COUNT=$(ls "$NODE_MODULES" | wc -l | tr -d ' ')
  echo "✓ Backend dependencies installed ($NEW_COUNT packages)"
fi
