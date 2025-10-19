# Credit Card Dashboard - Phased Implementation Guide

## 📋 Overview

This document breaks down the entire application into **6 distinct phases**, each with clear deliverables, testable outcomes, and complete isolation from other phases. Perfect for GitHub Copilot to work on one phase at a time.

**Total Timeline**: 2-3 weeks  
**Budget**: $0-1/month  
**Architecture**: Next.js 14 + Supabase + Upstash Redis

---

## 🎯 Phase 0: Initial Setup & Configuration (Day 1 - 2 hours)

### **Goal**: Set up all external services and project structure

### **Tasks**:

#### **0.1: Create Supabase Project**
```bash
# Go to https://supabase.com
# Sign up (free, no credit card)
# Click "New Project"
# Project Name: credit-card-dashboard
# Database Password: [generate strong password]
# Region: [closest to you]
# Wait 2 minutes for provisioning

# Save these credentials:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

#### **0.2: Create Upstash Redis**
```bash
# Go to https://upstash.com
# Sign up with GitHub/Google
# Click "Create Database"
# Name: credit-card-cache
# Type: Regional
# Region: [closest to Vercel region]
# Click Create

# Save these:
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=AaaaBbb...
```

#### **0.3: Set Up Google Cloud Project**
```bash
# Go to https://console.cloud.google.com
# Create new project: credit-card-dashboard
# Enable Gmail API:
#   - Go to "APIs & Services" > "Library"
#   - Search "Gmail API"
#   - Click Enable

# Create OAuth Credentials:
#   - Go to "APIs & Services" > "Credentials"
#   - Click "Create Credentials" > "OAuth client ID"
#   - Application type: Web application
#   - Name: Credit Card Dashboard
#   - Authorized redirect URIs: http://localhost:3000/api/auth/callback/google
#   - Click Create

# Save these:
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

#### **0.4: Create Vite Project**
```bash
# Create project in current directory
npm create vite@latest . -- --template react-ts

# Install core dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-react @supabase/auth-ui-react @supabase/auth-ui-shared
npm install @upstash/redis
npm install googleapis
npm install framer-motion lucide-react
npm install react-hot-toast
npm install date-fns
npm install zod
npm install react-router-dom

# Install dev dependencies
npm install -D tailwindcss postcss autoprefixer @types/node
```

#### **0.5: Create Environment File**
```bash
# Create .env.local
touch .env.local

# Add all credentials (see full file below)
```

**Complete .env.local file**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth & Gmail API
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Upstash Redis
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Encryption (for sensitive data)
ENCRYPTION_KEY=generate-with-openssl-rand-hex-32
```

#### **0.6: Create Project Structure**
```bash
# Create folder structure
mkdir -p src/api/{auth,gmail,cards,transactions,limits}
mkdir -p src/components/{ui,dashboard}
mkdir -p src/lib/{supabase,gmail,utils}
mkdir -p src/types
mkdir -p src/hooks
mkdir -p src/pages

# Create placeholder files
touch src/lib/supabase/client.ts
touch src/lib/gmail/parser.ts
touch src/lib/redis.ts
touch src/types/database.ts
```

### **Deliverables**:
- ✅ All services created and accessible
- ✅ Environment variables configured
- ✅ Next.js project initialized
- ✅ Dependencies installed
- ✅ Folder structure ready

### **Testing**:
```bash
# Test Next.js runs
npm run dev
# Should see: "ready started server on 0.0.0.0:3000"

# Visit http://localhost:3000
# Should see default Next.js page
```

### **Commit Message**:
```
chore: initial project setup with all services configured
```

---

## 🔐 Phase 1: Authentication & Database Setup (Day 2 - 4 hours)

### **Goal**: Implement Google authentication and create database schema

### **Tasks**:

#### **1.1: Set Up Supabase Database Schema**

**File**: `supabase/schema.sql`

```sql
-- Run this in Supabase SQL Editor

-- 1. User Profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  profile_picture_url TEXT,
  global_spending_limit DECIMAL(12, 2) DEFAULT 50000,
  gmail_refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Credit Cards
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_last_4 TEXT NOT NULL,
  card_holder_name TEXT,
  card_type TEXT,
  statement_day INT,
  sender_pattern TEXT,
  current_due DECIMAL(12, 2) DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_last_4, bank_name)
);

-- 3. Transactions (single table for all)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  transaction_type TEXT DEFAULT 'DEBIT',
  is_in_statement BOOLEAN DEFAULT FALSE,
  email_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Statements
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

-- 5. Spending Limits
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

-- Create Indexes
CREATE INDEX idx_transactions_card_date ON transactions(card_id, transaction_date DESC);
CREATE INDEX idx_transactions_email ON transactions(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_cards_user ON credit_cards(user_id);
CREATE INDEX idx_limits_user_active ON spending_limits(user_id) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own cards" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON credit_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON credit_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own statements" ON statements
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own limits" ON spending_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own limits" ON spending_limits
  FOR ALL USING (auth.uid() = user_id);
```

#### **1.2: Configure Supabase Authentication**

In Supabase Dashboard:
1. Go to **Authentication** > **Providers**
2. Enable **Google** provider
3. Add Google Client ID and Secret from Phase 0
4. In **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**`

#### **1.3: Create Supabase Client Utilities**

**File**: `lib/supabase/client.ts`
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';

export function createClient() {
  return createClientComponentClient<Database>();
}
```

**File**: `lib/supabase/server.ts`
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export function createServerClient() {
  return createServerComponentClient<Database>({
    cookies,
  });
}
```

#### **1.4: Generate TypeScript Types**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Generate types
supabase gen types typescript --linked > types/database.ts
```

#### **1.5: Create Login Page**

**File**: `app/login/page.tsx`
```typescript
'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
      },
    });

    if (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Credit Card Dashboard
          </h1>
          <p className="text-gray-400">
            Manage all your credit cards in one place
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-gray-900 font-semibold py-3 px-4 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-3 disabled:opacity-50"
          >
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
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            We'll access your Gmail to track credit card transactions
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### **1.6: Create Auth Callback Handler**

**File**: `app/auth/callback/route.ts`
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

#### **1.7: Create Root Layout with Auth Provider**

**File**: `app/layout.tsx`
```typescript
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Credit Card Dashboard',
  description: 'Manage all your credit cards in one place',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
```

#### **1.8: Create Protected Dashboard Layout**

**File**: `app/dashboard/layout.tsx`
```typescript
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return <>{children}</>;
}
```

### **Deliverables**:
- ✅ Database schema created with RLS
- ✅ Supabase authentication configured
- ✅ Login page with Google OAuth
- ✅ Auth callback handler
- ✅ Protected dashboard layout

### **Testing**:
```bash
# Start dev server
npm run dev

# Test flow:
1. Visit http://localhost:3000/login
2. Click "Sign in with Google"
3. Complete Google OAuth
4. Should redirect to /dashboard (will be 404 for now - that's OK)
5. Check Supabase Dashboard > Authentication > Users
   - Your user should appear

# Test database:
1. Go to Supabase Dashboard > Table Editor
2. All 5 tables should exist
3. Try inserting test data manually
```

### **Commit Message**:
```
feat: implement authentication and database schema
- Add Google OAuth login
- Create database tables with RLS
- Set up Supabase clients
- Add protected routes
```

---

## 📧 Phase 2: Gmail Integration & Email Parsing (Day 3-4 - 6 hours)

### **Goal**: Parse credit card emails and extract transaction data

### **Tasks**:

#### **2.1: Create Gmail API Wrapper**

**File**: `lib/gmail/api.ts`
```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export function createGmailClient(refreshToken: string) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function fetchEmail(gmail: any, messageId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return response.data;
}

export async function listEmails(
  gmail: any,
  query: string,
  maxResults: number = 100
) {
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  return response.data.messages || [];
}
```

#### **2.2: Create Bank Email Patterns**

**File**: `lib/gmail/patterns.ts`
```typescript
export interface BankPattern {
  bankName: string;
  senderRegex: RegExp;
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
    senderRegex: /@sbicard\.com$/i,
    cardRegex: /X+(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /(\d{2}-\w{3}-\d{4})/,
    debitKeywords: ['debited', 'spent', 'purchase', 'paid'],
    creditKeywords: ['credited', 'cashback', 'refund', 'reward'],
  },
  {
    bankName: 'HDFC',
    senderRegex: /@hdfcbank\.com$/i,
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\./i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2})/,
    debitKeywords: ['debited', 'spent'],
    creditKeywords: ['credited', 'refund'],
  },
  {
    bankName: 'AXIS',
    senderRegex: /@axisbank\.com$/i,
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited'],
    creditKeywords: ['credited'],
  },
  {
    bankName: 'ICICI',
    senderRegex: /@icicibank\.com$/i,
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited', 'spent'],
    creditKeywords: ['credited'],
  },
];
```

#### **2.3: Create Transaction Categorizer**

**File**: `lib/utils/categorize.ts`
```typescript
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'swiggy', 'zomato', 'dominos', 'pizza', 'restaurant', 'cafe',
    'mcdonald', 'kfc', 'subway', 'starbucks', 'burger', 'food',
    'hotel', 'dining', 'bakery', 'eatery'
  ],
  'Travel': [
    'uber', 'ola', 'rapido', 'airline', 'irctc', 'makemytrip',
    'goibibo', 'booking', 'hotel', 'flight', 'train', 'bus',
    'indigo', 'spicejet', 'vistara', 'taxi', 'cab'
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho',
    'mall', 'store', 'retail', 'fashion', 'clothing', 'wear',
    'shoppe', 'shop', 'mart'
  ],
  'Bills & Utilities': [
    'electricity', 'water', 'gas', 'airtel', 'jio', 'vi', 'vodafone',
    'broadband', 'wifi', 'recharge', 'mobile', 'utility', 'bill',
    'postpaid', 'prepaid'
  ],
  'Entertainment': [
    'netflix', 'amazon prime', 'disney', 'hotstar', 'spotify',
    'youtube', 'movie', 'theatre', 'pvr', 'inox', 'gaming',
    'cinema', 'multiplex'
  ],
  'Fuel': [
    'petrol', 'diesel', 'fuel', 'hp', 'bharat petroleum', 'indian oil',
    'shell', 'cng', 'gas station', 'essar', 'reliance petroleum'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'pharmacy', 'medicine',
    'apollo', 'medplus', 'netmeds', 'health', 'medical', 'pharma'
  ],
  'Education': [
    'school', 'college', 'university', 'course', 'tuition',
    'udemy', 'coursera', 'unacademy', 'byjus', 'education'
  ],
  'EMI': [
    'emi', 'loan', 'installment', 'principal', 'interest'
  ],
};

export function categorizeTransaction(merchantName: string): string {
  const merchant = merchantName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => merchant.includes(keyword))) {
      return category;
    }
  }
  
  return 'Miscellaneous';
}
```

#### **2.4: Create Email Parser**

**File**: `lib/gmail/parser.ts`
```typescript
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
  // Extract email headers
  const headers = message.payload?.headers || [];
  const from = headers.find(h => h.name === 'From')?.value || '';
  const subject = headers.find(h => h.name === 'Subject')?.value || '';

  // Get email body
  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString();
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString();
    }
  }

  // Find matching bank pattern
  const pattern = BANK_PATTERNS.find(p => p.senderRegex.test(from));
  if (!pattern) return null;

  // Check if it's a transaction email
  const isTransaction = pattern.debitKeywords.some(kw =>
    body.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)
  );

  if (!isTransaction) return null;

  // Extract transaction data
  const cardMatch = body.match(pattern.cardRegex);
  const amountMatch = body.match(pattern.amountRegex);
  const merchantMatch = body.match(pattern.merchantRegex);
  const dateMatch = body.match(pattern.dateRegex);

  if (!cardMatch || !amountMatch) return null;

  const cardLast4 = cardMatch[1];
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown';
  const date = dateMatch ? new Date(dateMatch[1]) : new Date();

  // Determine transaction type
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
    category,
  };
}
```

### **Deliverables**:
- ✅ Gmail API wrapper functions
- ✅ Bank email patterns for major banks
- ✅ Transaction categorization logic
- ✅ Email parser with extraction logic

### **Testing**:
Create test file `lib/gmail/__tests__/parser.test.ts`:

```typescript
import { parseEmail } from '../parser';

describe('Email Parser', () => {
  it('should parse SBI transaction email', async () => {
    const mockEmail = {
      payload: {
        headers: [
          { name: 'From', value: 'alerts@sbicard.com' },
          { name: 'Subject', value: 'Transaction Alert' },
        ],
        body: {
          data: Buffer.from(
            'Your SBI Card XXXX7603 has been used for a transaction of INR 1,250.00 at SWIGGY BANGALORE on 17-Oct-2024.'
          ).toString('base64'),
        },
      },
    };

    const result = await parseEmail(mockEmail as any);

    expect(result).toMatchObject({
      bankName: 'SBI',
      cardLast4: '7603',
      amount: 1250,
      merchant: 'SWIGGY BANGALORE',
      category: 'Food & Dining',
      type: 'DEBIT',
    });
  });
});
```

```bash
# Install jest
npm install -D jest @types/jest ts-jest

# Run tests
npm test
```

### **Commit Message**:
```
feat: implement Gmail email parsing
- Add Gmail API wrapper
- Create bank email patterns
- Implement transaction extraction
- Add categorization logic
```

---

##
---

## 📊 Phase 3: Initial Email Sync & Card Management (Day 5-6 - 8 hours)

### **Goal**: Fetch historical emails, create cards, and store transactions

### **Tasks**:

#### **3.1: Create Initial Sync API Route**

**File**: `app/api/gmail/sync/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createGmailClient, listEmails, fetchEmail } from '@/lib/gmail/api';
import { parseEmail } from '@/lib/gmail/parser';

export async function POST(request: Request) {
  const supabase = createServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's Gmail refresh token
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('gmail_refresh_token')
      .eq('id', user.id)
      .single();

    if (!profile?.gmail_refresh_token) {
      return NextResponse.json(
        { error: 'Gmail not connected' },
        { status: 400 }
      );
    }

    // Initialize Gmail API
    const gmail = createGmailClient(profile.gmail_refresh_token);

    // Fetch emails from last 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const query = `after:${Math.floor(oneYearAgo.getTime() / 1000)}`;

    const messages = await listEmails(gmail, query, 500);
    let processedCount = 0;
    const errors: string[] = [];

    // Process each email
    for (const message of messages) {
      if (!message.id) continue;

      try {
        // Fetch full message
        const fullMessage = await fetchEmail(gmail, message.id);

        // Parse email
        const parsed = await parseEmail(fullMessage);
        if (!parsed) continue;

        // Find or create card
        const { data: card, error: cardError } = await supabase
          .from('credit_cards')
          .upsert(
            {
              user_id: user.id,
              bank_name: parsed.bankName,
              card_last_4: parsed.cardLast4,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,card_last_4,bank_name',
              ignoreDuplicates: false,
            }
          )
          .select()
          .single();

        if (cardError || !card) {
          errors.push(`Failed to create card: ${cardError?.message}`);
          continue;
        }

        // Check for duplicate
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('email_id', message.id)
          .single();

        if (existing) continue;

        // Store transaction
        const { error: txError } = await supabase.from('transactions').insert({
          card_id: card.id,
          transaction_date: parsed.date.toISOString(),
          merchant_name: parsed.merchant,
          amount: parsed.amount,
          category: parsed.category,
          transaction_type: parsed.type,
          is_in_statement: false,
          email_id: message.id,
        });

        if (txError) {
          errors.push(`Failed to store transaction: ${txError.message}`);
          continue;
        }

        processedCount++;
      } catch (error: any) {
        errors.push(`Error processing ${message.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: messages.length,
      errors: errors.slice(0, 10), // Return first 10 errors only
    });
  } catch (error: any) {
    console.error('Email sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails', details: error.message },
      { status: 500 }
    );
  }
}

// Get sync status
export async function GET(request: Request) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get card count
  const { count: cardCount } = await supabase
    .from('credit_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Get transaction count
  const { count: txCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .in('card_id', supabase.from('credit_cards').select('id').eq('user_id', user.id));

  return NextResponse.json({
    cards: cardCount || 0,
    transactions: txCount || 0,
  });
}
```

#### **3.2: Store Gmail Refresh Token After OAuth**

**File**: `app/api/gmail/connect/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { google } from 'googleapis';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Store refresh token
    await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email!,
        gmail_refresh_token: tokens.refresh_token,
      });

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard/setup', request.url));
  } catch (error) {
    console.error('Gmail connect error:', error);
    return NextResponse.json({ error: 'Failed to connect Gmail' }, { status: 500 });
  }
}
```

#### **3.3: Create Setup/Loading Page**

**File**: `app/dashboard/setup/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader, CheckCircle, XCircle } from 'lucide-react';

interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'error';
  message: string;
  processed?: number;
  total?: number;
}

export default function SetupPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle',
    message: 'Preparing to sync your emails...',
  });
  const router = useRouter();

  useEffect(() => {
    startSync();
  }, []);

  async function startSync() {
    setSyncStatus({
      status: 'syncing',
      message: 'Scanning your Gmail for credit card transactions...',
    });

    try {
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setSyncStatus({
          status: 'success',
          message: `Found ${data.processed} transactions from ${data.total} emails`,
          processed: data.processed,
          total: data.total,
        });

        // Wait 2 seconds then redirect
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error: any) {
      setSyncStatus({
        status: 'error',
        message: error.message || 'Failed to sync emails',
      });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">
            Setting Up Your Dashboard
          </h1>

          <div className="my-8">
            {syncStatus.status === 'syncing' && (
              <Loader className="w-16 h-16 text-purple-400 animate-spin mx-auto" />
            )}
            {syncStatus.status === 'success' && (
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
            )}
            {syncStatus.status === 'error' && (
              <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            )}
          </div>

          <p className="text-gray-300 mb-4">{syncStatus.message}</p>

          {syncStatus.processed !== undefined && (
            <div className="bg-white/5 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Progress</span>
                <span>
                  {syncStatus.processed} / {syncStatus.total}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((syncStatus.processed || 0) / (syncStatus.total || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {syncStatus.status === 'error' && (
            <button
              onClick={startSync}
              className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              Try Again
            </button>
          )}

          {syncStatus.status === 'success' && (
            <p className="text-sm text-gray-400">Redirecting to dashboard...</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
```

#### **3.4: Create Cards API Route**

**File**: `app/api/cards/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all cards
  const { data: cards, error } = await supabase
    .from('credit_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('bank_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by bank
  const groupedCards = cards.reduce((acc: any, card: any) => {
    if (!acc[card.bank_name]) {
      acc[card.bank_name] = [];
    }
    acc[card.bank_name].push(card);
    return acc;
  }, {});

  return NextResponse.json({
    cards,
    groupedCards,
  });
}
```

#### **3.5: Create Transactions API Route**

**File**: `app/api/transactions/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  
  const cardId = searchParams.get('cardId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('transactions')
    .select('*, credit_cards!inner(user_id, bank_name, card_last_4)')
    .eq('credit_cards.user_id', user.id)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cardId) {
    query = query.eq('card_id', cardId);
  }

  const { data: transactions, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    transactions,
    hasMore: transactions.length === limit,
  });
}
```

### **Deliverables**:
- ✅ Initial email sync API route
- ✅ Gmail token storage
- ✅ Setup/loading page with progress
- ✅ Cards API endpoint
- ✅ Transactions API endpoint

### **Testing**:
```bash
# Start dev server
npm run dev

# Test flow:
1. Login with Google
2. Navigate to /dashboard/setup
3. Should see sync progress
4. Check Supabase dashboard:
   - credit_cards table should have entries
   - transactions table should have entries
5. After sync, should redirect to /dashboard

# Test API endpoints:
curl http://localhost:3000/api/cards \
  -H "Cookie: [your-session-cookie]"

curl http://localhost:3000/api/transactions?limit=10 \
  -H "Cookie: [your-session-cookie]"
```

### **Commit Message**:
```
feat: implement initial email sync and card management
- Add email sync API route
- Store Gmail refresh token
- Create setup/loading page
- Add cards and transactions APIs
- Handle duplicate detection
```

---

## 🎨 Phase 4: Dashboard UI & Components (Day 7-8 - 8 hours)

### **Goal**: Build responsive dashboard with card display and transaction list

### **Tasks**:

#### **4.1: Create Dashboard Page**

**File**: `app/dashboard/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditCardComponent } from '@/components/dashboard/credit-card';
import { SpendingSummary } from '@/components/dashboard/spending-summary';
import { motion } from 'framer-motion';

interface Card {
  id: string;
  bank_name: string;
  card_last_4: string;
  card_holder_name: string;
  card_type: string;
  current_due: number;
  due_date: string;
}

export default function DashboardPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [groupedCards, setGroupedCards] = useState<Record<string, Card[]>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCards();
    setupRealtimeSubscription();
  }, []);

  async function fetchCards() {
    try {
      const response = await fetch('/api/cards');
      const data = await response.json();
      
      if (data.cards) {
        setCards(data.cards);
        setGroupedCards(data.groupedCards);
      }
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setLoading(false);
    }
  }

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel('transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('New transaction:', payload);
          // Refresh cards to update amounts
          fetchCards();
          
          // Show notification
          if (payload.new) {
            showTransactionNotification(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function showTransactionNotification(transaction: any) {
    // Will implement with react-hot-toast
    console.log('New transaction notification:', transaction);
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (cards.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Credit Card Dashboard
          </h1>
          <p className="text-gray-400">
            Manage all your credit cards in one place
          </p>
        </header>

        {/* Spending Summary */}
        <SpendingSummary cards={cards} />

        {/* Cards Grid */}
        <div className="mt-12 space-y-8">
          {Object.entries(groupedCards).map(([bank, bankCards]) => (
            <motion.div
              key={bank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-4">
                {bank}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {bankCards.map((card) => (
                  <CreditCardComponent key={card.id} card={card} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="h-12 w-64 bg-gray-700 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 bg-gray-700 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          No Credit Cards Found
        </h2>
        <p className="text-gray-400 mb-6">
          We couldn't find any credit card transactions in your emails.
          Try syncing again.
        </p>
        <button
          onClick={() => window.location.href = '/dashboard/setup'}
          className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
        >
          Sync Emails
        </button>
      </div>
    </div>
  );
}
```

#### **4.2: Create Credit Card Component**

**File**: `components/dashboard/credit-card.tsx`
```typescript
'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface CreditCardProps {
  card: {
    id: string;
    bank_name: string;
    card_last_4: string;
    card_holder_name: string | null;
    card_type: string | null;
    current_due: number;
    due_date: string | null;
  };
}

const BANK_COLORS: Record<string, { from: string; to: string }> = {
  SBI: { from: '#5B4FCE', to: '#8B5CF6' },
  HDFC: { from: '#DC2626', to: '#F97316' },
  AXIS: { from: '#1F2937', to: '#4B5563' },
  ICICI: { from: '#DC2626', to: '#EF4444' },
  DEFAULT: { from: '#6B7280', to: '#9CA3AF' },
};

export function CreditCardComponent({ card }: CreditCardProps) {
  const router = useRouter();
  const colors = BANK_COLORS[card.bank_name] || BANK_COLORS.DEFAULT;

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(`/dashboard/cards/${card.id}`)}
      className="relative w-full h-52 rounded-2xl cursor-pointer overflow-hidden shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
      }}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

      {/* Card content */}
      <div className="relative h-full p-6 flex flex-col justify-between text-white">
        {/* Top section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium opacity-80">
              {card.bank_name}
            </span>
            <span className="text-xs opacity-60">{card.card_type || 'CARD'}</span>
          </div>
          <p className="text-sm opacity-80">•••• {card.card_last_4}</p>
        </div>

        {/* Middle section - Amount */}
        <div>
          <p className="text-3xl font-bold">
            ₹{(card.current_due || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs opacity-80">
            Due: {card.due_date ? new Date(card.due_date).toLocaleDateString() : 'N/A'}
          </p>
        </div>

        {/* Bottom section - Cardholder */}
        <p className="text-sm uppercase tracking-wider opacity-90">
          {card.card_holder_name || 'CARDHOLDER'}
        </p>
      </div>

      {/* Decorative elements */}
      <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -left-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
    </motion.div>
  );
}
```

#### **4.3: Create Spending Summary Component**

**File**: `components/dashboard/spending-summary.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';

interface SpendingSummaryProps {
  cards: any[];
}

export function SpendingSummary({ cards }: SpendingSummaryProps) {
  const [totalDue, setTotalDue] = useState(0);
  const [currentSpending, setCurrentSpending] = useState(0);
  const [limit, setLimit] = useState(50000);
  const supabase = createClient();

  useEffect(() => {
    calculateSpending();
  }, [cards]);

  async function calculateSpending() {
    // Calculate total due
    const total = cards.reduce((sum, card) => sum + (card.current_due || 0), 0);
    setTotalDue(total);

    // Get current month spending
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, transaction_type')
      .eq('is_in_statement', false)
      .gte('transaction_date', startOfMonth.toISOString())
      .in('card_id', cards.map(c => c.id));

    if (transactions) {
      const spending = transactions
        .filter(t => t.transaction_type === 'DEBIT')
        .reduce((sum, t) => sum + t.amount, 0);
      setCurrentSpending(spending);
    }

    // Get user's spending limit
    const { data: limits } = await supabase
      .from('spending_limits')
      .select('limit_amount')
      .eq('user_id', user.id)
      .eq('limit_type', 'GLOBAL')
      .eq('is_active', true)
      .single();

    if (limits) {
      setLimit(limits.limit_amount);
    }
  }

  const percentage = Math.min((currentSpending / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Due */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Total Amount Due</p>
          <p className="text-3xl md:text-4xl font-bold text-white">
            ₹{totalDue.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Across {cards.length} card{cards.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Current Spending */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Current Month Spending</p>
          <div className="flex items-end gap-2 mb-3">
            <p className="text-2xl md:text-3xl font-bold text-white">
              ₹{currentSpending.toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              / ₹{limit.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                isOverLimit
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : isNearLimit
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          {isNearLimit && !isOverLimit && (
            <p className="text-xs text-yellow-400 mt-2">
              ⚠️ Approaching spending limit
            </p>
          )}

          {isOverLimit && (
            <p className="text-xs text-red-400 mt-2">
              🚨 Spending limit exceeded
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### **4.4: Create Card Detail Page**

**File**: `app/dashboard/cards/[id]/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, CreditCard as CardIcon } from 'lucide-react';

interface Transaction {
  id: string;
  transaction_date: string;
  merchant_name: string;
  amount: number;
  category: string;
  transaction_type: string;
}

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.id as string;
  
  const [card, setCard] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCardDetails();
    fetchTransactions();
  }, [cardId]);

  async function fetchCardDetails() {
    const { data } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (data) {
      setCar# Credit Card Dashboard - Phased Implementation Guide

## 📋 Overview

This document breaks down the entire application into **6 distinct phases**, each with clear deliverables, testable outcomes, and complete isolation from other phases. Perfect for GitHub Copilot to work on one phase at a time.

**Total Timeline**: 2-3 weeks  
**Budget**: $0-1/month  
**Architecture**: Next.js 14 + Supabase + Upstash Redis

---

## 🎯 Phase 0: Initial Setup & Configuration (Day 1 - 2 hours)

### **Goal**: Set up all external services and project structure

### **Tasks**:

#### **0.1: Create Supabase Project**
```bash
# Go to https://supabase.com
# Sign up (free, no credit card)
# Click "New Project"
# Project Name: credit-card-dashboard
# Database Password: [generate strong password]
# Region: [closest to you]
# Wait 2 minutes for provisioning

# Save these credentials:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

#### **0.2: Create Upstash Redis**
```bash
# Go to https://upstash.com
# Sign up with GitHub/Google
# Click "Create Database"
# Name: credit-card-cache
# Type: Regional
# Region: [closest to Vercel region]
# Click Create

# Save these:
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=AaaaBbb...
```

#### **0.3: Set Up Google Cloud Project**
```bash
# Go to https://console.cloud.google.com
# Create new project: credit-card-dashboard
# Enable Gmail API:
#   - Go to "APIs & Services" > "Library"
#   - Search "Gmail API"
#   - Click Enable

# Create OAuth Credentials:
#   - Go to "APIs & Services" > "Credentials"
#   - Click "Create Credentials" > "OAuth client ID"
#   - Application type: Web application
#   - Name: Credit Card Dashboard
#   - Authorized redirect URIs: http://localhost:3000/api/auth/callback/google
#   - Click Create

# Save these:
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

#### **0.4: Create Next.js Project**
```bash
# Create project
npx create-next-app@latest credit-card-dashboard
# ✔ TypeScript? Yes
# ✔ ESLint? Yes
# ✔ Tailwind CSS? Yes
# ✔ src/ directory? No
# ✔ App Router? Yes
# ✔ Import alias? Yes (@/*)

cd credit-card-dashboard

# Install core dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @upstash/redis
npm install googleapis
npm install framer-motion lucide-react
npm install react-hot-toast
npm install date-fns
npm install zod

# Install dev dependencies
npm install -D @types/node
```

#### **0.5: Create Environment File**
```bash
# Create .env.local
touch .env.local

# Add all credentials (see full file below)
```

**Complete .env.local file**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth & Gmail API
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Upstash Redis
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Encryption (for sensitive data)
ENCRYPTION_KEY=generate-with-openssl-rand-hex-32
```

#### **0.6: Create Project Structure**
```bash
# Create folder structure
mkdir -p app/api/{auth,gmail,cards,transactions,limits}
mkdir -p components/{ui,dashboard}
mkdir -p lib/{supabase,gmail,utils}
mkdir -p types
mkdir -p hooks

# Create placeholder files
touch lib/supabase/client.ts
touch lib/supabase/server.ts
touch lib/gmail/parser.ts
touch lib/redis.ts
touch types/database.ts
```

### **Deliverables**:
- ✅ All services created and accessible
- ✅ Environment variables configured
- ✅ Next.js project initialized
- ✅ Dependencies installed
- ✅ Folder structure ready

### **Testing**:
```bash
# Test Next.js runs
npm run dev
# Should see: "ready started server on 0.0.0.0:3000"

# Visit http://localhost:3000
# Should see default Next.js page
```

### **Commit Message**:
```
chore: initial project setup with all services configured
```

---

## 🔐 Phase 1: Authentication & Database Setup (Day 2 - 4 hours)

### **Goal**: Implement Google authentication and create database schema

### **Tasks**:

#### **1.1: Set Up Supabase Database Schema**

**File**: `supabase/schema.sql`

```sql
-- Run this in Supabase SQL Editor

-- 1. User Profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  profile_picture_url TEXT,
  global_spending_limit DECIMAL(12, 2) DEFAULT 50000,
  gmail_refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Credit Cards
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_last_4 TEXT NOT NULL,
  card_holder_name TEXT,
  card_type TEXT,
  statement_day INT,
  sender_pattern TEXT,
  current_due DECIMAL(12, 2) DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_last_4, bank_name)
);

-- 3. Transactions (single table for all)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  transaction_type TEXT DEFAULT 'DEBIT',
  is_in_statement BOOLEAN DEFAULT FALSE,
  email_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Statements
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

-- 5. Spending Limits
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

-- Create Indexes
CREATE INDEX idx_transactions_card_date ON transactions(card_id, transaction_date DESC);
CREATE INDEX idx_transactions_email ON transactions(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_cards_user ON credit_cards(user_id);
CREATE INDEX idx_limits_user_active ON spending_limits(user_id) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own cards" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON credit_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON credit_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own statements" ON statements
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own limits" ON spending_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own limits" ON spending_limits
  FOR ALL USING (auth.uid() = user_id);
```

#### **1.2: Configure Supabase Authentication**

In Supabase Dashboard:
1. Go to **Authentication** > **Providers**
2. Enable **Google** provider
3. Add Google Client ID and Secret from Phase 0
4. In **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**`

#### **1.3: Create Supabase Client Utilities**

**File**: `lib/supabase/client.ts`
```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';

export function createClient() {
  return createClientComponentClient<Database>();
}
```

**File**: `lib/supabase/server.ts`
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export function createServerClient() {
  return createServerComponentClient<Database>({
    cookies,
  });
}
```

#### **1.4: Generate TypeScript Types**

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Generate types
supabase gen types typescript --linked > types/database.ts
```

#### **1.5: Create Login Page**

**File**: `app/login/page.tsx`
```typescript
'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
      },
    });

    if (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Credit Card Dashboard
          </h1>
          <p className="text-gray-400">
            Manage all your credit cards in one place
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white text-gray-900 font-semibold py-3 px-4 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-3 disabled:opacity-50"
          >
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
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            We'll access your Gmail to track credit card transactions
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### **1.6: Create Auth Callback Handler**

**File**: `app/auth/callback/route.ts`
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

#### **1.7: Create Root Layout with Auth Provider**

**File**: `app/layout.tsx`
```typescript
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Credit Card Dashboard',
  description: 'Manage all your credit cards in one place',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
```

#### **1.8: Create Protected Dashboard Layout**

**File**: `app/dashboard/layout.tsx`
```typescript
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return <>{children}</>;
}
```

### **Deliverables**:
- ✅ Database schema created with RLS
- ✅ Supabase authentication configured
- ✅ Login page with Google OAuth
- ✅ Auth callback handler
- ✅ Protected dashboard layout

### **Testing**:
```bash
# Start dev server
npm run dev

# Test flow:
1. Visit http://localhost:3000/login
2. Click "Sign in with Google"
3. Complete Google OAuth
4. Should redirect to /dashboard (will be 404 for now - that's OK)
5. Check Supabase Dashboard > Authentication > Users
   - Your user should appear

# Test database:
1. Go to Supabase Dashboard > Table Editor
2. All 5 tables should exist
3. Try inserting test data manually
```

### **Commit Message**:
```
feat: implement authentication and database schema
- Add Google OAuth login
- Create database tables with RLS
- Set up Supabase clients
- Add protected routes
```

---

## 📧 Phase 2: Gmail Integration & Email Parsing (Day 3-4 - 6 hours)

### **Goal**: Parse credit card emails and extract transaction data

### **Tasks**:

#### **2.1: Create Gmail API Wrapper**

**File**: `lib/gmail/api.ts`
```typescript
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export function createGmailClient(refreshToken: string) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function fetchEmail(gmail: any, messageId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return response.data;
}

export async function listEmails(
  gmail: any,
  query: string,
  maxResults: number = 100
) {
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  return response.data.messages || [];
}
```

#### **2.2: Create Bank Email Patterns**

**File**: `lib/gmail/patterns.ts`
```typescript
export interface BankPattern {
  bankName: string;
  senderRegex: RegExp;
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
    senderRegex: /@sbicard\.com$/i,
    cardRegex: /X+(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /(\d{2}-\w{3}-\d{4})/,
    debitKeywords: ['debited', 'spent', 'purchase', 'paid'],
    creditKeywords: ['credited', 'cashback', 'refund', 'reward'],
  },
  {
    bankName: 'HDFC',
    senderRegex: /@hdfcbank\.com$/i,
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\./i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2})/,
    debitKeywords: ['debited', 'spent'],
    creditKeywords: ['credited', 'refund'],
  },
  {
    bankName: 'AXIS',
    senderRegex: /@axisbank\.com$/i,
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited'],
    creditKeywords: ['credited'],
  },
  {
    bankName: 'ICICI',
    senderRegex: /@icicibank\.com$/i,
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited', 'spent'],
    creditKeywords: ['credited'],
  },
];
```

#### **2.3: Create Transaction Categorizer**

**File**: `lib/utils/categorize.ts`
```typescript
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    'swiggy', 'zomato', 'dominos', 'pizza', 'restaurant', 'cafe',
    'mcdonald', 'kfc', 'subway', 'starbucks', 'burger', 'food',
    'hotel', 'dining', 'bakery', 'eatery'
  ],
  'Travel': [
    'uber', 'ola', 'rapido', 'airline', 'irctc', 'makemytrip',
    'goibibo', 'booking', 'hotel', 'flight', 'train', 'bus',
    'indigo', 'spicejet', 'vistara', 'taxi', 'cab'
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho',
    'mall', 'store', 'retail', 'fashion', 'clothing', 'wear',
    'shoppe', 'shop', 'mart'
  ],
  'Bills & Utilities': [
    'electricity', 'water', 'gas', 'airtel', 'jio', 'vi', 'vodafone',
    'broadband', 'wifi', 'recharge', 'mobile', 'utility', 'bill',
    'postpaid', 'prepaid'
  ],
  'Entertainment': [
    'netflix', 'amazon prime', 'disney', 'hotstar', 'spotify',
    'youtube', 'movie', 'theatre', 'pvr', 'inox', 'gaming',
    'cinema', 'multiplex'
  ],
  'Fuel': [
    'petrol', 'diesel', 'fuel', 'hp', 'bharat petroleum', 'indian oil',
    'shell', 'cng', 'gas station', 'essar', 'reliance petroleum'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'pharmacy', 'medicine',
    'apollo', 'medplus', 'netmeds', 'health', 'medical', 'pharma'
  ],
  'Education': [
    'school', 'college', 'university', 'course', 'tuition',
    'udemy', 'coursera', 'unacademy', 'byjus', 'education'
  ],
  'EMI': [
    'emi', 'loan', 'installment', 'principal', 'interest'
  ],
};

export function categorizeTransaction(merchantName: string): string {
  const merchant = merchantName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => merchant.includes(keyword))) {
      return category;
    }
  }
  
  return 'Miscellaneous';
}
```

#### **2.4: Create Email Parser**

**File**: `lib/gmail/parser.ts`
```typescript
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
  // Extract email headers
  const headers = message.payload?.headers || [];
  const from = headers.find(h => h.name === 'From')?.value || '';
  const subject = headers.find(h => h.name === 'Subject')?.value || '';

  // Get email body
  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString();
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString();
    }
  }

  // Find matching bank pattern
  const pattern = BANK_PATTERNS.find(p => p.senderRegex.test(from));
  if (!pattern) return null;

  // Check if it's a transaction email
  const isTransaction = pattern.debitKeywords.some(kw =>
    body.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)
  );

  if (!isTransaction) return null;

  // Extract transaction data
  const cardMatch = body.match(pattern.cardRegex);
  const amountMatch = body.match(pattern.amountRegex);
  const merchantMatch = body.match(pattern.merchantRegex);
  const dateMatch = body.match(pattern.dateRegex);

  if (!cardMatch || !amountMatch) return null;

  const cardLast4 = cardMatch[1];
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown';
  const date = dateMatch ? new Date(dateMatch[1]) : new Date();

  // Determine transaction type
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
    category,
  };
}
```

### **Deliverables**:
- ✅ Gmail API wrapper functions
- ✅ Bank email patterns for major banks
- ✅ Transaction categorization logic
- ✅ Email parser with extraction logic

### **Testing**:
Create test file `lib/gmail/__tests__/parser.test.ts`:

```typescript
import { parseEmail } from '../parser';

describe('Email Parser', () => {
  it('should parse SBI transaction email', async () => {
    const mockEmail = {
      payload: {
        headers: [
          { name: 'From', value: 'alerts@sbicard.com' },
          { name: 'Subject', value: 'Transaction Alert' },
        ],
        body: {
          data: Buffer.from(
            'Your SBI Card XXXX7603 has been used for a transaction of INR 1,250.00 at SWIGGY BANGALORE on 17-Oct-2024.'
          ).toString('base64'),
        },
      },
    };

    const result = await parseEmail(mockEmail as any);

    expect(result).toMatchObject({
      bankName: 'SBI',
      cardLast4: '7603',
      amount: 1250,
      merchant: 'SWIGGY BANGALORE',
      category: 'Food & Dining',
      type: 'DEBIT',
    });
  });
});
```

```bash
# Install jest
npm install -D jest @types/jest ts-jest

# Run tests
npm test
```

### **Commit Message**:
```
feat: implement Gmail email parsing
- Add Gmail API wrapper
- Create bank email patterns
- Implement transaction extraction
- Add categorization logic
```

---

##