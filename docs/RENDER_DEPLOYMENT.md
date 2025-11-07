# Render Deployment Guide

## 🚀 Quick Start

### Method 1: Using render.yaml (Recommended)

1. Push your code with the `render.yaml` file in the root directory
2. In Render Dashboard:
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select the `prod` branch
   - Render will automatically read `render.yaml` and configure everything

3. Add secret environment variables in Render Dashboard (these have `sync: false` in render.yaml):
   - `FRONTEND_URL`
   - `CORS_ORIGINS`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `REDIS_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `ENCRYPTION_KEY`

### Method 2: Manual Setup

If you prefer manual setup or need to troubleshoot:

#### Required Settings in Render Dashboard:

1. **Service Type**: Web Service
2. **Branch**: `prod`
3. **Root Directory**: Leave empty (or `.`)
4. **Runtime**: Node
5. **Build Command**:
   ```bash
   cd backend && npm install --include=dev && npm run build
   ```
6. **Start Command**:
   ```bash
   cd backend && npm start
   ```
7. **Region**: Singapore (or your preferred region)
8. **Plan**: Free (or upgrade as needed)

#### Environment Variables:

Copy all variables from `backend/.env.production.example` and set them in Render Dashboard with your actual values.

**Critical Variables:**

```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_secret
ENCRYPTION_KEY=your_32_char_key
```

## 🔍 Common Issues & Solutions

### Issue 1: "Cannot find type definition file" errors

**Solution**: Use `npm install --include=dev` to ensure TypeScript and type definitions are installed during build.

### Issue 2: "Cannot find module" errors

**Solution**: Ensure the build command includes `cd backend` before running npm commands.

### Issue 2: Port binding issues

**Solution**: Use `PORT=10000` in environment variables (Render uses port 10000).

### Issue 3: CORS errors

**Solution**: Make sure `CORS_ORIGINS` matches your frontend URL exactly (no trailing slashes).

### Issue 4: Build fails with "husky not found"

**Solution**: Already fixed! The root `package.json` has `prepare: "husky install || true"`.

### Issue 5: Redis connection issues

**Solution**: Use `USE_REDIS_REST_API=true` and provide `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

## 📁 Project Structure

```
/
├── render.yaml              # Render Blueprint configuration
├── backend/
│   ├── package.json         # Backend dependencies & scripts
│   ├── .env.production.example  # Example production env vars
│   └── services/
│       └── api-gateway/
│           └── dist/        # Built files (created during build)
└── frontend/                # Not deployed on Render
```

## 🧪 Testing Locally Before Deployment

Run the Render simulation script to catch issues:

```bash
cd backend
npm run render:simulate
```

This will:

1. Clean previous builds
2. Install dependencies (like Render does)
3. Build TypeScript
4. Verify the built files can start

## 🔄 Deployment Workflow

1. **Make changes** on your local `dev-v1` branch
2. **Test locally**: `cd backend && npm run dev`
3. **Simulate Render**: `npm run render:simulate`
4. **Push to GitHub**: `git push origin dev-v1`
5. **Merge to prod**: Create PR from `dev-v1` → `prod`
6. **Render auto-deploys** when `prod` branch updates

## 📊 Monitoring

After deployment:

- Check Render logs for startup messages
- Test API endpoints: `https://your-service.onrender.com/health`
- Monitor error tracking (if Sentry/GlitchTip enabled)

## 🔐 Security Checklist

- ✅ All secrets stored in Render Environment Variables (not in code)
- ✅ `NODE_ENV=production` set
- ✅ CORS configured with specific origins (no wildcards)
- ✅ Rate limiting enabled
- ✅ JWT secrets are strong and unique
- ✅ Database uses connection pooling (Supabase pooler)

## 📞 Support

If you encounter issues:

1. Check Render logs for error messages
2. Run `npm run render:simulate` locally to reproduce
3. Verify all environment variables are set correctly
4. Check that `prod` branch is up to date
