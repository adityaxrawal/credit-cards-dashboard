# Google OAuth Fix - Summary

## 🔧 Issues Identified and Fixed

### Issue 1: Missing Frontend Environment Variables
**Problem:** Frontend `.env.local` was missing critical OAuth configuration variables.

**Fixed:**
- Added `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Added `NEXT_PUBLIC_GOOGLE_CLIENT_ID=498517995959-h7vqa9doq3adk7vm1n7rqb3nk1r5l2m4.apps.googleusercontent.com`
- Corrected `NEXT_PUBLIC_API_URL` from `http://localhost:3000` to `http://localhost:3001`

**File:** `/frontend/.env.local`

### Issue 2: Incorrect Backend Redirect URI
**Problem:** Backend had wrong `GOOGLE_REDIRECT_URI` pointing to Supabase callback instead of our app.

**Before:**
```
GOOGLE_REDIRECT_URI=https://ythuxanwxzdwtuwotcha.supabase.co/auth/v1/callback
```

**After:**
```
GOOGLE_REDIRECT_URI=http://localhost:3000/login
```

**File:** `/backend/services/api-gateway/.env`

### Issue 3: tsconfig-paths Not Working in Dev Mode
**Problem:** Backend dev server couldn't resolve `shared/*` path aliases, causing "Cannot find module" errors.

**Fixed:** Updated dev script to include `--project` flag:
```json
"dev": "nodemon --exec ts-node -r tsconfig-paths/register --project services/api-gateway/tsconfig.json services/api-gateway/src/index.ts"
```

**File:** `/backend/package.json`

---

## ✅ What Was Fixed

1. ✅ Frontend now has all required Google OAuth environment variables
2. ✅ Backend redirect URI correctly points to frontend login page
3. ✅ API URL properly configured (frontend → backend communication)
4. ✅ Backend dev server starts without module resolution errors
5. ✅ Created comprehensive setup documentation

---

## 📝 Files Created/Updated

### New Files:
1. `/docs/GOOGLE_OAUTH_SETUP.md` - Complete step-by-step OAuth setup guide
2. `/frontend/.env.example` - Template for frontend environment variables

### Updated Files:
1. `/frontend/.env.local` - Added missing OAuth config
2. `/backend/services/api-gateway/.env` - Fixed redirect URI
3. `/backend/.env.example` - Updated with correct OAuth examples
4. `/backend/package.json` - Fixed dev script tsconfig path

---

## 🧪 Testing the Fix

### 1. Prerequisites
Before testing, ensure you've completed the Google Cloud Console setup:
- ✅ OAuth consent screen configured
- ✅ OAuth 2.0 credentials created
- ✅ Authorized redirect URI includes: `http://localhost:3000/login`
- ✅ Test user (your Gmail) added to OAuth consent screen

**📖 See `/docs/GOOGLE_OAUTH_SETUP.md` for detailed instructions**

### 2. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Expected output:
```
API Gateway running on port 3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Expected output:
```
✓ Ready in 1574ms
Local: http://localhost:3000
```

### 3. Test OAuth Flow

1. **Open the login page:**
   - Navigate to `http://localhost:3000/login`
   - You should see the "Credit Card Dashboard" login page

2. **Click "Continue with Google":**
   - You should be redirected to Google's OAuth consent screen
   - **If you see "Access blocked: Authorization error":**
     - Check that `http://localhost:3000/login` is added to Authorized redirect URIs in Google Console
     - Verify your Gmail is added as a test user

3. **Sign in with Google:**
   - Select your Gmail account
   - Grant permissions (if prompted)

4. **Verify successful login:**
   - You should be redirected to `/dashboard`
   - Check browser cookies - should have `token` cookie set
   - Check browser console - no errors

### 4. Verify Backend Logs

Check the backend terminal for:
```
User authenticated successfully { userId: 'xxx-xxx-xxx' }
```

### 5. Test API Authentication

Open browser console and run:
```javascript
fetch('http://localhost:3001/api/auth/me', {
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "xxx-xxx-xxx",
      "email": "your-email@gmail.com",
      "name": "Your Name",
      "profilePicture": "...",
      "gmailConnected": false
    }
  }
}
```

---

## 🚨 Troubleshooting

### Error: "Access blocked: Authorization error"

**Cause:** Redirect URI mismatch in Google Console

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: APIs & Services → Credentials
3. Click your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/login` (for local development)
5. Click Save
6. Wait 1-2 minutes for changes to propagate
7. Try logging in again

### Error: "This app isn't verified"

**Cause:** Your app is in "Testing" mode

**Fix:**
1. Go to OAuth consent screen in Google Console
2. Under "Test users", add your Gmail address
3. Click Save
4. Try logging in again
5. When you see the warning, click "Continue" (only for testing)

### Error: "invalid_request"

**Possible causes:**
1. Missing `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in frontend
2. Mismatched redirect URI
3. Missing required scopes

**Fix:**
1. Check frontend `.env.local` has `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
2. Verify backend `.env` has `GOOGLE_REDIRECT_URI=http://localhost:3000/login`
3. Check Google Console has all required scopes (openid, email, profile, gmail.readonly)

### Backend: "Cannot find module 'shared/monitoring/logger'"

**Cause:** tsconfig-paths not working correctly

**Fix:** Already fixed in `/backend/package.json` dev script
- Ensure you're using the updated dev command with `--project` flag
- Restart the backend server

### Frontend: "TypeError: Cannot read property 'NEXT_PUBLIC_GOOGLE_CLIENT_ID' of undefined"

**Cause:** Environment variable not set

**Fix:**
1. Restart the frontend dev server: `npm run dev`
2. Environment variables are loaded at build/start time
3. Verify `.env.local` exists and has the correct values

---

## 🔒 Security Checklist

- ✅ `GOOGLE_CLIENT_SECRET` is only in backend `.env` (never in frontend)
- ✅ Frontend uses `NEXT_PUBLIC_` prefix for client-side variables
- ✅ `.env` files are in `.gitignore` (not committed to git)
- ✅ OAuth redirect URI uses exact match (no wildcards)
- ✅ Gmail scope is read-only (`gmail.readonly`)
- ✅ Test users are configured in Google Console (for testing mode)

---

## 📊 OAuth Flow Diagram

```
User clicks "Sign in with Google"
         ↓
Frontend constructs OAuth URL:
  - client_id: NEXT_PUBLIC_GOOGLE_CLIENT_ID
  - redirect_uri: NEXT_PUBLIC_APP_URL/login
  - scope: openid email profile gmail.readonly
  - response_type: code
  - access_type: offline
         ↓
Redirect to Google OAuth consent screen
         ↓
User grants permissions
         ↓
Google redirects back to: http://localhost:3000/login?code=xxx
         ↓
Frontend captures code from URL
         ↓
Frontend sends POST /api/auth/google { code }
         ↓
Backend exchanges code for tokens:
  - Using GOOGLE_CLIENT_ID
  - Using GOOGLE_CLIENT_SECRET
  - Using GOOGLE_REDIRECT_URI
         ↓
Backend creates/updates user in database
         ↓
Backend generates JWT token
         ↓
Backend sets httpOnly cookie
         ↓
Backend returns user data
         ↓
Frontend redirects to /dashboard
         ↓
✅ User is authenticated!
```

---

## 🎯 Next Steps

After successful login:
1. Navigate to `/dashboard` to see the main interface
2. Click "Sync Gmail" to extract credit card transactions
3. Add credit cards manually if needed
4. Explore transaction tracking, analytics, and budgets

---

## 📚 Additional Resources

- **OAuth Setup Guide:** `/docs/GOOGLE_OAUTH_SETUP.md`
- **Architecture Guide:** `/docs/updated-architecture.md`
- **Frontend .env Template:** `/frontend/.env.example`
- **Backend .env Template:** `/backend/.env.example`

---

## 🤝 Support

If you encounter issues not covered here:
1. Check browser console for frontend errors (F12)
2. Check backend terminal for server errors
3. Verify all environment variables are set correctly
4. Ensure Google Cloud Console configuration matches exactly
5. Try regenerating OAuth credentials if all else fails

**Common Mistake:** Forgetting to add yourself as a test user in OAuth consent screen!

---

## ✨ Success Indicators

You'll know everything is working when:
- ✅ Login page loads without errors
- ✅ Clicking "Continue with Google" redirects to Google
- ✅ After signing in, you're redirected to `/dashboard`
- ✅ Browser has `token` cookie set
- ✅ `/api/auth/me` returns your user data
- ✅ Backend logs show "User authenticated successfully"

**Status:** All issues fixed ✅ Ready for testing!
