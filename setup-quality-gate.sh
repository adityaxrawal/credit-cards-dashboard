#!/bin/bash
# setup-quality-gate.sh
# One-time setup script for the pre-deploy quality gate system

set -e  # Exit on any error

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   Credit Card Dashboard - Quality Gate Setup             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory (repo root)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

echo -e "${BLUE}📍 Repository root: $REPO_ROOT${NC}"
echo ""

# Step 1: Install root dependencies (including Husky)
echo -e "${BLUE}▶ Step 1: Installing root dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Root dependencies installed${NC}"
echo ""

# Step 2: Install api-gateway dependencies
echo -e "${BLUE}▶ Step 2: Installing api-gateway dependencies...${NC}"
cd backend/services/api-gateway
npm install
cd "$REPO_ROOT"
echo -e "${GREEN}✓ API Gateway dependencies installed${NC}"
echo ""

# Step 3: Install shared dependencies (including redis)
echo -e "${BLUE}▶ Step 3: Installing shared workspace dependencies...${NC}"
cd backend/shared
npm install
cd "$REPO_ROOT"
echo -e "${GREEN}✓ Shared dependencies installed${NC}"
echo ""

# Step 4: Initialize Husky
echo -e "${BLUE}▶ Step 4: Initializing Husky git hooks...${NC}"
npx husky install
echo -e "${GREEN}✓ Husky initialized${NC}"
echo ""

# Step 5: Make pre-push hook executable
echo -e "${BLUE}▶ Step 5: Setting up pre-push hook...${NC}"
chmod +x .husky/pre-push
echo -e "${GREEN}✓ Pre-push hook configured${NC}"
echo ""

# Step 6: Build shared package
echo -e "${BLUE}▶ Step 6: Building shared package...${NC}"
cd backend/shared
npm run build 2>/dev/null || echo -e "${YELLOW}⚠ Shared build skipped (no build output expected)${NC}"
cd "$REPO_ROOT"
echo ""

# Step 7: Test the quality gate
echo -e "${BLUE}▶ Step 7: Testing quality gate...${NC}"
echo -e "${YELLOW}Running: npm run deps:verify${NC}"
npm run deps:verify
echo ""

# Summary
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              ✅ SETUP COMPLETE!                          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}The pre-deploy quality gate is now active!${NC}"
echo ""
echo "What was installed:"
echo "  ✓ Husky for git hooks"
echo "  ✓ Pre-push hook that runs quality checks"
echo "  ✓ All dependencies for api-gateway and shared"
echo "  ✓ Prettier for code formatting"
echo ""
echo "Available commands:"
echo -e "  ${BLUE}npm run prepush${NC}          - Run all quality checks"
echo -e "  ${BLUE}npm run deps:verify${NC}      - Check dependencies"
echo -e "  ${BLUE}npm run typecheck:strict${NC} - Strict TypeScript check"
echo -e "  ${BLUE}npm run lint${NC}             - Run linter"
echo -e "  ${BLUE}npm run render:simulate${NC}  - Simulate Render deployment"
echo ""
echo "Next steps:"
echo "  1. Try the quality gate: ${BLUE}npm run prepush${NC}"
echo "  2. Read the docs: ${BLUE}docs/deploy-checklist.md${NC}"
echo "  3. Make changes and git push (pre-push hook will run automatically)"
echo ""
echo -e "${GREEN}🚀 You're ready to deploy with confidence!${NC}"
echo ""
