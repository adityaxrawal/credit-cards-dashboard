# Backend Setup & Development

## 🚀 Quick Start

### Installation

```bash
# From the backend directory
cd backend
npm install
```

**Important:** The backend has its own `node_modules` directory. Always run `npm install` from the `backend/` directory, not from the workspace root.

## 📁 Project Structure

```
backend/
├── package.json          # Single consolidated package.json for entire backend
├── package-lock.json     # Lock file (committed to git)
├── node_modules/         # All backend dependencies (462+ packages)
├── services/
│   ├── api-gateway/      # Main API service
│   │   ├── src/          # Source code
│   │   ├── dist/         # Build output (git-ignored)
│   │   ├── scripts/      # Build and verification scripts
│   │   └── tsconfig.json
│   └── shared/           # Shared utilities and modules
│       ├── index.ts
│       ├── monitoring/
│       ├── database/
│       └── tsconfig.json
├── .eslintrc.json       # Root ESLint config
└── .prettierrc          # Root Prettier config
```

## 🔧 Available Scripts

### Development

```bash
npm run dev              # Start development server with hot reload
```

### Building

```bash
npm run build            # Build both shared and api-gateway
npm run build:shared     # Build only shared module
npm run build:gateway    # Build only api-gateway
npm run build:clean      # Clean dist/ and rebuild
```

### Quality Checks

```bash
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run typecheck        # TypeScript type checking
npm run typecheck:strict # Strict type checking
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
```

### Pre-deployment Checks

```bash
npm run deps:verify      # Verify all dependencies are installed
npm run render:simulate  # Simulate Render.com build process
npm run prepush          # Run all quality checks (what Husky runs)

Note: Git hooks (Husky) are managed at the repository root in `.husky/`.
Only the root Husky setup is used.
```

### Production

```bash
npm start                # Start production server (requires build first)
```

## ⚠️ Common Issues & Solutions

### Issue: "Module typescript is not installed" or "Module tsc-alias is not installed"

**Cause:** The `backend/node_modules` directory is missing or incomplete.

**Solution:**

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Issue: Prepush checks failing

**Solution:** Run the verification script to see what's wrong:

```bash
cd backend
npm run deps:verify
```

### Issue: Build fails with "Cannot find module 'shared'"

**Cause:** TypeScript path mappings not set up correctly or build order issue.

**Solution:**

```bash
npm run build:clean
```

## 🏗️ Build Output Structure

After running `npm run build`, the output structure will be:

```
backend/services/api-gateway/dist/
├── api-gateway/
│   └── src/
│       ├── index.js      # Main entry point
│       ├── config/
│       ├── modules/
│       └── ...
└── shared/
    ├── index.js
    ├── monitoring/
    └── ...
```

The entry point for production is: `services/api-gateway/dist/api-gateway/src/index.js`

## 📦 Dependencies Management

- **All dependencies** are defined in `backend/package.json`
- **No nested package.json files** - we use a single package.json structure
- **TypeScript path mappings** handle module resolution between api-gateway and shared

### Key Dependencies:

- **Runtime:** Express, Supabase, Redis (ioredis), JWT, Google APIs
- **Build:** TypeScript, tsc-alias
- **Quality:** ESLint, Prettier, Husky
- **Monitoring:** Sentry, Winston

## 🔍 Quality Gates

Before deployment, the following checks must pass:

1. ✅ **Dependencies Verification** - All required packages installed
2. ✅ **TypeScript Strict Check** - No type errors
3. ✅ **Linting** - Code follows ESLint rules (warnings allowed)
4. ✅ **Render Simulation** - Build process works as expected

Run all checks: `npm run pre-push`

## 🚀 Deployment (Render.com)

The Render deployment uses:

- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

Environment variables must be set in Render Dashboard (see `.env.production.example` for the list).

## 🐛 Debugging

### Check if dependencies are properly installed:

```bash
ls backend/node_modules | wc -l
# Should show ~462 packages
```

### Verify TypeScript can find shared module:

```bash
cd backend
npm run typecheck
```

### Test the build locally:

```bash
cd backend
npm run build:clean
npm start
```

### Simulate Render deployment:

```bash
cd backend
npm run render:simulate
```
