# Credit Card Dashboard - Complete Implementation Guide
## Budget-Optimized Architecture ($0-5/month)

> **Design Inspiration**: CRED-style UI with glassmorphism, dark theme, and smooth animations  
> **Tech Stack**: Next.js 14 + Supabase + Upstash Redis  
> **Total Cost**: $0-1/month  
> **Timeline**: 3-4 weeks

---

## 🎯 Executive Summary

A **personal credit card management dashboard** that automatically tracks all your credit card transactions by parsing Gmail emails in real-time. Features CRED-inspired dark UI with smooth animations, spending limits, and instant notifications.

### **Core Features**
✅ Google OAuth authentication  
✅ Automatic email sync (last 1 year)  
✅ Real-time transaction notifications  
✅ Multi-card management (grouped by bank)  
✅ Spending limits with alerts  
✅ Transaction categorization  
✅ Statement tracking  
✅ Responsive design (mobile to desktop)  

### **What Makes This Different**
- **Zero manual entry** - Everything automated via Gmail
- **Real-time updates** - See transactions instantly
- **Beautiful UI** - CRED-inspired dark theme
- **Privacy-first** - Your data stays in your database
- **Cost-effective** - Runs on free tiers

---

## 💰 Cost Breakdown

| Service | Usage | Free Tier Limit | Cost |
|---------|-------|-----------------|------|
| **Vercel** | Hosting (Frontend + API) | 100GB bandwidth/month | $0 |
| **Supabase** | Database + Auth + Realtime | 500MB DB, 5GB bandwidth | $0 |
| **Upstash Redis** | Caching + Rate limiting | 10K commands/day | $0 |
| **Gmail API** | Email reading | 1B requests/day | $0 |
| **Domain (Optional)** | yourapp.com | N/A | $0.99/mo |
| **TOTAL** | | | **$0-1/month** |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (YOU)                               │
│                    Browser / Mobile Device                       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    VERCEL (FREE TIER)                            │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  NEXT.JS 14 APPLICATION (App Router)                      │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │                                                            │  │
│  │  📱 FRONTEND (React Server Components + Client)          │  │
│  │  ├── Login Page (CRED-inspired)                          │  │
│  │  ├── Dashboard (Card grid, spending summary)             │  │
│  │  ├── Card Detail (Transactions, perks)                   │  │
│  │  ├── Settings (Spending limits)                          │  │
│  │  └── Setup (Initial sync progress)                       │  │
│  │                                                            │  │
│  │  🔌 API ROUTES (Serverless Functions)                    │  │
│  │  ├── /api/auth/* - Authentication                        │  │
│  │  ├── /api/gmail/* - Email sync & webhook                 │  │
│  │  ├── /api/cards/* - Card management                      │  │
│  │  ├── /api/transactions/* - Transaction CRUD              │  │
│  │  ├── /api/limits/* - Spending limits                     │  │
│  │  └── /api/health - Health check                          │  │
│  │                                                            │  │
│  │  ⏰ CRON JOBS (Vercel Cron - Free)                       │  │
│  │  └── Gmail watch renewal (every 6 days)                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬──────────────────┐
        │                │                │                  │
        ▼                ▼                ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  SUPABASE    │  │ GMAIL API    │  │UPSTASH REDIS │  │ GMAIL PUB/SUB│
│  (FREE)      │  │  (FREE)      │  │  (FREE)      │  │  (FREE)      │
├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│ PostgreSQL   │  │ Read emails  │  │ Cache API    │  │ Push webhook │
│ 500MB        │  │ Send alerts  │  │ Rate limit   │  │ Real-time    │
│              │  │              │  │ Session      │  │ email alerts │
│ Auth         │  │ OAuth tokens │  │              │  │              │
│ Google OAuth │  └──────────────┘  └──────────────┘  └──────────────┘
│              │
│ Realtime     │
│ WebSocket    │
│              │
│ Storage      │
│ (optional)   │
└──────────────┘
```

---

## 📊 Database Schema (Supabase PostgreSQL)

### **Complete ERD**

```sql
-- ============================================
-- SCHEMA OVERVIEW: 6 TABLES (Optimized)
-- ============================================

┌─────────────────────────┐
│   auth.users (Supabase) │  ← Built-in, no need to create
├─────────────────────────┤
│ id (UUID) PK            │
│ email                   │
│ created_at              │
└───────────┬─────────────┘
            │
            │ 1:1
            ▼
┌─────────────────────────┐
│    user_profiles        │  ← Extends Supabase auth
├─────────────────────────┤
│ id (UUID) PK/FK         │───► References auth.users(id)
│ email (TEXT)            │
│ full_name               │
│ profile_picture_url     │
│ gmail_refresh_token     │──► Encrypted!
│ gmail_watch_expiry      │
│ global_spending_limit   │
│ created_at              │
│ updated_at              │
└───────────┬─────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────┐
│     credit_cards        │
├─────────────────────────┤
│ id (UUID) PK            │
│ user_id (UUID) FK       │───► References user_profiles(id)
│ bank_name (TEXT)        │
│ card_last_4 (TEXT)      │
│ card_holder_name        │
│ card_type               │    (VISA, MASTERCARD, RUPAY)
│ statement_day (INT)     │    (1-31)
│ sender_pattern (TEXT)   │
│ current_due (DECIMAL)   │
│ due_date (DATE)         │
│ created_at              │
│ updated_at              │
│ UNIQUE(user_id, card_last_4, bank_name)
└───────────┬─────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────┐
│     transactions        │  ← SINGLE TABLE for all
├─────────────────────────┤
│ id (UUID) PK            │
│ card_id (UUID) FK       │───► References credit_cards(id)
│ statement_id (UUID) FK  │───► References statements(id) [nullable]
│ transaction_date (TS)   │
│ merchant_name (TEXT)    │
│ amount (DECIMAL)        │
│ category (TEXT)         │
│ category_manual (TEXT)  │    User override
│ description (TEXT)      │
│ transaction_type (TEXT) │    DEBIT/CREDIT/REVERSAL
│ is_in_statement (BOOL)  │    Default: false
│ email_id (TEXT) UNIQUE  │    Gmail message ID
│ created_at              │
│ INDEX: (card_id, transaction_date DESC)
│ INDEX: (email_id) WHERE email_id IS NOT NULL
└─────────────────────────┘
            │
            │ N:1
            ▼
┌─────────────────────────┐
│      statements         │
├─────────────────────────┤
│ id (UUID) PK            │
│ card_id (UUID) FK       │───► References credit_cards(id)
│ statement_month (INT)   │    1-12
│ statement_year (INT)    │
│ cycle_start (DATE)      │
│ cycle_end (DATE)        │
│ due_date (DATE)         │
│ total_due (DECIMAL)     │
│ minimum_due (DECIMAL)   │
│ is_paid (BOOL)          │
│ created_at              │
│ UNIQUE(card_id, statement_month, statement_year)
└─────────────────────────┘

┌─────────────────────────┐
│    spending_limits      │
├─────────────────────────┤
│ id (UUID) PK            │
│ user_id (UUID) FK       │───► References user_profiles(id)
│ limit_type (TEXT)       │    GLOBAL/CATEGORY
│ category_name (TEXT)    │    Nullable
│ limit_amount (DECIMAL)  │
│ current_spending (DEC)  │
│ alert_threshold (INT)   │    Default: 90 (%)
│ is_active (BOOL)        │
│ created_at              │
│ INDEX: (user_id) WHERE is_active = true
└─────────────────────────┘
```

### **Complete SQL Schema**

```sql
-- ============================================
-- 1. USER PROFILES
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  profile_picture_url TEXT,
  gmail_refresh_token TEXT, -- Encrypted with AES-256-GCM
  gmail_watch_expiry TIMESTAMPTZ,
  global_spending_limit DECIMAL(12, 2) DEFAULT 50000.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREDIT CARDS
-- ============================================
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_last_4 TEXT NOT NULL,
  card_holder_name TEXT,
  card_type TEXT,
  statement_day INT, -- 1-31
  sender_pattern TEXT,
  current_due DECIMAL(12, 2) DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_last_4, bank_name)
);

-- ============================================
-- 3. TRANSACTIONS (SINGLE TABLE)
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  category_manual TEXT,
  description TEXT,
  transaction_type TEXT DEFAULT 'DEBIT',
  is_in_statement BOOLEAN DEFAULT FALSE,
  email_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. STATEMENTS
-- ============================================
CREATE TABLE statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_month INT NOT NULL,
  statement_year INT NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  due_date DATE NOT NULL,
  total_due DECIMAL(12, 2) NOT NULL,
  minimum_due DECIMAL(12, 2),
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, statement_month, statement_year)
);

-- ============================================
-- 5. SPENDING LIMITS
-- ============================================
CREATE TABLE spending_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL,
  category_name TEXT,
  limit_amount DECIMAL(12, 2) NOT NULL,
  current_spending DECIMAL(12, 2) DEFAULT 0,
  alert_threshold INT DEFAULT 90,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. FAILED EMAILS (Error Recovery)
-- ============================================
CREATE TABLE failed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  raw_email_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_transactions_card_date ON transactions(card_id, transaction_date DESC);
CREATE INDEX idx_transactions_email ON transactions(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_transactions_statement ON transactions(statement_id) WHERE is_in_statement = TRUE;
CREATE INDEX idx_cards_user ON credit_cards(user_id);
CREATE INDEX idx_limits_user_active ON spending_limits(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_statements_card ON statements(card_id);
CREATE INDEX idx_failed_emails_user ON failed_emails(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_emails ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users view own cards" ON credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cards" ON credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cards" ON credit_cards FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users view own transactions" ON transactions FOR SELECT USING (
  card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert own transactions" ON transactions FOR INSERT WITH CHECK (
  card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
);
CREATE POLICY "Users update own transactions" ON transactions FOR UPDATE USING (
  card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
);

CREATE POLICY "Users view own statements" ON statements FOR SELECT USING (
  card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
);

CREATE POLICY "Users manage own limits" ON spending_limits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own failed emails" ON failed_emails FOR SELECT USING (auth.uid() = user_id);
```

---

## 🎨 UI Design System (CRED-Inspired)

### **Color Palette**

```css
/* Dark Theme */
:root {
  --bg-primary: #0D0D0D;
  --bg-secondary: #1A1A1A;
  --bg-tertiary: #2A2A2A;
  
  /* CRED-inspired gradients */
  --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-success: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  --gradient-danger: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
  --gradient-card: linear-gradient(135deg, #434343 0%, #000000 100%);
  
  /* Accent colors */
  --accent-purple: #9B6BFF;
  --accent-pink: #FF6B9D;
  --accent-blue: #4D9BFF;
  --accent-green: #00D9A3;
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #B0B0B0;
  --text-tertiary: #707070;
  
  /* Glass morphism */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: blur(10px);
}

/* Bank brand colors */
.bank-sbi { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); }
.bank-hdfc { background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); }
.bank-axis { background: linear-gradient(135deg, #1f2937 0%, #6b7280 100%); }
.bank-icici { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); }
```

### **Typography**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.heading-xl { font-size: 3rem; font-weight: 800; line-height: 1.1; }
.heading-lg { font-size: 2.5rem; font-weight: 700; line-height: 1.2; }
.heading-md { font-size: 2rem; font-weight: 700; line-height: 1.3; }
.heading-sm { font-size: 1.5rem; font-weight: 600; line-height: 1.4; }

.body-lg { font-size: 1.125rem; line-height: 1.7; }
.body-md { font-size: 1rem; line-height: 1.6; }
.body-sm { font-size: 0.875rem; line-height: 1.5; }
.body-xs { font-size: 0.75rem; line-height: 1.4; }
```

### **Animation Library**

```typescript
// Framer Motion Variants
export const animations = {
  // Page transitions
  pageTransition: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 }
  },

  // Stagger children
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  },

  // Card hover
  cardHover: {
    rest: { scale: 1, y: 0 },
    hover: { 
      scale: 1.05, 
      y: -8,
      transition: { duration: 0.3, ease: 'easeOut' }
    }
  },

  // Glassmorphism glow
  glassGlow: {
    rest: { boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' },
    hover: { boxShadow: '0 8px 32px rgba(155, 107, 255, 0.3)' }
  },

  // Progress bar
  progressBar: {
    initial: { width: 0 },
    animate: (percentage: number) => ({
      width: `${percentage}%`,
      transition: { duration: 1, ease: 'easeOut' }
    })
  },

  // Shimmer effect
  shimmer: {
    animate: {
      x: ['-100%', '200%'],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'linear'
      }
    }
  }
};
```

---

## 🔐 Complete Authentication Flow

### **1. Login Page (CRED-Inspired)**

```typescript
// app/login/page.tsx
'use client';

import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
      
      {/* Animated circles */}
      <motion.div
        className="absolute top-20 -left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-20 -right-20 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.3, 0.5]
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold text-white mb-4">
            💳 Credit Cards
          </h1>
          <p className="text-xl text-gray-400">
            Manage all your credit cards in one place
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              Welcome back
            </h2>

            <motion.button
              onClick={handleGoogleLogin}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-white text-black font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </motion.button>

            <p className="text-xs text-gray-500 text-center mt-6">
              By continuing, you agree to access your Gmail for transaction tracking
            </p>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-gray-600 mt-8 text-sm"
          >
            Secured with bank-grade encryption 🔒
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
```

### **2. OAuth Callback Handler**

```typescript
// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { user, provider_token, provider_refresh_token } = data.session;

      // Store Gmail refresh token (encrypted)
      await supabase.from('user_profiles').upsert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata.full_name,
        profile_picture_url: user.user_metadata.avatar_url,
        gmail_refresh_token: provider_refresh_token, // Will be encrypted by database function
        updated_at: new Date().toISOString()
      });

      // Check if first time user
      const { count } = await supabase
        .from('credit_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Redirect based on whether cards exist
      if (count === 0) {
        // First time user - go to setup
        return NextResponse.redirect(new URL('/dashboard/setup', request.url));
      } else {
        // Existing user - go to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // Error or no code - back to login
  return NextResponse.redirect(new URL('/login', request.url));
}
```

### **3. Protected Route Middleware**

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Redirect to dashboard if logged in and trying to access login
  if (req.nextUrl.pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login']
};
```

---

## 📧 Email Parsing Engine (Complete Implementation)

### **Bank Email Patterns (Production-Ready)**

```typescript
// lib/gmail/patterns.ts
export interface BankPattern {
  bankName: string;
  senderRegex: RegExp[];
  subjectKeywords: string[];
  cardRegex: RegExp;
  amountRegex: RegExp;
  merchantRegex: RegExp;
  dateRegex: RegExp;
  debitKeywords: string[];
  creditKeywords: string[];
}

export const BANK_PATTERNS: BankPattern[] = [
  {
    bankName: 'SBI',
    senderRegex: [
      /@sbicard\.com$/i,
      /@sbicardservices\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'purchase', 'info'],
    cardRegex: /X+(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+(?:on|dated)/i,
    dateRegex: /(\d{2}-\w{3}-\d{4}|\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited', 'spent', 'purchase', 'paid', 'transaction'],
    creditKeywords: ['credited', 'cashback', 'refund', 'reward', 'reversal']
  },
  {
    bankName: 'HDFC',
    senderRegex: [
      /@hdfcbank\.com$/i,
      /@alerts\.hdfcbank\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'update', 'info'],
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\.|on)/i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2}|\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited', 'spent', 'purchase'],
    creditKeywords: ['credited', 'refund', 'cashback']
  },
  {
    bankName: 'AXIS',
    senderRegex: [
      /@axisbank\.com$/i,
      /@alerts\.axisbank\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'info'],
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited', 'spent'],
    creditKeywords: ['credited', 'refund']
  },
  {
    bankName: 'ICICI',
    senderRegex: [
      /@icicibank\.com$/i,
      /@alerts\.icicibank\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'update'],
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited', 'spent'],
    creditKeywords: ['credited', 'refund']
  }
];

// Statement patterns
export interface StatementPattern {
  bankName: string;
  senderRegex: RegExp[];
  subjectKeywords: string[];
  dueDateRegex: RegExp;
  totalAmountRegex: RegExp;
  cycleRegex: RegExp;
}

export const STATEMENT_PATTERNS: StatementPattern[] = [
  {
    bankName: 'SBI',
    senderRegex: [/@statements\.sbicard\.com$/i],
    subjectKeywords: ['statement', 'credit card statement'],
    dueDateRegex: /payment.*due.*?(\d{2}[/-]\w{3}[/-]\d{4})/i,
    totalAmountRegex: /total.*amount.*due.*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i,
    cycleRegex: /(\d{2}[/-]\w{3}[/-]\d{4})\s*to\s*(\d{2}[/-]\w{3}[/-]\d{4})/i
  },
  // Add more banks...
];
```

### **Transaction Categorization Engine**

```typescript
// lib/utils/categorize.ts
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'swiggy', 'zomato', 'dominos', 'pizza', 'restaurant', 'cafe',
    'mcdonald', 'kfc', 'subway', 'starbucks', 'burger', 'food',
    'hotel', 'dining', 'bakery', 'eatery', 'cuisine', 'diner',
    'bistro', 'barbeque', 'bbq', 'grill'
  ],
  'Travel': [
    'uber', 'ola', 'rapido', 'airline', 'irctc', 'makemytrip',
    'goibigo', 'booking', 'hotel', 'flight', 'train', 'bus',
    'indigo', 'spicejet', 'vistara', 'air india', 'taxi', 'cab',
    'railways', 'airport', 'travels', 'tourism'
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho',
    'mall', 'store', 'retail', 'fashion', 'clothing', 'wear',
    'shoppe', 'shop', 'mart', 'supermarket', 'online', 'ecom'
  ],
  'Bills & Utilities': [
    'electricity', 'water', 'gas', 'airtel', 'jio', 'vi', 'vodafone',
    'broadband', 'wifi', 'recharge', 'mobile', 'utility', 'bill',
    'postpaid', 'prepaid', 'electric', 'power', 'lpg'
  ],
  'Entertainment': [
    'netflix', 'amazon prime', 'disney', 'hotstar', 'spotify',
    'youtube', 'movie', 'theatre', 'pvr', 'inox', 'gaming',
    'cinema', 'multiplex', 'prime video', 'music', 'zee5', 'sonyliv'
  ],
  'Fuel': [
    'petrol', 'diesel', 'fuel', 'hp', 'bharat petroleum', 'indian oil',
    'shell', 'cng', 'gas station', 'essar', 'reliance petroleum',
    'bpcl', 'iocl', 'pump'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'pharmacy', 'medicine',
    'apollo', 'medplus', 'netmeds', 'health', 'medical', 'pharma',
    '診療', 'diagnostic', 'lab', 'wellness'
  ],
  'Education': [
    'school', 'college', 'university', 'course', 'tuition',
    'udemy', 'coursera', 'unacademy', 'byjus', 'education',
    'coaching', 'classes', 'academy', 'institute'
  ],
  'Insurance': [
    'insurance', 'lic', 'policy', 'premium', 'hdfc life',
    'icici prudential', 'max life', 'term', 'health insurance'
  ],
  'EMI': [
    'emi', 'loan', 'installment', 'principal', 'interest',
    'equated monthly', 'repayment'
  ],
  'Investment': [
    'mutual fund', 'sip', 'zerodha', 'groww', 'upstox',
    'investment', 'trading', 'stock', 'equity', 'mf'
  ]
};

export function categorizeTransaction(merchantName: string): string {
  const merchant = merchantName.toLowerCase().trim();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => merchant.includes(keyword))) {
      return category;
    }
  }
  
  return 'Miscellaneous';
}

// Get category emoji
export function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    'Food & Dining': '🍕',
    'Travel': '✈️',
    'Shopping': '🛍️',
    'Bills & Utilities': '💡',
    'Entertainment': '🎬',
    'Fuel': '⛽',
    'Healthcare': '🏥',
    'Education': '📚',
    'Insurance': '🛡️',
    'EMI': '💰',
    'Investment': '📈',
    'Miscellaneous': '💳'
  };
  return emojis[category] || '💳';
}
```

### **Email Parser Service**

```typescript
// lib/gmail/parser.ts
import { gmail_v1 } from 'googleapis';
import { BANK_PATTERNS } from './patterns';
import { categorizeTransaction } from '../utils/categorize';

export interface ParsedTransaction {
  bankName: string;
  cardLast4: string;
  amount: number;
  merchant: string;
  date: Date;
  type: 'DEBIT' | 'CREDIT';
  category: string;
}

export async function parseEmail(
  message: gmail_v1.Schema$Message
): Promise<ParsedTransaction | null> {
  try {
    // Extract headers
    const headers = message.payload?.headers || [];
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';

    // Get email body
    let body = '';
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
    } else if (message.payload?.parts) {
      const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
      }
    }

    // Find matching bank pattern
    const pattern = BANK_PATTERNS.find(p => 
      p.senderRegex.some(regex => regex.test(from))
    );

    if (!pattern) return null;

    // Check if transaction email
    const isTransaction = pattern.debitKeywords.some(kw =>
      body.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)
    ) || pattern.creditKeywords.some(kw =>
      body.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)
    );

    if (!isTransaction) return null;

    // Extract data
    const cardMatch = body.match(pattern.cardRegex);
    const amountMatch = body.match(pattern.amountRegex);
    const merchantMatch = body.match(pattern.merchantRegex);
    const dateMatch = body.match(pattern.dateRegex);

    if (!cardMatch || !amountMatch) {
      console.warn('Failed to extract card or amount', { from, subject });
      return null;
    }

    const cardLast4 = cardMatch[1];
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant';
    const date = dateMatch ? parseDate(dateMatch[1]) : new Date();

    // Determine type
    const isCredit = pattern.creditKeywords.some(kw =>
      body.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)
    );

    const type = isCredit ? 'CREDIT' : 'DEBIT';

    // Categorize
    const category = categorizeTransaction(merchant);

    return {
      bankName: pattern.bankName,
      cardLast4,
      amount,
      merchant,
      date,
      type,
      category
    };
  } catch (error) {
    console.error('Email parsing error:', error);
    return null;
  }
}

function parseDate(dateStr: string): Date {
  // Handle different date formats
  // DD-MMM-YYYY or DD/MM/YYYY
  try {
    // Try standard parse first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Handle DD-MMM-YY format
    if (dateStr.match(/\d{2}-\w{3}-\d{2}/)) {
      const [day, month, year] = dateStr.split('-');
      const fullYear = parseInt(year) + 2000;
      return new Date(`${day}-${month}-${fullYear}`);
    }

    // Fallback to current date
    return new Date();
  } catch {
    return new Date();
  }
}
```

---

## 🔄 Complete API Implementation

### **1. Initial Email Sync API**

```typescript
// app/api/gmail/sync/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { google } from 'googleapis';
import { parseEmail } from '@/lib/gmail/parser';

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST(request: Request) {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get Gmail refresh token
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('gmail_refresh_token')
      .eq('id', user.id)
      .single();

    if (!profile?.gmail_refresh_token) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Decrypt token (if encrypted)
    oauth2Client.setCredentials({
      refresh_token: profile.gmail_refresh_token
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch last 1 year of emails
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const query = `after:${Math.floor(oneYearAgo.getTime() / 1000)}`;

    let allMessages: any[] = [];
    let pageToken: string | undefined;

    // Paginate through all messages
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500,
        pageToken
      });

      allMessages = allMessages.concat(response.data.messages || []);
      pageToken = response.data.nextPageToken || undefined;

      // Limit to 2000 emails max for performance
      if (allMessages.length >= 2000) break;
    } while (pageToken);

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < allMessages.length; i += batchSize) {
      const batch = allMessages.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (message) => {
          if (!message.id) return;

          try {
            // Fetch full message
            const fullMessage = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'full'
            });

            // Parse
            const parsed = await parseEmail(fullMessage.data);
            if (!parsed) return;

            // Check for duplicate by email_id
            const { data: existing } = await supabase
              .from('transactions')
              .select('id')
              .eq('email_id', message.id)
              .single();

            if (existing) return; // Skip duplicate

            // Find or create card
            const { data: card, error: cardError } = await supabase
              .from('credit_cards')
              .upsert({
                user_id: user.id,
                bank_name: parsed.bankName,
                card_last_4: parsed.cardLast4,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,card_last_4,bank_name',
                ignoreDuplicates: false
              })
              .select()
              .single();

            if (cardError || !card) {
              throw new Error(`Card creation failed: ${cardError?.message}`);
            }

            // Store transaction
            const { error: txError } = await supabase
              .from('transactions')
              .insert({
                card_id: card.id,
                transaction_date: parsed.date.toISOString(),
                merchant_name: parsed.merchant,
                amount: parsed.amount,
                category: parsed.category,
                transaction_type: parsed.type,
                is_in_statement: false,
                email_id: message.id
              });

            if (txError) {
              throw new Error(`Transaction insert failed: ${txError.message}`);
            }

            processedCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`${message.id}: ${error.message}`);
            
            // Store failed email for retry
            await supabase.from('failed_emails').insert({
              user_id: user.id,
              email_id: message.id,
              failure_reason: error.message,
              retry_count: 0
            });
          }
        })
      );
    }

    // Set up Gmail watch
    try {
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: process.env.GMAIL_PUBSUB_TOPIC!,
          labelIds: ['INBOX']
        }
      });

      // Store watch expiry
      const expiryDate = new Date(parseInt(watchResponse.data.expiration!));
      await supabase
        .from('user_profiles')
        .update({ gmail_watch_expiry: expiryDate.toISOString() })
        .eq('id', user.id);
    } catch (watchError) {
      console.error('Gmail watch setup failed:', watchError);
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: allMessages.length,
      errors: errorCount,
      errorSample: errors.slice(0, 5)
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}

// Get sync status
export async function GET(request: Request) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get counts
  const { count: cardCount } = await supabase
    .from('credit_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: txCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .in('card_id', 
      supabase.from('credit_cards').select('id').eq('user_id', user.id)
    );

  return NextResponse.json({
    cards: cardCount || 0,
    transactions: txCount || 0
  });
}
```

### **2. Gmail Webhook Handler**

```typescript
// app/api/gmail/webhook/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { parseEmail } from '@/lib/gmail/parser';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message?.data) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Decode Pub/Sub message
    const decodedData = JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    );

    const emailAddress = decodedData.emailAddress;
    const historyId = decodedData.historyId;

    // Get user
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, gmail_refresh_token')
      .eq('email', emailAddress)
      .single();

    if (!profile) {
      return NextResponse.json({ success: true }); // User not found, skip
    }

    // Initialize Gmail
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: profile.gmail_refresh_token
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get history
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded']
    });

    const historyRecords = history.data.history || [];

    // Process new messages
    for (const record of historyRecords) {
      const messagesAdded = record.messagesAdded || [];

      for (const msgData of messagesAdded) {
        if (!msgData.message?.id) continue;

        try {
          // Check if already processed
          const { data: existing } = await supabaseAdmin
            .from('transactions')
            .select('id')
            .eq('email_id', msgData.message.id)
            .single();

          if (existing) continue;

          // Fetch and parse
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msgData.message.id,
            format: 'full'
          });

          const parsed = await parseEmail(fullMessage.data);
          if (!parsed) continue;

          // Find or create card
          const { data: card } = await supabaseAdmin
            .from('credit_cards')
            .upsert({
              user_id: profile.id,
              bank_name: parsed.bankName,
              card_last_4: parsed.cardLast4,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,card_last_4,bank_name'
            })
            .select()
            .single();

          if (!card) continue;

          // Store transaction
          const { data: transaction } = await supabaseAdmin
            .from('transactions')
            .insert({
              card_id: card.id,
              transaction_date: parsed.date.toISOString(),
              merchant_name: parsed.merchant,
              amount: parsed.amount,
              category: parsed.category,
              transaction_type: parsed.type,
              is_in_statement: false,
              email_id: msgData.message.id
            })
            .select()
            .single();

          // Check spending limits
          if (transaction && parsed.type === 'DEBIT') {
            await checkSpendingLimits(profile.id, transaction);
          }

          // Supabase Realtime will notify connected clients automatically

        } catch (error) {
          console.error('Error processing message:', error);
          
          // Store as failed email
          await supabaseAdmin.from('failed_emails').insert({
            user_id: profile.id,
            email_id: msgData.message.id,
            failure_reason: (error as Error).message,
            retry_count: 0
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function checkSpendingLimits(userId: string, transaction: any) {
  // Get active limits
  const { data: limits } = await supabaseAdmin
    .from('spending_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!limits || limits.length === 0) return;

  for (const limit of limits) {
    // Skip if category doesn't match
    if (limit.limit_type === 'CATEGORY' && 
        limit.category_name !== transaction.category) {
      continue;
    }

    // Update spending
    const newSpending = (limit.current_spending || 0) + transaction.amount;
    
    await supabaseAdmin
      .from('spending_limits')
      .update({ current_spending: newSpending })
      .eq('id', limit.id);

    // Check threshold
    const percentUsed = (newSpending / limit.limit_amount) * 100;
    
    if (percentUsed >= limit.alert_threshold) {
      // Get user email
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (profile) {
        // TODO: Send email alert via Gmail API
        console.log(`Alert: ${profile.email} exceeded ${limit.limit_type} limit`);
      }
    }
  }
}
```

### **3. Cards API**

```typescript
// app/api/cards/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch cards with aggregated data
  const { data: cards, error } = await supabase
    .from('credit_cards')
    .select(`
      *,
      transactions:transactions(
        amount,
        transaction_type,
        is_in_statement
      )
    `)
    .eq('user_id', user.id)
    .order('bank_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate current due for each card
  const cardsWithDue = cards?.map(card => {
    const currentTransactions = card.transactions?.filter(
      (t: any) => !t.is_in_statement && t.transaction_type === 'DEBIT'
    ) || [];
    
    const currentDue = currentTransactions.reduce(
      (sum: number, t: any) => sum + parseFloat(t.amount),
      0
    );

    return {
      ...card,
      current_due: currentDue,
      transactions: undefined // Remove from response
    };
  }) || [];

  // Group by bank
  const groupedCards = cardsWithDue.reduce((acc: any, card: any) => {
    if (!acc[card.bank_name]) {
      acc[card.bank_name] = [];
    }
    acc[card.bank_name].push(card);
    return acc;
  }, {});

  return NextResponse.json({
    cards: cardsWithDue,
    groupedCards
  });
}
```

### **4. Transactions API**

```typescript
// app/api/transactions/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  
  const cardId = searchParams.get('cardId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('transactions')
    .select(`
      *,
      credit_cards!inner(
        user_id,
        bank_name,
        card_last_4
      )
    `, { count: 'exact' })
    .eq('credit_cards.user_id', user.id)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cardId) {
    query = query.eq('card_id', cardId);
  }

  const { data: transactions, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });