# Credit Card Dashboard - Ultra Budget Architecture ($0-5/Month)

## 💰 Cost-Optimized Design for Personal Use

**Target Budget**: $0-5 per month  
**User Base**: Single user (you)  
**Priority**: Minimize costs while maintaining core functionality

---

## 🎯 Cost Breakdown Estimate

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **Vercel** (Frontend + Backend) | Hobby (Free) | $0 |
| **Supabase** (PostgreSQL + Auth) | Free Tier | $0 |
| **Gmail API** | Free (1 billion requests/day) | $0 |
| **Upstash Redis** | Free Tier (10K commands/day) | $0 |
| **Cloudflare** (Domain + CDN) | Free | $0 |
| **Domain** (Optional) | Namecheap | $0.99/month |
| **TOTAL** | | **$0-1/month** |

### Why This Works for Personal Use:
- **Single user = minimal traffic**
- **Free tiers are generous for 1 person**
- **No auto-scaling needed**
- **Serverless = pay only when running**

---

## 🏗️ Revised System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER (YOU)                               │
│                    Your Browser/Device                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTPS
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    VERCEL (FREE TIER)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  FRONTEND (Next.js App Router)                            │  │
│  │  - React + TypeScript + Tailwind                          │  │
│  │  - Server-Side Rendering                                  │  │
│  │  - Static Generation where possible                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  BACKEND (Next.js API Routes - Serverless Functions)     │  │
│  │  - API endpoints as serverless functions                  │  │
│  │  - No always-on server (pay per invocation)              │  │
│  │  - Edge functions for real-time features                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  BACKGROUND JOBS (Vercel Cron)                            │  │
│  │  - Scheduled email sync (every 6 hours)                   │  │
│  │  - No Bull Queue needed                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  SUPABASE    │  │ GMAIL API    │  │UPSTASH REDIS │
│  (FREE)      │  │  (FREE)      │  │  (FREE)      │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ PostgreSQL   │  │ Email Fetch  │  │ Cache Layer  │
│ Database     │  │ Pub/Sub      │  │ Rate Limit   │
│ Auth         │  │ Send Email   │  │ Session      │
│ Storage      │  └──────────────┘  └──────────────┘
│ Realtime     │
└──────────────┘
```

---

## 🔄 Simplified User Flows

### **New User Flow (Optimized)**

```
1. User visits app (deployed on Vercel)
   │
   ├──► Google Sign-in via Supabase Auth (FREE)
   │
   ├──► Store user in Supabase DB
   │
   ├──► Show loading screen
   │
   ├──► Trigger ONE-TIME email sync via API route
   │    - Runs as serverless function (no cost when not running)
   │    - Fetches last 1 year of emails (not 2, to save processing)
   │    - Parse and store in Supabase
   │
   ├──► Set up Gmail Pub/Sub watch (7 days auto-renew)
   │    - Free, no polling needed
   │
   ├──► SKIP card perks scraping initially
   │    - Add perks manually later via settings
   │    - Or run on-demand when viewing a card
   │
   └──► Show dashboard
```

### **Existing User Flow**

```
1. User visits app
   │
   ├──► Supabase Auth validates session
   │
   ├──► Fetch data from Supabase (cached in Redis)
   │
   └──► Show dashboard
```

### **Real-time Transaction Flow**

```
Gmail receives new email
   │
   ├──► Gmail Pub/Sub pushes to Vercel API endpoint
   │
   ├──► Serverless function parses email
   │
   ├──► Store in Supabase DB
   │
   ├──► Supabase Realtime broadcasts update
   │
   └──► Frontend receives update via WebSocket (if online)
```

---

## 📊 Database Schema (Simplified for Cost)

### **Supabase PostgreSQL - Free Tier Limits**
- **Storage**: 500 MB (plenty for text data)
- **Bandwidth**: 5 GB/month
- **Rows**: Unlimited

### **Optimized Schema (6 Tables Instead of 8)**

```sql
-- 1. Users (handled by Supabase Auth automatically)
-- No need to create this, Supabase provides auth.users

-- 2. user_profiles (extends Supabase auth)
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

-- 3. credit_cards
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_last_4 TEXT NOT NULL,
  card_holder_name TEXT,
  card_type TEXT, -- VISA, MC, etc.
  statement_day INT, -- 1-31
  sender_pattern TEXT,
  current_due DECIMAL(12, 2) DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, card_last_4, bank_name)
);

-- 4. transactions (SINGLE TABLE for all transactions)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES statements(id) ON DELETE SET NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  transaction_type TEXT DEFAULT 'DEBIT', -- DEBIT, CREDIT, REVERSAL
  is_in_statement BOOLEAN DEFAULT FALSE,
  email_id TEXT UNIQUE, -- Gmail message ID for deduplication
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. statements
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

-- 6. spending_limits
CREATE TABLE spending_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL, -- GLOBAL, CATEGORY
  category_name TEXT,
  limit_amount DECIMAL(12, 2) NOT NULL,
  current_spending DECIMAL(12, 2) DEFAULT 0,
  alert_threshold INT DEFAULT 90,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REMOVED TABLES:
-- ❌ card_perks (add manually or fetch on-demand)
-- ❌ email_patterns (hardcode in application)
-- ❌ separate current_transactions table (merged into transactions)

-- Indexes (minimal, for performance)
CREATE INDEX idx_transactions_card_date ON transactions(card_id, transaction_date DESC);
CREATE INDEX idx_transactions_email ON transactions(email_id) WHERE email_id IS NOT NULL;
CREATE INDEX idx_transactions_statement ON transactions(statement_id) WHERE is_in_statement = TRUE;
CREATE INDEX idx_cards_user ON credit_cards(user_id);
CREATE INDEX idx_limits_user_active ON spending_limits(user_id) WHERE is_active = TRUE;
```

---

## 🔧 Tech Stack (All Free Tiers)

### **Frontend & Backend**
```json
{
  "framework": "Next.js 14 (App Router)",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "animations": "Framer Motion",
  "deployment": "Vercel (Free Hobby plan)",
  "why": "Single codebase for frontend + backend, free hosting"
}
```

### **Database & Auth**
```json
{
  "database": "Supabase PostgreSQL",
  "auth": "Supabase Auth (Google OAuth built-in)",
  "realtime": "Supabase Realtime (WebSocket built-in)",
  "storage": "Supabase Storage (for statement PDFs if needed)",
  "why": "All-in-one solution, generous free tier, no credit card required"
}
```

### **Caching & Queue**
```json
{
  "cache": "Upstash Redis",
  "rateLimit": "Upstash Ratelimit",
  "queue": "None (use Vercel Cron for scheduled jobs)",
  "why": "Free tier is enough for 1 user"
}
```

### **External APIs**
```json
{
  "email": "Gmail API (free)",
  "notifications": "Supabase Realtime (free)",
  "monitoring": "Vercel Analytics (free tier)",
  "why": "No cost, all we need"
}
```

---

## 📁 Project Structure

```
credit-card-dashboard/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx         # Login page
│   │   └── callback/
│   │       └── page.tsx         # OAuth callback
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Dashboard layout
│   │   ├── page.tsx             # Main dashboard
│   │   ├── cards/
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Card detail page
│   │   └── settings/
│   │       └── page.tsx         # Settings page
│   ├── api/                     # API Routes (Serverless)
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts     # Supabase auth callback
│   │   ├── gmail/
│   │   │   ├── sync/
│   │   │   │   └── route.ts     # Initial sync
│   │   │   ├── webhook/
│   │   │   │   └── route.ts     # Gmail Pub/Sub webhook
│   │   │   └── watch/
│   │   │       └── route.ts     # Setup Gmail watch
│   │   ├── cards/
│   │   │   ├── route.ts         # GET all cards
│   │   │   └── [id]/
│   │   │       └── route.ts     # GET card details
│   │   ├── transactions/
│   │   │   └── route.ts         # GET transactions
│   │   └── limits/
│   │       └── route.ts         # Spending limits CRUD
│   └── layout.tsx               # Root layout
├── components/
│   ├── ui/
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   └── ...
│   ├── dashboard/
│   │   ├── credit-card.tsx
│   │   ├── spending-summary.tsx
│   │   ├── transaction-list.tsx
│   │   └── loading-progress.tsx
│   └── providers/
│       └── supabase-provider.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Supabase client
│   │   └── server.ts            # Supabase server client
│   ├── gmail/
│   │   ├── parser.ts            # Email parsing logic
│   │   ├── patterns.ts          # Bank email patterns
│   │   └── api.ts               # Gmail API wrapper
│   ├── utils/
│   │   ├── categorize.ts        # Transaction categorization
│   │   └── format.ts            # Formatting utilities
│   └── redis.ts                 # Upstash Redis client
├── types/
│   ├── database.ts              # Database types (Supabase generated)
│   └── index.ts                 # App types
├── hooks/
│   ├── use-cards.ts
│   ├── use-transactions.ts
│   └── use-realtime.ts
├── public/
│   └── bank-logos/
├── .env.local                   # Environment variables
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 🔑 Environment Variables

### **.env.local**

```bash
# Supabase (get from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth & Gmail API
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Upstash Redis (get from Upstash dashboard)
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Encryption (for sensitive data)
ENCRYPTION_KEY=generate-with-openssl-rand-hex-32

# Optional: For monitoring
NEXT_PUBLIC_VERCEL_ANALYTICS=true
```

---

## 🚀 Setup Instructions (Step-by-Step)

### **1. Create Supabase Project (2 minutes)**

```bash
# Go to https://supabase.com
# Click "New Project"
# Choose: Free tier, Region: closest to you
# Wait for project to be created (~2 min)

# Get your keys from Settings > API
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### **2. Set Up Database**

```bash
# Go to Supabase SQL Editor
# Copy the simplified schema from above
# Run all CREATE TABLE statements
# Enable Row Level Security (RLS)
```

### **3. Configure Supabase Auth**

```sql
# In Supabase Dashboard > Authentication > Providers
# Enable Google OAuth
# Add your domain to allowed URLs

# Add RLS policies (Security)
-- Users can only see their own data
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cards" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    card_id IN (SELECT id FROM credit_cards WHERE user_id = auth.uid())
  );

-- Repeat for other tables
```

### **4. Create Upstash Redis (1 minute)**

```bash
# Go to https://upstash.com
# Sign up (free, no credit card)
# Create new database
# Select: Free tier, Region: closest to Vercel region
# Copy URL and token
```

### **5. Set Up Gmail API**

```bash
# Go to Google Cloud Console
# Create new project or use existing
# Enable Gmail API
# Create OAuth 2.0 credentials
# Add authorized redirect URI: https://your-app.vercel.app/api/gmail/callback
# Download credentials JSON
```

### **6. Create Next.js Project**

```bash
# Clone starter or create new
npx create-next-app@latest credit-card-dashboard --typescript --tailwind --app

cd credit-card-dashboard

# Install dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @upstash/redis @upstash/ratelimit
npm install googleapis
npm install framer-motion
npm install lucide-react
npm install date-fns
npm install recharts
npm install react-hot-toast
npm install zod
```

### **7. Deploy to Vercel (3 minutes)**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Settings > Environment Variables
# Add all .env.local variables

# Redeploy
vercel --prod
```

---

## 💻 Core Implementation

### **1. Supabase Client Setup**

```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/database';

export const createClient = () => {
  return createClientComponentClient<Database>();
};
```

```typescript
// lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

export const createServerClient = () => {
  return createServerComponentClient<Database>({
    cookies,
  });
};
```

### **2. Gmail Email Parser**

```typescript
// lib/gmail/parser.ts
import { gmail_v1 } from 'googleapis';

interface ParsedTransaction {
  cardLast4: string;
  bankName: string;
  amount: number;
  merchant: string;
  date: Date;
  type: 'DEBIT' | 'CREDIT';
  category: string;
}

const BANK_PATTERNS = {
  SBI: {
    senderRegex: /@sbicard\.com$/,
    cardRegex: /X+(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /(\d{2}-\w{3}-\d{4})/,
    debitKeywords: ['debited', 'spent', 'purchase'],
  },
  HDFC: {
    senderRegex: /@hdfcbank\.com$/,
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\./i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2})/,
    debitKeywords: ['debited'],
  },
  AXIS: {
    senderRegex: /@axisbank\.com$/,
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    debitKeywords: ['debited'],
  },
};

export async function parseEmail(
  message: gmail_v1.Schema$Message
): Promise<ParsedTransaction | null> {
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

  // Identify bank
  let bank: string | null = null;
  let pattern: any = null;
  
  for (const [bankName, bankPattern] of Object.entries(BANK_PATTERNS)) {
    if (bankPattern.senderRegex.test(from)) {
      bank = bankName;
      pattern = bankPattern;
      break;
    }
  }

  if (!bank || !pattern) return null;

  // Check if it's a transaction email
  const isTransaction = pattern.debitKeywords.some((kw: string) =>
    body.toLowerCase().includes(kw) || subject.toLowerCase().includes(kw)
  );

  if (!isTransaction) return null;

  // Extract data
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
  const isCredit = body.toLowerCase().includes('credit') ||
                   body.toLowerCase().includes('cashback') ||
                   body.toLowerCase().includes('refund');

  const type = isCredit ? 'CREDIT' : 'DEBIT';

  // Auto-categorize
  const category = categorizeMerchant(merchant);

  return {
    cardLast4,
    bankName: bank,
    amount,
    merchant,
    date,
    type,
    category,
  };
}

function categorizeMerchant(merchant: string): string {
  const m = merchant.toLowerCase();
  
  if (/swiggy|zomato|food|restaurant|cafe|pizza|burger/.test(m)) return 'Food & Dining';
  if (/uber|ola|flight|train|hotel|travel/.test(m)) return 'Travel';
  if (/amazon|flipkart|shopping|store/.test(m)) return 'Shopping';
  if (/airtel|jio|electricity|water|utility/.test(m)) return 'Bills & Utilities';
  if (/netflix|prime|spotify|entertainment/.test(m)) return 'Entertainment';
  if (/petrol|diesel|fuel/.test(m)) return 'Fuel';
  
  return 'Miscellaneous';
}
```

### **3. Initial Email Sync API Route**

```typescript
// app/api/gmail/sync/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServerClient } from '@/lib/supabase/server';
import { parseEmail } from '@/lib/gmail/parser';

export async function POST(request: Request) {
  const supabase = createServerClient();
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's Gmail refresh token from database
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('gmail_refresh_token')
      .eq('id', user.id)
      .single();

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: profile.gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch emails from last 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const query = `after:${Math.floor(oneYearAgo.getTime() / 1000)}`;

    // List messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 500, // Gmail API limit per call
    });

    const messages = response.data.messages || [];
    let processedCount = 0;

    // Process each message
    for (const message of messages) {
      if (!message.id) continue;

      // Fetch full message
      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      // Parse email
      const parsed = await parseEmail(fullMessage.data);
      if (!parsed) continue;

      // Find or create card
      const { data: card, error: cardError } = await supabase
        .from('credit_cards')
        .upsert({
          user_id: user.id,
          bank_name: parsed.bankName,
          card_last_4: parsed.cardLast4,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,card_last_4,bank_name',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (cardError || !card) continue;

      // Check for duplicate transaction
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('email_id', message.id)
        .single();

      if (existing) continue; // Skip duplicate

      // Store transaction
      await supabase.from('transactions').insert({
        card_id: card.id,
        transaction_date: parsed.date.toISOString(),
        merchant_name: parsed.merchant,
        amount: parsed.amount,
        category: parsed.category,
        transaction_type: parsed.type,
        is_in_statement: false,
        email_id: message.id,
      });

      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: messages.length,
    });

  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    );
  }
}
```

### **4. Gmail Pub/Sub Webhook**

```typescript
// app/api/gmail/webhook/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { parseEmail } from '@/lib/gmail/parser';

// Use service role key for server-side operations
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

    // Get user by email
    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id, gmail_refresh_token')
      .eq('email', emailAddress)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: user.gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get history
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
      historyTypes: ['messageAdded'],
    });

    const historyRecords = history.data.history || [];

    // Process new messages
    for (const record of historyRecords) {
      const messagesAdded = record.messagesAdded || [];
      
      for (const msgData of messagesAdded) {
        if (!msgData.message?.id) continue;

        // Fetch full message
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: msgData.message.id,
          format: 'full',
        });

        // Parse email
        const parsed = await parseEmail(fullMessage.data);
        if (!parsed) continue;

        // Find or create card
        const { data: card } = await supabaseAdmin
          .from('credit_cards')
          .upsert({
            user_id: user.id,
            bank_name: parsed.bankName,
            card_last_4: parsed.cardLast4,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,card_last_4,bank_name',
          })
          .select()
          .single();

        if (!card) continue;

        // Check for duplicate
        const { data: existing } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('email_id', msgData.message.id)
          .single();

        if (existing) continue;

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
            email_id: msgData.message.id,
          })
          .select()
          .single();

        // Check spending limits
        if (transaction && parsed.type === 'DEBIT') {
          await checkSpendingLimits(user.id, transaction, supabaseAdmin);
        }

        // Supabase Realtime will automatically notify connected clients
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function checkSpendingLimits(
  userId: string,
  transaction: any,
  supabase: any
) {
  // Get active limits
  const { data: limits } = await supabase
    .from('spending_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!limits) return;

  for (const limit of limits) {
    // Update current spending
    const newSpending = limit.current_spending + transaction.amount;
    
    await supabase
      .from('spending_limits')
      .update({ current_spending: newSpending })
      .eq('id', limit.id);

    // Check if exceeded
    const percentUsed = (newSpending / limit.limit_amount) * 100;
    
    if (percentUsed >= limit.alert_threshold) {
      // Send alert email (implement email sending)
      await sendLimitAlert(userId, limit, newSpending);
    }
  }
}

async function sendLimitAlert(userId: string, limit: any, currentSpending: number) {
  // TODO: Implement email sending via Gmail API
  console.log(`Alert: User ${userId} exceeded ${limit.limit_type} limit`);
}
```

### **5. Dashboard Page with Realtime**

```typescript
// app/(dashboard)/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditCard } from '@/components/dashboard/credit-card';
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
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchCards();
    setupRealtimeSubscription();
  }, []);

  async function fetchCards() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('bank_name');

    if (data) {
      setCards(data);
    }
    setLoading(false);
  }

  function setupRealtimeSubscription() {
    // Subscribe to new transactions
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
          // Refresh cards to update due amounts
          fetchCards();
          
          // Show toast notification
          if (payload.new) {
            showTransactionToast(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  function showTransactionToast(transaction: any) {
    // Use react-hot-toast
    const toast = (await import('react-hot-toast')).default;
    toast.success(
      `New transaction: ₹${transaction.amount} at ${transaction.merchant_name}`
    );
  }

  // Group cards by bank
  const groupedCards = cards.reduce((acc, card) => {
    if (!acc[card.bank_name]) {
      acc[card.bank_name] = [];
    }
    acc[card.bank_name].push(card);
    return acc;
  }, {} as Record<string, Card[]>);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Credit Card Dashboard
          </h1>
          <p className="text-gray-400">
            Manage all your credit cards in one place
          </p>
        </header>

        <SpendingSummary cards={cards} />

        <div className="mt-12 space-y-8">
          {Object.entries(groupedCards).map(([bank, bankCards]) => (
            <motion.div
              key={bank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-2xl font-semibold text-white mb-4">
                {bank}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bankCards.map((card) => (
                  <CreditCard key={card.id} card={card} />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {cards.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">
              No credit cards found. New cards will appear here once we sync your emails.
            </p>
            <button
              onClick={() => window.location.href = '/api/gmail/sync'}
              className="mt-4 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              Sync Emails Now
            </button>
          </div>
        )}
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
              className="h-48 bg-gray-700 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### **6. Credit Card Component**

```typescript
// components/dashboard/credit-card.tsx
'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface CreditCardProps {
  card: {
    id: string;
    bank_name: string;
    card_last_4: string;
    card_holder_name: string;
    card_type: string;
    current_due: number;
    due_date: string;
  };
}

export function CreditCard({ card }: CreditCardProps) {
  const router = useRouter();

  const bankColors: Record<string, { from: string; to: string }> = {
    SBI: { from: '#5B4FCE', to: '#8B5CF6' },
    HDFC: { from: '#DC2626', to: '#F97316' },
    AXIS: { from: '#1F2937', to: '#4B5563' },
    ICICI: { from: '#DC2626', to: '#EF4444' },
  };

  const colors = bankColors[card.bank_name] || { from: '#6B7280', to: '#9CA3AF' };

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => router.push(`/cards/${card.id}`)}
      className="relative w-full h-52 rounded-2xl cursor-pointer overflow-hidden shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
      }}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

      {/* Card content */}
      <div className="relative h-full p-6 flex flex-col justify-between text-white">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium opacity-80">
              {card.bank_name}
            </span>
            <span className="text-xs opacity-60">{card.card_type}</span>
          </div>
          <p className="text-sm opacity-80">•••• {card.card_last_4}</p>
        </div>

        <div>
          <div className="mb-2">
            <p className="text-3xl font-bold">
              ₹{card.current_due?.toLocaleString() || '0'}
            </p>
            <p className="text-xs opacity-80">
              Due: {card.due_date ? new Date(card.due_date).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

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

### **7. Spending Summary Component**

```typescript
// components/dashboard/spending-summary.tsx
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

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Due */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Total Amount Due</p>
          <p className="text-4xl font-bold text-white">
            ₹{totalDue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Across {cards.length} card{cards.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Current Spending */}
        <div>
          <p className="text-sm text-gray-400 mb-2">Current Month Spending</p>
          <div className="flex items-end gap-2 mb-3">
            <p className="text-3xl font-bold text-white">
              ₹{currentSpending.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              / ₹{limit.toLocaleString()}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                isNearLimit
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          {isNearLimit && (
            <p className="text-xs text-yellow-400 mt-2">
              ⚠️ Approaching spending limit
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🔄 Vercel Cron Jobs (Free)

### **Setup Gmail Watch Renewal**

```typescript
// app/api/cron/renew-watch/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// This endpoint should be called by Vercel Cron every 6 days
// Configure in vercel.json

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // Verify Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all users with Gmail tokens
    const { data: users } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, gmail_refresh_token')
      .not('gmail_refresh_token', 'is', null);

    if (!users) {
      return NextResponse.json({ error: 'No users found' });
    }

    const results = [];

    for (const user of users) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
          refresh_token: user.gmail_refresh_token,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Renew watch
        await gmail.users.watch({
          userId: 'me',
          requestBody: {
            topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-notifications',
            labelIds: ['INBOX'],
          },
        });

        results.push({ userId: user.id, status: 'success' });
      } catch (error) {
        console.error(`Failed to renew watch for user ${user.id}:`, error);
        results.push({ userId: user.id, status: 'failed', error });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
```

### **vercel.json Configuration**

```json
{
  "crons": [
    {
      "path": "/api/cron/renew-watch",
      "schedule": "0 0 */6 * *"
    }
  ]
}
```

---

## 🔐 Security Configuration

### **Row Level Security (RLS) Policies**

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can only see their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Credit Cards: Users can only see their own cards
CREATE POLICY "Users can view own cards" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards" ON credit_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards" ON credit_cards
  FOR UPDATE USING (auth.uid() = user_id);

-- Transactions: Users can only see transactions from their cards
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    card_id IN (
      SELECT id FROM credit_cards WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    card_id IN (
      SELECT id FROM credit_cards WHERE user_id = auth.uid()
    )
  );

-- Statements: Users can only see their own statements
CREATE POLICY "Users can view own statements" ON statements
  FOR SELECT USING (
    card_id IN (
      SELECT id FROM credit_cards WHERE user_id = auth.uid()
    )
  );

-- Spending Limits: Users can manage their own limits
CREATE POLICY "Users can view own limits" ON spending_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own limits" ON spending_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own limits" ON spending_limits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own limits" ON spending_limits
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 📱 Responsive Design Implementation

### **Tailwind Config**

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cred-dark': '#0F0F0F',
        'cred-purple': '#9B6BFF',
        'cred-pink': '#FF6B9D',
      },
      screens: {
        'xs': '475px',
        'macbook': '1512px',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [],
};
```

### **Responsive Grid Layout**

```typescript
// Example responsive layout
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 macbook:grid-cols-4 gap-4 md:gap-6">
  {cards.map(card => <CreditCard key={card.id} card={card} />)}
</div>
```

---

## 🧪 Testing Setup

### **Unit Test Example**

```typescript
// lib/gmail/__tests__/parser.test.ts
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
          data: Buffer.from(`
            Your SBI Card XXXX7603 has been used for a transaction of INR 1,250.00
            at SWIGGY BANGALORE on 17-Oct-2024.
          `).toString('base64'),
        },
      },
    };

    const result = await parseEmail(mockEmail as any);

    expect(result).toMatchObject({
      cardLast4: '7603',
      bankName: 'SBI',
      amount: 1250,
      merchant: 'SWIGGY BANGALORE',
      category: 'Food & Dining',
      type: 'DEBIT',
    });
  });

  it('should return null for non-transaction email', async () => {
    const mockEmail = {
      payload: {
        headers: [
          { name: 'From', value: 'newsletter@example.com' },
        ],
        body: { data: Buffer.from('Newsletter content').toString('base64') },
      },
    };

    const result = await parseEmail(mockEmail as any);
    expect(result).toBeNull();
  });
});
```

---

## 📊 Performance Optimization

### **Redis Caching Strategy**

```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Cache helper functions
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5 minutes
): Promise<T> {
  // Try cache first
  const cached = await redis.get<T>(key);
  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetcher();
  
  // Cache it
  await redis.setex(key, ttl, data);
  
  return data;
}

export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

### **Usage in API Routes**

```typescript
// app/api/cards/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getCachedData } from '@/lib/redis';

export async function GET(request: Request) {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use cache
  const cards = await getCachedData(
    `cards:${user.id}`,
    async () => {
      const { data } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('bank_name');
      return data;
    },
    300 // 5 min cache
  );

  return NextResponse.json({ cards });
}
```

---

## 🚀 Deployment Steps

### **1. Push to GitHub**

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/credit-card-dashboard.git
git push -u origin main
```

### **2. Deploy to Vercel**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Settings > Environment Variables
# Add all from .env.local

# Deploy to production
vercel --prod
```

### **3. Configure Supabase**

```bash
# In Supabase Dashboard:
# 1. Go to Authentication > URL Configuration
# 2. Add your Vercel URL to:
#    - Site URL: https://your-app.vercel.app
#    - Redirect URLs: https://your-app.vercel.app/**

# 3. Go to Authentication > Providers > Google
# 4. Enable and add credentials

# 5. Go to Database > Extensions
# 6. Enable "pg_cron" for scheduled tasks (optional)
```

### **4. Set Up Gmail Pub/Sub**

```bash
# In Google Cloud Console:
# 1. Enable Gmail API
# 2. Create Pub/Sub topic: gmail-notifications
# 3. Create Pub/Sub subscription with push endpoint:
#    https://your-app.vercel.app/api/gmail/webhook

# 4. Grant Gmail publish permissions:
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

---

## 💡 Cost Optimization Tips

### **1. Minimize Database Queries**
```typescript
// Bad: Multiple queries
const cards = await supabase.from('credit_cards').select('*');
for (const card of cards) {
  const transactions = await supabase
    .from('transactions')
    .select('*')
    .eq('card_id', card.id);
}

// Good: Single query with join
const { data } = await supabase
  .from('credit_cards')
  .select(`
    *,
    transactions (*)
  `);
```

### **2. Use Static Generation Where Possible**
```typescript
// app/(marketing)/about/page.tsx
export const revalidate = 3600; // Regenerate every hour

export default function AboutPage() {
  return <div>Static content</div>;
}
```

### **3. Optimize Images**
```typescript
import Image from 'next/image';

// Use Next.js Image component for automatic optimization
<Image
  src="/bank-logos/sbi.png"
  width={100}
  height={40}
  alt="SBI Logo"
/>
```

### **4. Code Splitting**
```typescript
// Lazy load heavy components
const HeavyChart = dynamic(() => import('@/components/heavy-chart'), {
  loading: () => <LoadingSkeleton />,
  ssr: false,
});
```

---

## 🐛 Debugging Guide

### **Common Issues & Solutions**

#### **Issue 1: Gmail Pub/Sub not receiving notifications**

```bash
# Check if watch is active
curl -X GET \
  'https://gmail.googleapis.com/gmail/v1/users/me/watch' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'

# If expired, renew manually
curl -X POST \
  'https://gmail.googleapis.com/gmail/v1/users/me/watch' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "topicName": "projects/YOUR_PROJECT/topics/gmail-notifications",
    "labelIds": ["INBOX"]
  }'
```

#### **Issue 2: Supabase RLS blocking queries**

```sql
-- Check which policy is blocking
SELECT * FROM pg_policies WHERE tablename = 'transactions';

-- Test query as specific user
SET request.jwt.claims.sub = 'user-uuid-here';
SELECT * FROM transactions;
```

#### **Issue 3: Vercel function timeout**

```typescript
// Vercel free tier has 10s timeout
// For long-running tasks, split into smaller chunks

// Bad: Process all emails at once
for (const email of allEmails) {
  await processEmail(email); // Could timeout
}

// Good: Process in batches
const BATCH_SIZE = 50;
for (let i = 0; i < allEmails.length; i += BATCH_SIZE) {
  const batch = allEmails.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(email => processEmail(email)));
}
```

#### **Issue 4: Redis connection errors**

```typescript
// Add retry logic
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
  retry: {
    retries: 3,
    backoff: (retryCount) => Math.pow(2, retryCount) * 100,
  },
});
```

---

## 📈 Monitoring & Analytics

### **Vercel Analytics (Free)**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### **Custom Logging**

```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
    // In production, send to error tracking service
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data);
  },
};
```

---

## 🎯 Feature Roadmap (Post-MVP)

### **Phase 1: MVP (Week 1-2)**
- [x] Authentication with Google
- [x] Initial email sync
- [x] Real-time transaction updates
- [x] Basic dashboard
- [x] Card listing
- [x] Transaction history

### **Phase 2: Enhanced Features (Week 3-4)**
- [ ] Manual transaction editing
- [ ] Transaction search and filtering
- [ ] Export transactions to CSV
- [ ] Statement PDF viewer
- [ ] Card perks manual entry
- [ ] Custom spending categories

### **Phase 3: Advanced Features (Week 5-6)**
- [ ] Spending analytics charts
- [ ] Merchant insights
- [ ] Budget forecasting
- [ ] Email digests (weekly summary)
- [ ] Mobile app (React Native)
- [ ] Bill payment reminders

### **Phase 4: Premium Features (Future)**
- [ ] AI-powered spending recommendations
- [ ] Credit score integration
- [ ] Reward points tracker
- [ ] Multi-user support (family)
- [ ] Investment suggestions based on spending

---

## 🔒 Privacy & Data Security

### **Data Encryption**

```typescript
// lib/encryption.ts
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### **Store Sensitive Data Encrypted**

```typescript
// When storing Gmail refresh token
import { encrypt } from '@/lib/encryption';

const encryptedToken = encrypt(refreshToken);

await supabase
  .from('user_profiles')
  .update({ gmail_refresh_token: encryptedToken })
  .eq('id', userId);
```

---

## 📝 User Documentation

### **Getting Started Guide**

```markdown
# Getting Started

## 1. Sign In
- Visit the app
- Click "Sign in with Google"
- Grant email access permissions

## 2. Initial Setup
- Wait 2-3 minutes while we sync your emails
- We'll automatically detect your credit cards
- Your transactions will be categorized

## 3. Using the Dashboard
- View all cards grouped by bank
- Click any card to see details
- Set spending limits in Settings
- Get real-time notifications for new transactions

## 4. Privacy
- Your data is encrypted and secure
- Only you can access your information
- We never share data with third parties
- You can delete all data anytime from Settings
```

---

## 🛠️ Maintenance Guide

### **Weekly Tasks**
- [ ] Check error logs in Vercel dashboard
- [ ] Monitor Supabase usage (should stay under 500MB)
- [ ] Verify Gmail watch is active
- [ ] Review spending categorization accuracy

### **Monthly Tasks**
- [ ] Update dependencies
- [ ] Review and optimize slow queries
- [ ] Check for new bank email patterns
- [ ] Backup database (Supabase auto-backup enabled)

### **Database Cleanup**

```sql
-- Archive old transactions (keep last 2 years)
-- Run monthly
CREATE OR REPLACE FUNCTION archive_old_transactions()
RETURNS void AS $
BEGIN
  DELETE FROM transactions
  WHERE transaction_date < NOW() - INTERVAL '2 years'
  AND is_in_statement = true;
END;
$ LANGUAGE plpgsql;

-- Run manually when needed
SELECT archive_old_transactions();
```

---

## 📊 Sample Data for Development

### **Seed Development Data**

```sql
-- Insert test user (after signing in with Google)
INSERT INTO user_profiles (id, email, full_name, global_spending_limit)
VALUES (
  'YOUR_AUTH_USER_ID',
  'test@example.com',
  'Test User',
  50000
);

-- Insert test cards
INSERT INTO credit_cards (user_id, bank_name, card_last_4, card_holder_name, card_type, statement_day, current_due, due_date)
VALUES
  ('YOUR_AUTH_USER_ID', 'SBI', '7603', 'TEST USER', 'VISA', 9, 12489.00, '2024-10-29'),
  ('YOUR_AUTH_USER_ID', 'HDFC', '0364', 'TEST USER', 'MASTERCARD', 14, 6624.00, '2024-11-02'),
  ('YOUR_AUTH_USER_ID', 'AXIS', '3825', 'TEST USER', 'MASTERCARD', 1, 6603.77, '2024-11-01');

-- Insert test transactions
INSERT INTO transactions (card_id, transaction_date, merchant_name, amount, category, transaction_type, is_in_statement)
SELECT 
  c.id,
  NOW() - (random() * INTERVAL '30 days'),
  (ARRAY['Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Uber', 'Netflix', 'Airtel'])[floor(random() * 7 + 1)],
  (random() * 5000)::numeric(10,2),
  (ARRAY['Food & Dining', 'Shopping', 'Travel', 'Entertainment', 'Bills & Utilities'])[floor(random() * 5 + 1)],
  'DEBIT',
  false
FROM credit_cards c
CROSS JOIN generate_series(1, 10);
```

---

## 🎨 UI Components Library

### **Button Component**

```typescript
// components/ui/button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-lg font-medium transition-all',
          {
            'bg-purple-500 hover:bg-purple-600 text-white': variant === 'primary',
            'bg-white/10 hover:bg-white/20 text-white': variant === 'secondary',
            'hover:bg-white/10 text-white': variant === 'ghost',
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
```

### **Modal Component**

```typescript
// components/ui/modal.tsx
'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### **Toast Notifications**

```typescript
// lib/toast.ts
import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      style: {
        background: '#10B981',
        color: '#fff',
      },
    });
  },
  error: (message: string) => {
    toast.error(message, {
      style: {
        background: '#EF4444',
        color: '#fff',
      },
    });
  },
  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        background: '#3B82F6',
        color: '#fff',
      },
    });
  },
  dismiss: (toastId: string) => {
    toast.dismiss(toastId);
  },
};
```

---

## 🚀 Quick Start Commands

### **Development**

```bash
# Clone and setup
git clone <your-repo>
cd credit-card-dashboard
npm install

# Setup environment
cp .env.example .env.local
# Fill in your credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

### **Build & Deploy**

```bash
# Build for production
npm run build

# Test production build locally
npm run start

# Deploy to Vercel
vercel --prod

# Check deployment
vercel inspect <deployment-url>
```

### **Database Operations**

```bash
# Generate TypeScript types from Supabase
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts

# Run migrations
# Go to Supabase SQL Editor and paste migration SQL

# Backup database (automatic in Supabase free tier)
# Settings > Database > Backups
```

---

## 💰 Final Cost Analysis

### **Actual Monthly Costs**

| Service | Usage | Free Tier Limit | Estimated Cost |
|---------|-------|-----------------|----------------|
| **Vercel** | ~1000 page views/month | 100GB bandwidth | $0 |
| **Supabase** | ~50MB database, 100MB bandwidth | 500MB DB, 5GB bandwidth | $0 |
| **Upstash Redis** | ~5000 commands/month | 10K commands/day | $0 |
| **Gmail API** | ~500 requests/day | 1B requests/day | $0 |
| **Domain** (optional) | yourapp.com | N/A | $0.99 |
| **TOTAL** | | | **$0-1/month** |

### **Cost Breakdown by Feature**

- **Authentication**: $0 (Supabase Auth)
- **Database**: $0 (Supabase PostgreSQL)
- **Email Sync**: $0 (Gmail API)
- **Real-time Updates**: $0 (Supabase Realtime)
- **Hosting**: $0 (Vercel)
- **Caching**: $0 (Upstash Redis)
- **Monitoring**: $0 (Vercel Analytics)

### **Scaling Projections**

If you wanted to support multiple users in the future:

| Users | Monthly Cost | Notes |
|-------|--------------|-------|
| 1 (you) | $0 | All free tiers |
| 10 | $0 | Still within free tiers |
| 100 | $0-10 | May need Supabase Pro ($25) |
| 1000 | $25-50 | Vercel Pro + Supabase Pro |

---

## 🎯 Success Metrics

### **After Setup, You Should Have:**

✅ **Functional**
- [ ] Login with Google works
- [ ] Historical emails synced (last 1 year)
- [ ] All credit cards detected
- [ ] Transactions automatically categorized
- [ ] Real-time updates working
- [ ] Spending limits configurable
- [ ] Dashboard responsive on all devices

✅ **Performance**
- [ ] Page load < 2 seconds
- [ ] Database queries < 500ms
- [ ] Real-time notification delay < 5 seconds
- [ ] No errors in console

✅ **Security**
- [ ] RLS policies enabled
- [ ] Sensitive data encrypted
- [ ] API routes protected
- [ ] No exposed secrets

✅ **Cost**
- [ ] Monthly bill = $0-1
- [ ] All services on free tier
- [ ] No surprise charges

---

## 📚 Additional Resources

### **Documentation Links**

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Gmail API Reference](https://developers.google.com/gmail/api)
- [Upstash Redis Docs](https://docs.upstash.com/redis)
- [Vercel Documentation](https://vercel.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)

### **Helpful Tutorials**

- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Gmail API Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

---

## 🎉 Conclusion

This architecture provides:

### **✨ Benefits**
1. **$0-1/month cost** - Perfect for personal use
2. **No server management** - Everything serverless
3. **Automatic scaling** - Handles traffic spikes
4. **Real-time updates** - Live transaction notifications
5. **Secure by default** - RLS, encryption, OAuth
6. **Easy maintenance** - Minimal upkeep required
7. **Modern stack** - Latest technologies
8. **Mobile responsive** - Works on all devices

### **🚀 Ready to Deploy**
- All services have generous free tiers
- No credit card required for most services
- Can be deployed in under 1 hour
- Minimal configuration needed

### **📈 Future-Proof**
- Easy to add new features
- Can scale if needed
- Modular architecture
- Well-documented codebase

---

## 🛠️ Troubleshooting Checklist

Before reaching out for help, check:

1. **Environment Variables**
   - [ ] All .env.local variables set
   - [ ] Supabase URL and keys correct
   - [ ] Gmail API credentials valid
   - [ ] Vercel environment variables match

2. **Supabase Configuration**
   - [ ] RLS policies enabled
   - [ ] Google OAuth configured
   - [ ] Redirect URLs added
   - [ ] Database migrations run

3. **Gmail API Setup**
   - [ ] API enabled in Google Cloud
   - [ ] OAuth credentials created
   - [ ] Pub/Sub topic exists
   - [ ] Correct redirect URIs

4. **Vercel Deployment**
   - [ ] Build successful
   - [ ] No errors in function logs
   - [ ] Environment variables set
   - [ ] Domain configured (if using custom)

---

## 📞 Support & Community

### **Getting Help**
- Check error logs in Vercel dashboard
- Review Supabase logs
- Search GitHub issues
- Join Next.js Discord
- Stack Overflow with relevant tags

### **Contributing**
If you improve this setup:
1. Document your changes
2. Test thoroughly
3. Update this README
4. Share with the community

---

## 📄 License & Usage

This architecture is designed for **personal use**. Feel free to:
- Use for your own credit card tracking
- Modify and customize
- Share improvements
- Deploy for yourself

**Not recommended for:**
- Commercial use without proper scaling
- Multiple users on free tier
- Storing others' financial data
- Reselling as a service

---

## 🎯 FINAL IMPLEMENTATION CHECKLIST

### **Pre-Development (15 minutes)**
- [ ] Create Supabase account and project
- [ ] Create Upstash Redis database
- [ ] Set up Google Cloud project
- [ ] Enable Gmail API
- [ ] Create OAuth credentials
- [ ] Set up Pub/Sub

### **Development (2-3 days)**
- [ ] Clone/create Next.js project
- [ ] Install dependencies
- [ ] Set up Supabase client
- [ ] Implement authentication
- [ ] Create database schema
- [ ] Build email parser
- [ ] Create API routes
- [ ] Build dashboard UI
- [ ] Implement real-time features
- [ ] Add spending limits
- [ ] Test thoroughly

### **Deployment (30 minutes)**
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Configure environment variables
- [ ] Set up Vercel Cron
- [ ] Configure Supabase redirects
- [ ] Test in production
- [ ] Set up monitoring

### **Post-Deployment (Ongoing)**
- [ ] Monitor error logs
- [ ] Check spending categorization
- [ ] Renew Gmail watch weekly
- [ ] Add new bank patterns as needed
- [ ] Optimize slow queries

---

**Total Estimated Time**: 3-4 days for full implementation
**Monthly Cost**: $0-1
**Maintenance**: 1-2 hours/month

🎉 **You now have everything needed to build a production-ready credit card dashboard for personal use at minimal cost!**

---

*Last Updated: October 19, 2024*
*Architecture Version: 2.0 (Budget Optimized)*
*Estimated Monthly Cost: $0-1*