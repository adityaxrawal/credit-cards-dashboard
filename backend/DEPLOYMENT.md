# Backend Deployment Guide - Render

Quick deployment guide for Credit Card Dashboard backend on Render (Singapore region).

## 🚀 Quick Deploy

```bash
# 1. Generate JWT secrets
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # JWT_REFRESH_SECRET

# 2. Push to GitHub
git push origin main

# 3. Deploy on Render
# Go to: https://dashboard.render.com/
# Create Web Service → Connect repo → Configure
```

## 📋 Render Configuration

**Service Settings:**

- Name: `credit-card-api-gateway`
- Region: **Singapore**
- Branch: `main` or `dev-v1`
- Root Directory: `backend/services/api-gateway`
- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm start` ⚠️ **NOT `npm run dev`!**
- Plan: Free (or Starter for production)

**Important:** Make sure Start Command is `npm start` not `npm run dev` in Render dashboard!

## 🔐 Environment Variables

See `.env.production.example` for complete list. **Replace ALL placeholders!**

### Required Variables:

| Variable                 | Get From                                          | Example                            |
| ------------------------ | ------------------------------------------------- | ---------------------------------- |
| `SUPABASE_URL`           | [Supabase](https://supabase.com/dashboard)        | `https://xxxxx.supabase.co`        |
| `GOOGLE_CLIENT_ID`       | [Google Cloud](https://console.cloud.google.com/) | `xxxxx.apps.googleusercontent.com` |
| `UPSTASH_REDIS_REST_URL` | [Upstash](https://console.upstash.com/)           | `https://xxxxx.upstash.io`         |
| `JWT_SECRET`             | Generate: `openssl rand -base64 32`               | Random 32-char string              |
| `FRONTEND_URL`           | Vercel deployment                                 | `https://your-app.vercel.app`      |

## ✅ Deployment Steps

1. **Prepare Secrets**

   ```bash
   # Generate JWT secrets (save these!)
   openssl rand -base64 32
   openssl rand -base64 32
   ```

2. **Create Render Service**
   - Go to https://dashboard.render.com/
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - Select `backend/services/api-gateway` as root directory

3. **Configure Environment**
   - Add ALL variables from `.env.production.example`
   - Replace placeholders with real credentials
   - **NEVER use development secrets in production!**

4. **Deploy**
   - Click "Create Web Service"
   - Wait for build (~3-5 min)
   - Check logs for errors

5. **Verify**

   ```bash
   curl https://your-service.onrender.com/health
   ```

6. **Update Frontend**
   - Add `NEXT_PUBLIC_API_URL` in Vercel
   - Point to your Render URL
   - Redeploy frontend

## ⚠️ Security Checklist

- [ ] Generated new JWT secrets (not from dev)
- [ ] Verified all credentials are production-specific
- [ ] Updated Google OAuth redirect URIs
- [ ] Set correct CORS_ORIGINS
- [ ] Checked no secrets in git history
- [ ] Enabled HTTPS only
- [ ] Set up error monitoring (Sentry/GlitchTip)

## 🔧 Troubleshooting

### ❌ "Out of Memory" / "Heap Limit" Error

**Problem:** Service crashes with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`

**Cause:** Running `npm run dev` (TypeScript compilation) instead of `npm start` (pre-compiled JS)

**Solution:**
1. Go to Render Dashboard → Settings
2. Change **Start Command** from `npm run dev` to `npm start`
3. Ensure **Build Command** is `npm install && npm run build`
4. Redeploy

### ❌ "No open ports detected"

**Problem:** Render can't detect the service port

**Cause:** Service not listening on PORT environment variable

**Solution:**
- Verify `PORT=10000` is set in Render environment variables
- Check your code uses `process.env.PORT`
- Ensure service actually starts (check logs)

### ❌ Build fails

**Problem:** Build command fails during deployment

**Solution:**
- Check logs for specific error
- Verify shared package builds first
- Ensure all dependencies in package.json
- Try building locally: `npm run build`

### ❌ Service crashes on start

**Problem:** Service starts but immediately crashes

**Solution:**
- Check environment variables are set
- Verify database connection string
- Check Supabase/Redis credentials
- Review error logs in Render dashboard

### ❌ CORS errors

**Problem:** Frontend can't connect to API

**Solution:**
- Verify `CORS_ORIGINS` matches frontend URL exactly
- Include protocol: `https://your-app.vercel.app`
- No trailing slashes
- Check `FRONTEND_URL` is also correct

### ⏰ Cold starts

**Info:** Free tier sleeps after 15 min inactivity (~30s wake time)

**Options:**
- Upgrade to paid tier for always-on
- Accept cold starts for free tier
- Don't use keep-alive pings (wastes bandwidth)

## 📚 Resources

- [Render Docs](https://render.com/docs)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Free Tier Limits](https://render.com/docs/free)

---

**For complete list of environment variables, see:** `.env.production.example`
