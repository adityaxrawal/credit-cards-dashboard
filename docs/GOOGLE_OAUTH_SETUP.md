# Google OAuth Setup Guide

## 🔐 Complete Guide to Setting Up Google OAuth Authentication

This guide walks you through configuring Google OAuth for the Credit Card Dashboard application.

---

## Prerequisites

- Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown (top left)
3. Click **"New Project"**
4. Enter project name: `Credit Card Dashboard`
5. Click **"Create"**

---

## Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for and enable the following APIs:
   - **Gmail API** (for reading transaction emails)
   - **Google+ API** (for user profile information)

---

## Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Choose **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**

### Fill in the following:

**App Information:**

- App name: `Credit Card Dashboard`
- User support email: Your email address
- Developer contact email: Your email address

**App Domain (Optional for development):**

- Application home page: `http://localhost:3000`
- Application privacy policy: Leave blank for now
- Application terms of service: Leave blank for now

**Scopes:**
Click **"Add or Remove Scopes"** and add:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

**Test Users (Important for development):**

- Click **"Add Users"**
- Add your Gmail address (the one you'll use for testing)
- This is required because your app is in "Testing" mode

4. Click **"Save and Continue"** through all steps

---

## Step 4: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. Choose **"Web application"**

### Configure the OAuth Client:

**Name:** `Credit Card Dashboard Web Client`

**Authorized JavaScript origins:**

- `http://localhost:3000` (for development)
- `https://your-production-domain.com` (when you deploy)

**Authorized redirect URIs:**

- `http://localhost:3000/login` (for development)
- `https://your-production-domain.com/login` (when you deploy)

4. Click **"Create"**
5. **Save the Client ID and Client Secret** - you'll need these!

---

## Step 5: Update Environment Variables

### Frontend (.env.local)

```bash
# Frontend Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Google OAuth Client ID (from Step 4)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Backend (.env)

```bash
# Google OAuth Client ID (same as frontend)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Google OAuth Client Secret (NEVER expose to frontend!)
GOOGLE_CLIENT_SECRET=your-client-secret

# OAuth redirect URI (must match Google Console exactly!)
GOOGLE_REDIRECT_URI=http://localhost:3000/login
```

---

## Step 6: Test the OAuth Flow

1. **Start the backend:**

   ```bash
   cd backend/services/api-gateway
   npm run dev
   ```

2. **Start the frontend:**

   ```bash
   cd frontend
   npm run dev
   ```

3. **Test login:**
   - Open http://localhost:3000/login
   - Click "Continue with Google"
   - You should see the Google OAuth consent screen
   - Sign in with the test user you added in Step 3
   - You should be redirected back to the dashboard

---

## Troubleshooting

### Error: "Access blocked: Authorization error"

**Cause:** The redirect URI doesn't match what's configured in Google Console.

**Solution:**

1. Check that `GOOGLE_REDIRECT_URI` in backend `.env` matches exactly what's in Google Console
2. Ensure `NEXT_PUBLIC_APP_URL` in frontend `.env.local` is correct
3. The redirect URI should be: `http://localhost:3000/login` (no trailing slash)

### Error: "invalid_request"

**Causes:**

1. Missing or incorrect Client ID
2. Missing scopes
3. Redirect URI mismatch

**Solution:**

1. Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly in frontend
2. Check that all required scopes are added in Google Console
3. Ensure redirect URI matches exactly (case-sensitive, no extra slashes)

### Error: "This app isn't verified"

**Cause:** Your app is in "Testing" mode and requires adding test users.

**Solution:**

1. Go to OAuth consent screen in Google Console
2. Add your Gmail address under "Test users"
3. Alternatively, click "Continue" on the warning screen (only for testing)

### Error: "Failed to exchange code for tokens"

**Cause:** Backend `GOOGLE_CLIENT_SECRET` is incorrect or missing.

**Solution:**

1. Verify `GOOGLE_CLIENT_SECRET` in backend `.env`
2. Regenerate the secret in Google Console if needed

---

## Production Deployment

When deploying to production (e.g., Vercel + Render):

1. **Update Google Console:**
   - Add production domain to Authorized JavaScript origins:
     - `https://your-app.vercel.app`
   - Add production redirect URI:
     - `https://your-app.vercel.app/login`

2. **Update Environment Variables:**
   - **Vercel (Frontend):**
     - `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app`
     - `NEXT_PUBLIC_API_URL=https://your-api.onrender.com`
     - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id`
   - **Render (Backend):**
     - `GOOGLE_CLIENT_ID=your-client-id`
     - `GOOGLE_CLIENT_SECRET=your-client-secret`
     - `GOOGLE_REDIRECT_URI=https://your-app.vercel.app/login`

3. **Publish Your App (Optional):**
   - To remove the "This app isn't verified" warning
   - Go to OAuth consent screen > "Publish App"
   - This requires Google's review (takes 1-2 weeks)
   - Not required for personal use with test users

---

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Client Secret is HIGHLY SENSITIVE** - only store in backend
3. **Use HTTPS in production** - never use HTTP for OAuth
4. **Rotate secrets regularly** - regenerate Client Secret periodically
5. **Limit scopes** - only request Gmail read access, not write
6. **Monitor usage** - check Google Cloud Console for API quota usage

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) - for testing scopes

---

## Need Help?

If you encounter issues:

1. Check the console logs in browser (F12)
2. Check backend logs for error messages
3. Verify all environment variables are set correctly
4. Ensure test user is added in Google Console
5. Try regenerating the OAuth credentials

**Common mistake:** Forgetting to add yourself as a test user in the OAuth consent screen!
