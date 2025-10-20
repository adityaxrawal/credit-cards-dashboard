# Credit Card Dashboard - Complete Budget Implementation ($0-1/month)

## 🎯 Project Overview

Build a **Credit Card Management Dashboard** that automatically tracks all credit card transactions, statements, perks, and spending limits by parsing Gmail emails in real-time - **all for under $1/month**.

**Key Features:**
- ✅ Automatic email parsing (transactions & statements)
- ✅ Real-time notifications via SSE
- ✅ Spending limits with Gmail alerts
- ✅ Card perks tracking
- ✅ CRED-inspired UI (dark theme, glassmorphism, animations)
- ✅ Google OAuth authentication
- ✅ Responsive design (mobile, tablet, MacBook 14")

---

## 💰 Cost Breakdown

| Service | Usage | Cost |
|---------|-------|------|
| **Vercel** | Frontend hosting | $0 (Hobby tier) |
| **Supabase** | PostgreSQL DB + Auth + Realtime | $0 (500MB, 2GB bandwidth) |
| **Upstash Redis** | Background jobs queue | $0 (10K commands/day) |
| **Google Cloud** | Gmail API + Pub/Sub | $0 (within free tier) |
| **Domain** | Vercel subdomain | $0 (yourapp.vercel.app) |
| **Total** | - | **$0/month** 🎉 |

*Optional: Custom domain ~$12/year if needed*

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER LAYER                                  │
│  ┌──────────────┐         ┌──────────────┐                          │
│  │   MacBook    │         │   Mobile/    │                          │
│  │   Desktop    │         │   Tablet     │                          │
│  └──────┬───────┘         └──────┬───────┘                          │
└─────────┼────────────────────────┼─────────────────────────────────┘
          │                        │
          └────────────┬───────────┘
                       │ HTTPS
┌──────────────────────▼─────────────────────────────────────────────┐
│                    FRONTEND LAYER (Vercel)                          │
│  Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│  │ Dashboard  │  │ Card Detail│  │ Settings   │                   │
│  │ Component  │  │ Component  │  │ Component  │                   │
│  └────────────┘  └────────────┘  └────────────┘                   │
│         │              │               │                            │
│         └──────────────┴───────────────┘                            │
│                        │ API Routes + SSE                           │
└────────────────────────┼───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│                    BACKEND LAYER (Next.js API)                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  API Routes (/app/api/*)                                     │  │
│  │  - /api/auth/*        - /api/cards/*                         │  │
│  │  - /api/transactions/*  - /api/notifications/sse             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Core Services (lib/services/*)                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │
│  │  │ Auth Service│  │Email Parser │  │Notification │          │  │
│  │  │  (Supabase) │  │   Service   │  │  Service    │          │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │  │
│  │  │Transaction  │  │Card Perks   │  │Spending Limit│         │  │
│  │  │   Service   │  │   Service   │  │   Service    │         │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Background Workers (Upstash Redis Queue)                    │  │
│  │  - Initial Email Sync Worker (Process 1)                     │  │
│  │  - Card Perks Scraper Worker (Process 3)                     │  │
│  │  - Real-time Email Processor (Process 2)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  SSE Manager (Server-Sent Events)                            │  │
│  │  - Real-time transaction notifications                        │  │
│  │  - Keep-alive connection management                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│               EXTERNAL SERVICES                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │Supabase     │  │ Gmail API   │  │ Upstash     │                │
│  │(PostgreSQL) │  │ + Pub/Sub   │  │ Redis       │                │
│  │+ Auth       │  │             │  │             │                │
│  └─────────────┘  └─────────────┘  └─────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema (Supabase PostgreSQL)

### **ERD (Entity Relationship Diagram)**

```
┌─────────────────────────┐
│        profiles         │  (Supabase Auth extension)
├─────────────────────────┤
│ id (PK) UUID            │
│ email (UNIQUE)          │
│ full_name               │
│ avatar_url              │
│ global_spending_limit   │
│ created_at              │
│ updated_at              │
└───────────┬─────────────┘
            │
            │ 1:N
            │
┌───────────▼─────────────┐
│    credit_cards         │
├─────────────────────────┤
│ id (PK) UUID            │
│ user_id (FK)            │
│ bank_name               │
│ card_last_4             │
│ card_holder_name        │
│ card_type               │
│ statement_day           │
│ sender_pattern          │
│ created_at              │
│ updated_at              │
└───────────┬─────────────┘
            │
            │ 1:N
            ├─────────────────────────┐
            │                         │
┌───────────▼─────────────┐  ┌────────▼────────────────┐
│ current_transactions    │  │ statement_transactions  │
├─────────────────────────┤  ├─────────────────────────┤
│ id (PK) UUID            │  │ id (PK) UUID            │
│ card_id (FK)            │  │ card_id (FK)            │
│ date                    │  │ statement_id (FK)       │
│ merchant                │  │ date                    │
│ amount                  │  │ merchant                │
│ category                │  │ amount                  │
│ category_manual         │  │ category                │
│ type                    │  │ type                    │
│ email_data JSONB        │  │ email_data JSONB        │
│ created_at              │  │ created_at              │
└─────────────────────────┘  └─────────────────────────┘
                                        │
                                        │ N:1
                             ┌──────────▼──────────────┐
                             │      statements         │
                             ├─────────────────────────┤
                             │ id (PK) UUID            │
                             │ card_id (FK)            │
                             │ month                   │
                             │ year                    │
                             │ cycle_start             │
                             │ cycle_end               │
                             │ due_date                │
                             │ total_due               │
                             │ min_due                 │
                             │ is_paid                 │
                             │ paid_date               │
                             │ created_at              │
                             └─────────────────────────┘

┌─────────────────────────┐
│     card_perks          │
├─────────────────────────┤
│ id (PK) UUID            │
│ card_id (FK)            │
│ type                    │
│ description             │
│ value                   │
│ category                │
│ valid_from              │
│ valid_to                │
│ created_at              │
└─────────────────────────┘

┌─────────────────────────┐
│   spending_limits       │
├─────────────────────────┤
│ id (PK) UUID            │
│ user_id (FK)            │
│ type (GLOBAL/CATEGORY)  │
│ category_name           │
│ limit_amount            │
│ current_spending        │
│ alert_threshold         │
│ is_active               │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│   email_patterns        │
├─────────────────────────┤
│ id (PK) UUID            │
│ bank_name               │
│ sender_email            │
│ subject_keywords TEXT[] │
│ transaction_regex       │
│ statement_regex         │
│ card_regex              │
│ amount_regex            │
│ created_at              │
└─────────────────────────┘

┌─────────────────────────┐
│   gmail_tokens          │  (Encrypted storage)
├─────────────────────────┤
│ id (PK) UUID            │
│ user_id (FK)            │
│ access_token_enc        │
│ refresh_token_enc       │
│ expires_at              │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│   processing_queue      │  (Upstash Redis metadata)
├─────────────────────────┤
│ id (PK) UUID            │
│ user_id (FK)            │
│ job_type                │
│ status                  │
│ progress                │
│ message                 │
│ started_at              │
│ completed_at            │
│ error                   │
└─────────────────────────┘
```

---

## 🔐 Authentication Flow (Supabase Auth)

```typescript
// Flow Diagram
User clicks "Sign in with Google"
   │
   ├──► Supabase redirects to Google OAuth
   │
   ├──► User grants Gmail permissions
   │
   ├──► Google redirects back with code
   │
   ├──► Supabase exchanges code for tokens
   │
   ├──► Supabase creates/updates user in auth.users
   │
   ├──► Trigger: Create profile in public.profiles
   │
   ├──► Store encrypted Gmail tokens in gmail_tokens
   │
   ├──► Frontend receives session + JWT
   │
   ├──► Check if new user (profile.created_at)
   │    │
   │    ├──► NEW USER
   │    │    │
   │    │    ├──► Redirect to loading page
   │    │    │
   │    │    ├──► Enqueue Process 1 (email sync)
   │    │    │
   │    │    ├──► Enqueue Process 2 (pub/sub setup)
   │    │    │
   │    │    └──► SSE connection for progress updates
   │    │
   │    └──► EXISTING USER
   │         │
   │         └──► Redirect to dashboard
   │
   └──► Load user data via API calls
```

---

## 📧 Email Parsing Logic

### **Email Pattern Matching**

```typescript
// lib/email-patterns.ts

export interface EmailPattern {
  bank: string;
  senderRegex: RegExp[];
  subjectKeywords: string[];
  cardRegex: RegExp;
  amountRegex: RegExp;
  merchantRegex: RegExp;
  dateRegex: RegExp;
  typeKeywords: {
    debit: string[];
    credit: string[];
    reversal: string[];
  };
}

export const EMAIL_PATTERNS: EmailPattern[] = [
  {
    bank: 'SBI',
    senderRegex: [
      /sbicard\.com$/i,
      /sbicardservices\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'purchase'],
    cardRegex: /X{4,}(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /(\d{2}-\w{3}-\d{4}|\d{2}\/\d{2}\/\d{4})/,
    typeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid'],
      credit: ['credited', 'cashback', 'refund', 'reward'],
      reversal: ['reversed', 'chargeback']
    }
  },
  {
    bank: 'HDFC',
    senderRegex: [
      /hdfcbank\.com$/i,
      /alerts\.hdfcbank\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert', 'update'],
    cardRegex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\./i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2})/,
    typeKeywords: {
      debit: ['debited'],
      credit: ['credited'],
      reversal: ['reversed']
    }
  },
  {
    bank: 'Axis',
    senderRegex: [
      /axisbank\.com$/i,
      /alerts\.axisbank\.com$/i
    ],
    subjectKeywords: ['transaction', 'alert'],
    cardRegex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    typeKeywords: {
      debit: ['debited'],
      credit: ['credited'],
      reversal: ['reversed']
    }
  }
  // Add more banks...
];

export const STATEMENT_PATTERNS: EmailPattern[] = [
  {
    bank: 'SBI',
    senderRegex: [/statements\.sbicard\.com$/i],
    subjectKeywords: ['statement', 'credit card statement'],
    // ... regex patterns for statement parsing
  }
  // Add more banks...
];
```

### **Email Parser Service**

```typescript
// lib/services/email-parser.ts

import { gmail_v1 } from 'googleapis';
import { EMAIL_PATTERNS, STATEMENT_PATTERNS } from '../email-patterns';

export interface ParsedTransaction {
  type: 'TRANSACTION';
  cardLast4: string;
  amount: number;
  merchant: string;
  date: Date;
  transactionType: 'DEBIT' | 'CREDIT' | 'REVERSAL';
  category: string;
  emailData: any;
}

export interface ParsedStatement {
  type: 'STATEMENT';
  cardLast4: string;
  month: number;
  year: number;
  cycleStart: Date;
  cycleEnd: Date;
  dueDate: Date;
  totalDue: number;
  minDue: number;
  emailData: any;
}

export class EmailParserService {
  async parseEmail(email: gmail_v1.Schema$Message): Promise<ParsedTransaction | ParsedStatement | null> {
    const from = this.getHeader(email, 'From');
    const subject = this.getHeader(email, 'Subject');
    const body = this.getEmailBody(email);

    // Find matching pattern
    const pattern = EMAIL_PATTERNS.find(p => 
      p.senderRegex.some(regex => regex.test(from))
    );

    if (!pattern) return null;

    // Check if statement
    const isStatement = STATEMENT_PATTERNS.some(sp =>
      sp.subjectKeywords.some(kw => subject.toLowerCase().includes(kw))
    );

    if (isStatement) {
      return this.parseStatement(email, pattern, body);
    } else {
      return this.parseTransaction(email, pattern, body);
    }
  }

  private parseTransaction(
    email: gmail_v1.Schema$Message,
    pattern: EmailPattern,
    body: string
  ): ParsedTransaction | null {
    try {
      // Extract card last 4
      const cardMatch = body.match(pattern.cardRegex);
      const cardLast4 = cardMatch ? cardMatch[1] : null;
      if (!cardLast4) return null;

      // Extract amount
      const amountMatch = body.match(pattern.amountRegex);
      const amount = amountMatch ? 
        parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

      // Extract merchant
      const merchantMatch = body.match(pattern.merchantRegex);
      const merchant = merchantMatch ? 
        merchantMatch[1].trim() : 'Unknown';

      // Extract date
      const dateMatch = body.match(pattern.dateRegex);
      const date = dateMatch ? new Date(dateMatch[1]) : new Date();

      // Determine transaction type
      let transactionType: 'DEBIT' | 'CREDIT' | 'REVERSAL' = 'DEBIT';
      for (const [type, keywords] of Object.entries(pattern.typeKeywords)) {
        if (keywords.some(kw => body.toLowerCase().includes(kw))) {
          transactionType = type.toUpperCase() as any;
          break;
        }
      }

      // Auto-categorize
      const category = this.categorizeTransaction(merchant);

      return {
        type: 'TRANSACTION',
        cardLast4,
        amount,
        merchant,
        date,
        transactionType,
        category,
        emailData: {
          messageId: email.id,
          from: this.getHeader(email, 'From'),
          subject: this.getHeader(email, 'Subject'),
          receivedAt: new Date(parseInt(email.internalDate || '0'))
        }
      };
    } catch (error) {
      console.error('Failed to parse transaction:', error);
      return null;
    }
  }

  private parseStatement(
    email: gmail_v1.Schema$Message,
    pattern: EmailPattern,
    body: string
  ): ParsedStatement | null {
    // Similar parsing logic for statements
    // Extract: card, month, year, dates, amounts
    return null; // Implementation similar to transaction
  }

  private categorizeTransaction(merchant: string): string {
    const categories: Record<string, string[]> = {
      'Food & Dining': ['swiggy', 'zomato', 'dominos', 'pizza', 'restaurant'],
      'Travel': ['uber', 'ola', 'rapido', 'airline', 'irctc'],
      'Shopping': ['amazon', 'flipkart', 'myntra', 'ajio'],
      'Bills': ['airtel', 'jio', 'electricity', 'water'],
      'Entertainment': ['netflix', 'prime', 'spotify', 'youtube'],
      'Fuel': ['petrol', 'diesel', 'fuel', 'hp', 'bharat petroleum'],
      // ... more categories
    };

    const merchantLower = merchant.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => merchantLower.includes(kw))) {
        return category;
      }
    }

    return 'Miscellaneous';
  }

  private getHeader(email: gmail_v1.Schema$Message, name: string): string {
    const header = email.payload?.headers?.find(
      h => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || '';
  }

  private getEmailBody(email: gmail_v1.Schema$Message): string {
    // Extract body from email parts
    // Handle multipart, base64 encoding, etc.
    return ''; // Implementation details
  }
}
```

---

## 🔄 Background Workers (Upstash Redis Queue)

```typescript
// lib/queue/worker.ts

import { Redis } from '@upstash/redis';
import { Queue } from '@upstash/qstash';

const redis = Redis.fromEnv();
const qstash = new Queue({
  token: process.env.QSTASH_TOKEN!,
});

export type JobType = 
  | 'initial-sync'
  | 'process-email'
  | 'fetch-perks'
  | 'check-spending-limits';

export interface Job {
  id: string;
  type: JobType;
  userId: string;
  data: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export class JobQueue {
  async enqueue(type: JobType, userId: string, data: any): Promise<string> {
    const jobId = crypto.randomUUID();
    
    const job: Job = {
      id: jobId,
      type,
      userId,
      data,
      status: 'pending',
      progress: 0,
      message: 'Queued',
      createdAt: new Date()
    };

    // Store in Redis
    await redis.set(`job:${jobId}`, JSON.stringify(job));
    
    // Add to queue
    await redis.lpush(`queue:${type}`, jobId);

    // Trigger worker via QStash
    await qstash.publish({
      url: `${process.env.NEXT_PUBLIC_URL}/api/workers/${type}`,
      body: JSON.stringify({ jobId, userId, data })
    });

    return jobId;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const data = await redis.get(`job:${jobId}`);
    return data ? JSON.parse(data as string) : null;
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;

    const updated = { ...job, ...updates };
    await redis.set(`job:${jobId}`, JSON.stringify(updated));

    // Notify via SSE if user is connected
    // (handled by SSE manager)
  }
}

export const jobQueue = new JobQueue();
```

### **Worker 1: Initial Email Sync**

```typescript
// app/api/workers/initial-sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { gmail } from 'googleapis';
import { jobQueue } from '@/lib/queue/worker';
import { EmailParserService } from '@/lib/services/email-parser';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { jobId, userId, data } = await req.json();

  try {
    await jobQueue.updateJob(jobId, {
      status: 'processing',
      progress: 0,
      message: 'Starting email sync...',
      startedAt: new Date()
    });

    // Get Gmail client
    const gmailClient = await getGmailClient(userId);
    
    // Fetch emails from last 2 years
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    await jobQueue.updateJob(jobId, {
      progress: 10,
      message: 'Fetching emails...'
    });

    const messages = await fetchHistoricalEmails(
      gmailClient, 
      twoYearsAgo
    );

    await jobQueue.updateJob(jobId, {
      progress: 30,
      message: `Found ${messages.length} emails, parsing...`
    });

    // Parse and store
    const parser = new EmailParserService();
    const supabase = createClient();
    
    let cardCount = 0;
    let transactionCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const parsed = await parser.parseEmail(messages[i]);
      
      if (parsed && parsed.type === 'TRANSACTION') {
        // Find or create card
        const { data: card } = await supabase
          .from('credit_cards')
          .select('id')
          .eq('user_id', userId)
          .eq('card_last_4', parsed.cardLast4)
          .single();

        let cardId = card?.id;
        
        if (!cardId) {
          const { data: newCard } = await supabase
            .from('credit_cards')
            .insert({
              user_id: userId,
              card_last_4: parsed.cardLast4,
              bank_name: 'Unknown', // Detect from email
              // ... other fields
            })
            .select('id')
            .single();
          
          cardId = newCard?.id;
          cardCount++;

          // Enqueue perks fetch
          await jobQueue.enqueue('fetch-perks', userId, { cardId });
        }

        // Store transaction
        await supabase
          .from('current_transactions')
          .insert({
            card_id: cardId,
            date: parsed.date,
            merchant: parsed.merchant,
            amount: parsed.amount,
            category: parsed.category,
            type: parsed.transactionType,
            email_data: parsed.emailData
          });

        transactionCount++;
      }

      // Update progress
      const progress = 30 + Math.floor((i / messages.length) * 60);
      await jobQueue.updateJob(jobId, {
        progress,
        message: `Processed ${i + 1}/${messages.length} emails`
      });
    }

    await jobQueue.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: `✅ Found ${cardCount} cards, ${transactionCount} transactions`,
      completedAt: new Date()
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    await jobQueue.updateJob(jobId, {
      status: 'failed',
      progress: -1,
      message: 'Error occurred',
      error: error.message,
      completedAt: new Date()
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function fetchHistoricalEmails(
  gmail: any,
  fromDate: Date
): Promise<any[]> {
  // Fetch emails with query
  const query = `after:${Math.floor(fromDate.getTime() / 1000)}`;
  
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 500 // Adjust based on needs
  });

  const messageIds = response.data.messages || [];
  
  // Fetch full messages
  const messages = await Promise.all(
    messageIds.map((msg: any) =>
      gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      }).then((res: any) => res.data)
    )
  );

  return messages;
}

async function getGmailClient(userId: string) {
  // Get encrypted tokens from DB
  // Decrypt and create Gmail client
  // Implementation details...
  return null;
}
```

### **Worker 2: Real-time Email Processor**

```typescript
// app/api/workers/process-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue/worker';
import { EmailParserService } from '@/lib/services/email-parser';
import { SpendingLimitService } from '@/lib/services/spending-limit';
import { createClient } from '@/lib/supabase/server';
import { sseManager } from '@/lib/sse/manager';

export async function POST(req: NextRequest) {
  const { messageId, userId } = await req.json();

  try {
    // Get Gmail client and fetch email
    const gmailClient = await getGmailClient(userId);
    const email = await gmailClient.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    // Parse email
    const parser = new EmailParserService();
    const parsed = await parser.parseEmail(email.data);

    if (!parsed) {
      return NextResponse.json({ skipped: true });
    }

    const supabase = createClient();

    if (parsed.type === 'TRANSACTION') {
      // Check for duplicate
      const isDuplicate = await checkDuplicateTransaction(
        parsed.cardLast4,
        parsed.amount,
        parsed.merchant,
        parsed.date
      );

      if (isDuplicate) {
        return NextResponse.json({ duplicate: true });
      }

      // Find or create card
      const { data: card } = await supabase
        .from('credit_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_last_4', parsed.cardLast4)
        .single();

      let cardId = card?.id;

      if (!cardId) {
        const { data: newCard } = await supabase
          .from('credit_cards')
          .insert({
            user_id: userId,
            card_last_4: parsed.cardLast4,
            bank_name: 'Unknown',
          })
          .select('id')
          .single();

        cardId = newCard?.id;

        // Enqueue perks fetch
        await jobQueue.enqueue('fetch-perks', userId, { cardId });
      }

      // Store transaction
      const { data: transaction } = await supabase
        .from('current_transactions')
        .insert({
          card_id: cardId,
          date: parsed.date,
          merchant: parsed.merchant,
          amount: parsed.amount,
          category: parsed.category,
          type: parsed.transactionType,
          email_data: parsed.emailData
        })
        .select()
        .single();

      // Check spending limits
      const limitService = new SpendingLimitService();
      const limitExceeded = await limitService.checkLimits(
        userId,
        transaction
      );

      if (limitExceeded) {
        // Send email alert via Gmail API
        await sendLimitAlert(userId, limitExceeded);
      }

      // Send SSE notification if user is online
      await sseManager.sendToUser(userId, 'transaction:new', {
        transaction,
        card
      });

    } else if (parsed.type === 'STATEMENT') {
      // Process statement
      const { data: card } = await supabase
        .from('credit_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('card_last_4', parsed.cardLast4)
        .single();

      if (!card) return NextResponse.json({ error: 'Card not found' });

      // Create statement
      const { data: statement } = await supabase
        .from('statements')
        .insert({
          card_id: card.id,
          month: parsed.month,
          year: parsed.year,
          cycle_start: parsed.cycleStart,
          cycle_end: parsed.cycleEnd,
          due_date: parsed.dueDate,
          total_due: parsed.totalDue,
          min_due: parsed.minDue
        })
        .select()
        .single();

      // Move transactions to statement
      await moveTransactionsToStatement(card.id, statement.id, parsed);

      // Send SSE notification
      await sseManager.sendToUser(userId, 'statement:generated', {
        statement,
        card
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Process email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function checkDuplicateTransaction(
  cardLast4: string,
  amount: number,
  merchant: string,
  date: Date
): Promise<boolean> {
  const supabase = createClient();
  
  const oneMinBefore = new Date(date.getTime() - 60000);
  const oneMinAfter = new Date(date.getTime() + 60000);

  const { data } = await supabase
    .from('current_transactions')
    .select('id')
    .eq('amount', amount)
    .ilike('merchant', `%${merchant}%`)
    .gte('date', oneMinBefore.toISOString())
    .lte('date', oneMinAfter.toISOString())
    .limit(1);

  return !!data && data.length > 0;
}

async function moveTransactionsToStatement(
  cardId: string,
  statementId: string,
  parsed: any
) {
  const supabase = createClient();

  // Get transactions in cycle
  const { data: transactions } = await supabase
    .from('current_transactions')
    .select('*')
    .eq('card_id', cardId)
    .gte('date', parsed.cycleStart.toISOString())
    .lte('date', parsed.cycleEnd.toISOString());

  if (!transactions || transactions.length === 0) return;

  // Insert into statement_transactions
  await supabase
    .from('statement_transactions')
    .insert(
      transactions.map(t => ({
        ...t,
        statement_id: statementId
      }))
    );

  // Delete from current_transactions
  await supabase
    .from('current_transactions')
    .delete()
    .eq('card_id', cardId)
    .gte('date', parsed.cycleStart.toISOString())
    .lte('date', parsed.cycleEnd.toISOString());
}
```

---

## 📡 Server-Sent Events (SSE) Implementation

```typescript
// lib/sse/manager.ts

export interface SSEConnection {
  userId: string;
  controller: ReadableStreamDefaultController;
  lastPing: number;
}

class SSEManager {
  private connections = new Map<string, SSEConnection>();

  addConnection(
    userId: string,
    controller: ReadableStreamDefaultController
  ): void {
    this.connections.set(userId, {
      userId,
      controller,
      lastPing: Date.now()
    });

    // Send initial connection message
    this.sendToUser(userId, 'connected', { message: 'SSE connected' });

    // Start keep-alive
    this.startKeepAlive(userId);
  }

  removeConnection(userId: string): void {
    this.connections.delete(userId);
  }

  isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  async sendToUser(userId: string, event: string, data: any): Promise<void> {
    const connection = this.connections.get(userId);
    if (!connection) return;

    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      const encoder = new TextEncoder();
      connection.controller.enqueue(encoder.encode(message));
      connection.lastPing = Date.now();
    } catch (error) {
      console.error('SSE send error:', error);
      this.removeConnection(userId);
    }
  }

  private startKeepAlive(userId: string): void {
    const interval = setInterval(() => {
      const connection = this.connections.get(userId);
      if (!connection) {
        clearInterval(interval);
        return;
      }

      // Check if connection is stale (no activity for 60s)
      if (Date.now() - connection.lastPing > 60000) {
        this.removeConnection(userId);
        clearInterval(interval);
        return;
      }

      // Send ping
      this.sendToUser(userId, 'ping', { timestamp: Date.now() });
    }, 30000); // Every 30 seconds
  }
}

export const sseManager = new SSEManager();
```

```typescript
// app/api/notifications/sse/route.ts

import { NextRequest } from 'next/server';
import { sseManager } from '@/lib/sse/manager';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  // Verify authentication
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      sseManager.addConnection(user.id, controller);
    },
    cancel() {
      sseManager.removeConnection(user.id);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## 🎨 CRED-Inspired UI Components

### **Color System & Theme**

```typescript
// lib/theme.ts

export const theme = {
  colors: {
    background: {
      primary: '#0F0F0F',
      secondary: '#1A1A1A',
      tertiary: '#2A2A2A',
    },
    accent: {
      purple: '#9B6BFF',
      pink: '#FF6B9D',
      blue: '#4D9BFF',
      green: '#00D9A3',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      tertiary: '#707070',
    },
    status: {
      success: '#00D9A3',
      error: '#FF4D4D',
      warning: '#FFB84D',
      info: '#4D9BFF',
    },
  },
  glassmorphism: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdrop: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
};
```

```typescript
// tailwind.config.ts

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cred-dark': '#0F0F0F',
        'cred-secondary': '#1A1A1A',
        'cred-tertiary': '#2A2A2A',
        'cred-purple': '#9B6BFF',
        'cred-pink': '#FF6B9D',
        'cred-blue': '#4D9BFF',
        'cred-green': '#00D9A3',
      },
      screens: {
        'mobile': '320px',
        'tablet': '768px',
        'laptop': '1024px',
        'macbook-14': '1512px',
        'desktop': '1920px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

export default config;
```

### **Credit Card Component**

```typescript
// components/ui/CreditCard.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard as CardIcon } from 'lucide-react';

interface CreditCardProps {
  card: {
    id: string;
    bank_name: string;
    card_last_4: string;
    card_holder_name: string;
    card_type: string;
  };
  currentDue?: number;
  dueDate?: Date;
  onClick?: () => void;
}

export const CreditCard: React.FC<CreditCardProps> = ({
  card,
  currentDue,
  dueDate,
  onClick,
}) => {
  const getBankColor = (bank: string) => {
    const colors: Record<string, string> = {
      'SBI': 'from-blue-600 to-blue-800',
      'HDFC': 'from-red-600 to-red-800',
      'Axis': 'from-purple-600 to-purple-800',
      'ICICI': 'from-orange-600 to-orange-800',
    };
    return colors[bank] || 'from-gray-600 to-gray-800';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
      onClick={onClick}
    >
      <div
        className={`
          relative w-full h-48 rounded-2xl p-6
          bg-gradient-to-br ${getBankColor(card.bank_name)}
          backdrop-blur-lg
          border border-white/10
          shadow-2xl
          overflow-hidden
        `}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />

        {/* Animated gradient background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Card content */}
        <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Bank name and card type */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">
              {card.bank_name}
            </h3>
            <div className="text-white/80 text-sm font-medium">
              {card.card_type}
            </div>
          </div>

          {/* Card number */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white/90">
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <span key={i}>•</span>
                ))}
              </div>
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <span key={i}>•</span>
                ))}
              </div>
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <span key={i}>•</span>
                ))}
              </div>
              <span className="font-mono text-lg tracking-wider">
                {card.card_last_4}
              </span>
            </div>
          </div>

          {/* Cardholder name and amount */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-white/60 mb-1">CARDHOLDER</p>
              <p className="text-sm font-semibold text-white">
                {card.card_holder_name}
              </p>
            </div>
            {currentDue !== undefined && (
              <div className="text-right">
                <p className="text-xs text-white/60 mb-1">CURRENT DUE</p>
                <p className="text-xl font-bold text-white">
                  ₹{currentDue.toLocaleString()}
                </p>
                {dueDate && (
                  <p className="text-xs text-white/80 mt-1">
                    Due: {dueDate.toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chip icon */}
        <div className="absolute top-6 right-6 opacity-10">
          <CardIcon size={80} />
        </div>
      </div>
    </motion.div>
  );
};
```

### **Dashboard Layout**

```typescript
// app/(dashboard)/dashboard/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard } from '@/components/ui/CreditCard';
import { SpendingSummary } from '@/components/dashboard/SpendingSummary';
import { useSSE } from '@/hooks/useSSE';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  // Connect to SSE for real-time updates
  useSSE({
    onTransaction: (data) => {
      // Update UI with new transaction
      console.log('New transaction:', data);
    },
    onStatement: (data) => {
      // Refresh cards
      loadCards();
    },
  });

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: cardsData } = await supabase
      .from('credit_cards')
      .select(`
        *,
        statements (
          total_due,
          due_date
        )
      `)
      .eq('user_id', user.id)
      .order('bank_name');

    // Group by bank
    const grouped = (cardsData || []).reduce((acc, card) => {
      if (!acc[card.bank_name]) {
        acc[card.bank_name] = [];
      }
      acc[card.bank_name].push(card);
      return acc;
    }, {} as Record<string, any[]>);

    setCards(grouped);
    setLoading(false);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cred-dark via-cred-secondary to-cred-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Your Cards
          </h1>
          <p className="text-gray-400">
            Manage all your credit cards in one place
          </p>
        </motion.div>

        {/* Spending Summary */}
        <SpendingSummary />

        {/* Cards grouped by bank */}
        <div className="space-y-12 mt-12">
          {Object.entries(cards).map(([bank, bankCards], index) => (
            <motion.div
              key={bank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <h2 className="text-2xl font-semibold text-white mb-6">
                {bank}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bankCards.map((card) => (
                  <CreditCard
                    key={card.id}
                    card={card}
                    currentDue={card.statements?.[0]?.total_due}
                    dueDate={card.statements?.[0]?.due_date ? 
                      new Date(card.statements[0].due_date) : undefined
                    }
                    onClick={() => router.push(`/cards/${card.id}`)}
                  />
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
    <div className="min-h-screen bg-gradient-to-br from-cred-dark via-cred-secondary to-cred-dark p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="h-12 w-64 bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### **Spending Summary Component**

```typescript
// components/dashboard/SpendingSummary.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export const SpendingSummary: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get spending limits
    const { data: limits } = await supabase
      .from('spending_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Get current spending
    const { data: cards } = await supabase
      .from('credit_cards')
      .select('id')
      .eq('user_id', user.id);

    const cardIds = cards?.map(c => c.id) || [];

    const { data: transactions } = await supabase
      .from('current_transactions')
      .select('amount, category')
      .in('card_id', cardIds)
      .eq('type', 'DEBIT');

    const totalSpending = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

    // Category breakdown
    const categoryBreakdown = transactions?.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>) || {};

    setSummary({
      totalSpending,
      limits,
      categoryBreakdown,
    });
  };

  if (!summary) return null;

  const globalLimit = summary.limits?.find((l: any) => l.type === 'GLOBAL');
  const percentage = globalLimit ? 
    (summary.totalSpending / globalLimit.limit_amount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">
          Spending Summary
        </h2>
        <TrendingUp className="w-6 h-6 text-cred-green" />
      </div>

      {/* Global limit progress */}
      {globalLimit && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">Current Spending</span>
            <span className="text-white font-semibold">
              ₹{summary.totalSpending.toLocaleString()} / 
              ₹{globalLimit.limit_amount.toLocaleString()}
            </span>
          </div>

          <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                percentage >= 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                percentage >= 80 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                'bg-gradient-to-r from-cred-blue to-cred-purple'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(percentage, 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />

            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {percentage >= globalLimit.alert_threshold && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mt-3 text-sm text-yellow-400"
            >
              <AlertCircle className="w-4 h-4" />
              <span>
                {percentage >= 100 ? 
                  'Spending limit exceeded!' : 
                  'Approaching spending limit'
                }
              </span>
            </motion.div>
          )}
        </div>
      )}

      {/* Category breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(summary.categoryBreakdown)
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 4)
          .map(([category, amount]: any) => (
            <div
              key={category}
              className="bg-white/5 rounded-lg p-4 border border-white/5"
            >
              <p className="text-xs text-gray-400 mb-1">{category}</p>
              <p className="text-lg font-semibold text-white">
                ₹{amount.toLocaleString()}
              </p>
            </div>
          ))}
      </div>
    </motion.div>
  );
};
```

### **Loading Page (First-time Users)**

```typescript
// app/(dashboard)/loading/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ProcessStatus {
  progress: number;
  message: string;
  isComplete: boolean;
}

export default function LoadingPage() {
  const [processes, setProcesses] = useState<Record<string, ProcessStatus>>({
    'process-1': { progress: 0, message: 'Initializing...', isComplete: false },
    'process-2': { progress: 0, message: 'Waiting...', isComplete: false },
    'process-3': { progress: 0, message: 'Waiting...', isComplete: false },
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Connect to SSE for progress updates
    const eventSource = new EventSource('/api/notifications/sse');

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProcesses(prev => ({
        ...prev,
        [data.process]: {
          progress: data.progress,
          message: data.message,
          isComplete: data.progress === 100,
        },
      }));
    });

    eventSource.addEventListener('complete', () => {
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const allComplete = Object.values(processes).every(p => p.isComplete);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cred-dark via-purple-900/20 to-cred-dark flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          🚀 Setting Up Your Dashboard
        </h1>

        <div className="space-y-6">
          {Object.entries(processes).map(([key, status], index) => (
            <ProcessItem
              key={key}
              number={index + 1}
              progress={status.progress}
              message={status.message}
              isComplete={status.isComplete}
            />
          ))}
        </div>

        {!allComplete && (
          <p className="text-gray-400 text-center mt-8">
            This may take 2-3 minutes...
          </p>
        )}

        {allComplete && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-cred-green text-center mt-8 font-semibold"
          >
            ✅ Setup complete! Redirecting...
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

const ProcessItem: React.FC<{
  number: number;
  progress: number;
  message: string;
  isComplete: boolean;
}> = ({ number, progress, message, isComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: number * 0.1 }}
      className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10"
    >
      <div className="flex items-center gap-4 mb-3">
        {isComplete ? (
          <CheckCircle className="w-6 h-6 text-cred-green" />
        ) : (
          <Loader className="w-6 h-6 text-cred-blue animate-spin" />
        )}
        <span className="text-white font-medium">Process {number}</span>
      </div>

      <div className="mb-2">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cred-blue to-cred-purple"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <p className="text-gray-300 text-sm">{message}</p>
    </motion.div>
  );
};
```

### **Transaction Timeline**

```typescript
// components/transactions/TransactionTimeline.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, CreditCard } from 'lucide-react';

interface Transaction {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  category: string;
  type: 'DEBIT' | 'CREDIT' | 'REVERSAL';
}

interface TransactionTimelineProps {
  transactions: Transaction[];
}

export const TransactionTimeline: React.FC<TransactionTimelineProps> = ({ 
  transactions 
}) => {
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Food & Dining': '🍕',
      'Travel': '✈️',
      'Shopping': '🛍️',
      'Bills & Utilities': '💡',
      'Entertainment': '🎬',
      'Fuel': '⛽',
      'Healthcare': '🏥',
    };
    return icons[category] || '💳';
  };

  const getAmountColor = (type: string) => {
    return type === 'CREDIT' ? 'text-cred-green' : 'text-white';
  };

  return (
    <div className="space-y-4">
      {transactions.map((transaction, index) => (
        <motion.div
          key={transaction.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="relative flex gap-4 group"
        >
          {/* Timeline line */}
          {index !== transactions.length - 1 && (
            <div className="absolute left-[23px] top-12 bottom-0 w-px bg-gradient-to-b from-cred-purple/50 to-transparent" />
          )}

          {/* Icon */}
          <div className="relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cred-purple to-cred-pink flex items-center justify-center text-2xl z-10 group-hover:scale-110 transition-transform">
            {getCategoryIcon(transaction.category)}
          </div>

          {/* Content */}
          <div className="flex-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 group-hover:bg-white/10 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-white">{transaction.merchant}</h3>
                <p className="text-sm text-gray-400 mt-1">{transaction.category}</p>

                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(transaction.date).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className={`text-xl font-bold ${getAmountColor(transaction.type)}`}>
                  {transaction.type === 'CREDIT' ? '+' : ''}₹{transaction.amount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
```

---

## 🔧 Complete API Routes

### **Authentication Routes**

```typescript
// app/api/auth/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jobQueue } from '@/lib/queue/worker';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if new user
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', data.user.id)
        .single();

      const isNewUser = profile && 
        new Date(profile.created_at).getTime() > Date.now() - 60000;

      if (isNewUser) {
        // Enqueue initial sync
        await jobQueue.enqueue('initial-sync', data.user.id, {});
        
        // Redirect to loading page
        return NextResponse.redirect(new URL('/loading', req.url));
      }

      // Existing user - go to dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Error - redirect to login
  return NextResponse.redirect(new URL('/login?error=auth', req.url));
}
```

### **Cards API**

```typescript
// app/api/cards/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: cards } = await supabase
    .from('credit_cards')
    .select(`
      *,
      statements!left (
        id,
        total_due,
        due_date,
        is_paid
      )
    `)
    .eq('user_id', user.id)
    .order('bank_name');

  // Group by bank
  const groupedByBank = (cards || []).reduce((acc, card) => {
    if (!acc[card.bank_name]) {
      acc[card.bank_name] = [];
    }
    acc[card.bank_name].push(card);
    return acc;
  }, {} as Record<string, any[]>);

  return NextResponse.json({
    cards: cards || [],
    grouped_by_bank: groupedByBank,
  });
}
```

```typescript
// app/api/cards/[cardId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: card } = await supabase
    .from('credit_cards')
    .select(`
      *,
      card_perks (*),
      statements (
        *,
        statement_transactions (*)
      ),
      current_transactions (*)
    `)
    .eq('id', params.cardId)
    .eq('user_id', user.id)
    .single();

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json(card);
}
```

### **Transactions API**

```typescript
// app/api/transactions/current/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cardId = searchParams.get('cardId');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('current_transactions')
    .select('*, credit_cards!inner(user_id)', { count: 'exact' })
    .eq('credit_cards.user_id', user.id)
    .order('date', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (cardId) {
    query = query.eq('card_id', cardId);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: transactions, count } = await query;

  return NextResponse.json({
    transactions: transactions || [],
    total: count || 0,
    page,
    limit,
  });
}
```

### **Spending Limits API**

```typescript
// app/api/spending-limits/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: limits } = await supabase
    .from('spending_limits')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

  return NextResponse.json({ limits: limits || [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { type, category_name, limit_amount, alert_threshold } = body;

  // Validate input
  if (!type || !limit_amount) {
    return NextResponse.json(
      { error: 'Missing required fields' }, 
      { status: 400 }
    );
  }

  if (type === 'CATEGORY' && !category_name) {
    return NextResponse.json(
      { error: 'Category name required for category limits' }, 
      { status: 400 }
    );
  }

  const { data: limit, error } = await supabase
    .from('spending_limits')
    .insert({
      user_id: user.id,
      type,
      category_name,
      limit_amount,
      alert_threshold: alert_threshold || 90,
      current_spending: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ limit });
}
```

---

## 🗄️ Supabase Database Migrations

### **Migration 1: Create Profiles Table**

```sql
-- 001_create_profiles.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  global_spending_limit DECIMAL(12, 2) DEFAULT 50000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### **Migration 2: Create Credit Cards Table**

```sql
-- 002_create_credit_cards.sql

CREATE TABLE public.credit_cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  card_last_4 TEXT NOT NULL,
  card_holder_name TEXT,
  card_type TEXT, -- VISA, MASTERCARD, RUPAY, AMEX
  statement_day INTEGER CHECK (statement_day >= 1 AND statement_day <= 31),
  sender_pattern TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_card UNIQUE(user_id, card_last_4)
);

-- Indexes
CREATE INDEX idx_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX idx_cards_last_4 ON public.credit_cards(card_last_4);

-- RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cards"
  ON public.credit_cards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON public.credit_cards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON public.credit_cards
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON public.credit_cards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### **Migration 3: Create Transactions Tables**

```sql
-- 003_create_transactions.sql

-- Current transactions (not in any statement)
CREATE TABLE public.current_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  merchant TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT, -- auto-categorized
  category_manual TEXT, -- user override
  type TEXT DEFAULT 'DEBIT' CHECK (type IN ('DEBIT', 'CREDIT', 'REVERSAL')),
  email_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Statements
CREATE TABLE public.statements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  due_date DATE NOT NULL,
  total_due DECIMAL(12, 2) NOT NULL,
  min_due DECIMAL(12, 2),
  is_paid BOOLEAN DEFAULT FALSE,
  paid_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_card_statement UNIQUE(card_id, month, year)
);

-- Statement transactions
CREATE TABLE public.statement_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
  statement_id UUID REFERENCES public.statements(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  merchant TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT,
  type TEXT DEFAULT 'DEBIT' CHECK (type IN ('DEBIT', 'CREDIT', 'REVERSAL')),
  email_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_current_trans_card_id ON public.current_transactions(card_id);
CREATE INDEX idx_current_trans_date ON public.current_transactions(date DESC);
CREATE INDEX idx_current_trans_category ON public.current_transactions(category);

CREATE INDEX idx_statements_card_id ON public.statements(card_id);
CREATE INDEX idx_statements_due_date ON public.statements(due_date);
CREATE INDEX idx_statements_is_paid ON public.statements(is_paid);

CREATE INDEX idx_statement_trans_card_id ON public.statement_transactions(card_id);
CREATE INDEX idx_statement_trans_statement_id ON public.statement_transactions(statement_id);
CREATE INDEX idx_statement_trans_date ON public.statement_transactions(date DESC);

-- RLS for current_transactions
ALTER TABLE public.current_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.current_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_cards
      WHERE credit_cards.id = current_transactions.card_id
      AND credit_cards.user_id = auth.uid()
    )
  );

-- Similar RLS policies for statements and statement_transactions...

-- Updated_at trigger
CREATE TRIGGER current_trans_updated_at
  BEFORE UPDATE ON public.current_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

### **Migration 4: Create Supporting Tables**

```sql
-- 004_create_supporting_tables.sql

-- Card perks
CREATE TABLE public.card_perks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
  type TEXT, -- CASHBACK, REWARD_POINTS, LOUNGE_ACCESS, etc.
  description TEXT NOT NULL,
  value TEXT,
  category TEXT,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_perks_card_id ON public.card_perks(card_id);

-- Spending limits
CREATE TABLE public.spending_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('GLOBAL', 'CATEGORY')),
  category_name TEXT,
  limit_amount DECIMAL(12, 2) NOT NULL,
  current_spending DECIMAL(12, 2) DEFAULT 0.00,
  alert_threshold INTEGER DEFAULT 90 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_limits_user_id ON public.spending_limits(user_id);
CREATE INDEX idx_limits_type ON public.spending_limits(type);
CREATE INDEX idx_limits_active ON public.spending_limits(is_active);

-- Gmail tokens (encrypted)
CREATE TABLE public.gmail_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gmail_tokens_user_id ON public.gmail_tokens(user_id);

-- Email patterns
CREATE TABLE public.email_patterns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject_keywords TEXT[] NOT NULL,
  transaction_regex TEXT,
  statement_regex TEXT,
  card_regex TEXT,
  amount_regex TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_patterns_bank ON public.email_patterns(bank_name);
CREATE INDEX idx_email_patterns_sender ON public.email_patterns(sender_email);

-- Processing queue metadata
CREATE TABLE public.processing_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= -1 AND progress <= 100),
  message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queue_user_id ON public.processing_queue(user_id);
CREATE INDEX idx_queue_status ON public.processing_queue(status);

-- RLS policies for all tables...
ALTER TABLE public.card_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- Add appropriate RLS policies...
```

### **Migration 5: Seed Email Patterns**

```sql
-- 005_seed_email_patterns.sql

INSERT INTO public.email_patterns (bank_name, sender_email, subject_keywords, transaction_regex, card_regex, amount_regex) VALUES
('SBI', 'alerts@sbicard.com', ARRAY['transaction', 'alert', 'spent'], 
 'transaction.*?(\d+\.\d{2})', 'X{4,}(\d{4})', '(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})'),
 
('HDFC', 'alerts@hdfcbank.com', ARRAY['transaction', 'alert'],
 'transaction.*?(\d+\.\d{2})', 'xx(\d{4})', 'INR\s?([0-9,]+\.?\d{0,2})'),
 
('Axis', 'alerts@axisbank.com', ARRAY['transaction', 'alert'],
 'transaction.*?(\d+\.\d{2})', '\*\*(\d{4})', 'Rs\.?\s?([0-9,]+\.?\d{0,2})'),
 
('ICICI', 'alerts@icicibank.com', ARRAY['transaction', 'update'],
 'transaction.*?(\d+\.\d{2})', 'XX(\d{4})', 'INR\s?([0-9,]+\.?\d{0,2})');
```

---

## 🚀 Complete Setup Instructions (MacBook 14")

### **Step 1: Install Prerequisites**

```bash
# Install Node.js 18+ (using nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be 9.x.x or higher

# Install pnpm (faster than npm)
npm install -g pnpm

# Verify
pnpm --version
```

### **Step 2: Create Next.js Project**

```bash
# Create Next.js 14 app
npx create-next-app@latest credit-card-dashboard \
  --typescript \
  --tailwind \
  --app \
  --src-dir false \
  --import-alias "@/*"

cd credit-card-dashboard

# Install dependencies
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs
pnpm add @upstash/redis @upstash/qstash
pnpm add googleapis
pnpm add framer-motion lucide-react
pnpm add date-fns

# Install dev dependencies
pnpm add -D @types/node
```

### **Step 3: Setup Supabase**

```bash
# 1. Go to https://supabase.com
# 2. Create new project (choose region closest to you)
# 3. Wait for database to be ready (~2 minutes)
# 4. Go to Project Settings > API
# 5. Copy:
#    - Project URL
#    - anon/public key
#    - service_role key (keep secret!)

# Create .env.local file
cat > .env.local << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL
NEXT_PUBLIC_URL=http://localhost:3000

# Google OAuth (will add later)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Upstash Redis (will add later)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=

# Encryption key for Gmail tokens
ENCRYPTION_KEY=your-32-character-random-string-here
EOF

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output to ENCRYPTION_KEY in .env.local
```

### **Step 4: Run Database Migrations in Supabase**

```bash
# Go to Supabase Dashboard > SQL Editor
# Run each migration file in order:
# - 001_create_profiles.sql
# - 002_create_credit_cards.sql
# - 003_create_transactions.sql
# - 004_create_supporting_tables.sql
# - 005_seed_email_patterns.sql

# Verify tables created
# Go to Table Editor and check all tables exist
```

### **Step 5: Setup Google OAuth & Gmail API**

```bash
# 1. Go to https://console.cloud.google.com
# 2. Create new project or select existing
# 3. Enable APIs:
#    - Gmail API
#    - Google+ API (for OAuth)
# 4. Go to "Credentials"
# 5. Create OAuth 2.0 Client ID:
#    - Application type: Web application
#    - Authorized redirect URIs:
#      - http://localhost:3000/api/auth/callback (development)
#      - https://your-app.vercel.app/api/auth/callback (production)
# 6. Copy Client ID and Client Secret
# 7. Add to .env.local

# Also set up in Supabase:
# Go to Authentication > Providers > Google
# Enable and add Client ID & Secret
```

### **Step 6: Setup Upstash Redis**

```bash
# 1. Go to https://console.upstash.com
# 2. Create account (free tier)
# 3. Create Redis database
# 4. Create QStash endpoint
# 5. Copy credentials to .env.local:
#    - UPSTASH_REDIS_REST_URL
#    - UPSTASH_REDIS_REST_TOKEN
#    - QSTASH_TOKEN
```

### **Step 7: Setup Gmail Pub/Sub**

```bash
# 1. In Google Cloud Console, enable Pub/Sub API
# 2. Create topic:
gcloud pubsub topics create gmail-notifications

# 3. Create subscription:
gcloud pubsub subscriptions create gmail-push \
  --topic=gmail-notifications \
  --push-endpoint=http://localhost:3000/api/gmail/webhook \
  --ack-deadline=60

# 4. Grant Gmail publish permissions:
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher

# 5. For production, update endpoint to:
#    https://your-app.vercel.app/api/gmail/webhook
```

### **Step 8: Project Structure**

```bash
# Create project structure
mkdir -p lib/{supabase,services,queue,sse,hooks,utils}
mkdir -p components/{ui,dashboard,transactions,cards}
mkdir -p app/{api/{auth,cards,transactions,workers,gmail,notifications},\(dashboard\)/{dashboard,cards,loading,settings}}

# Your final structure should look like:
credit-card-dashboard/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── cards/
│   │   │   └── [cardId]/
│   │   │       └── page.tsx
│   │   ├── loading/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts
│   │   ├── cards/
│   │   │   ├── route.ts
│   │   │   └── [cardId]/
│   │   │       └── route.ts
│   │   ├── transactions/
│   │   │   ├── current/
│   │   │   │   └── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── spending-limits/
│   │   │   └── route.ts
│   │   ├── workers/
│   │   │   ├── initial-sync/
│   │   │   │   └── route.ts
│   │   │   ├── process-email/
│   │   │   │   └── route.ts
│   │   │   └── fetch-perks/
│   │   │       └── route.ts
│   │   ├── gmail/
│   │   │   └── webhook/
│   │   │       └── route.ts
│   │   └── notifications/
│   │       └── sse/
│   │           └── route.ts
│   ├── login/
│   │   └── page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/
│   │   ├── CreditCard.tsx
│   │   ├── Button.tsx
│   │   └── LoadingSkeleton.tsx
│   ├── dashboard/
│   │   ├── SpendingSummary.tsx
│   │   └── Header.tsx
│   ├── transactions/
│   │   └── TransactionTimeline.tsx
│   └── cards/
│       └── CardPerks.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── services/
│   │   ├── email-parser.ts
│   │   ├── gmail.ts
│   │   ├── spending-limit.ts
│   │   └── card-perks.ts
│   ├── queue/
│   │   └── worker.ts
│   ├── sse/
│   │   └── manager.ts
│   ├── hooks/
│   │   ├── useSSE.ts
│   │   └── useCards.ts
│   ├── utils/
│   │   ├── encryption.ts
│   │   └── date.ts
│   ├── email-patterns.ts
│   └── theme.ts
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### **Step 9: Core Library Files**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

```typescript
// lib/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

```typescript
// lib/hooks/useSSE.ts
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

interface SSEOptions {
  onTransaction?: (data: any) => void;
  onStatement?: (data: any) => void;
  onLimitExceeded?: (data: any) => void;
}

export function useSSE(options: SSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE endpoint
    const eventSource = new EventSource('/api/notifications/sse');
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event) => {
      console.log('SSE connected:', event.data);
    });

    eventSource.addEventListener('transaction:new', (event) => {
      const data = JSON.parse(event.data);
      
      // Show toast notification
      toast.custom((t) => (
        <div className="bg-gradient-to-r from-cred-purple to-cred-pink text-white px-6 py-4 rounded-lg shadow-xl">
          <div className="flex items-center gap-3">
            <div>
              <p className="font-semibold">New Transaction</p>
              <p className="text-sm opacity-90">
                ₹{data.transaction.amount} at {data.transaction.merchant}
              </p>
            </div>
          </div>
        </div>
      ));

      options.onTransaction?.(data);
    });

    eventSource.addEventListener('statement:generated', (event) => {
      const data = JSON.parse(event.data);
      
      toast.success('New statement generated!');
      options.onStatement?.(data);
    });

    eventSource.addEventListener('limit:exceeded', (event) => {
      const data = JSON.parse(event.data);
      
      toast.error('Spending limit exceeded!');
      options.onLimitExceeded?.(data);
    });

    eventSource.addEventListener('ping', () => {
      // Keep-alive ping
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [options]);

  return eventSourceRef.current;
}
```

### **Step 10: Gmail Webhook Handler**

```typescript
// app/api/gmail/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue/worker';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;

    if (!message?.data) {
      return NextResponse.json({ error: 'No data' }, { status: 400 });
    }

    // Decode base64 data
    const decodedData = Buffer.from(message.data, 'base64').toString();
    const notification = JSON.parse(decodedData);

    console.log('Gmail webhook notification:', notification);

    // Get user by email address
    const supabase = createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', notification.emailAddress)
      .single();

    if (!profile) {
      console.log('User not found for email:', notification.emailAddress);
      return NextResponse.json({ skipped: true });
    }

    // Enqueue email processing job
    await jobQueue.enqueue('process-email', profile.id, {
      messageId: notification.historyId, // Gmail's message ID
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Gmail webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Verify webhook (for Pub/Sub setup)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge');

  if (challenge) {
    return new Response(challenge, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('OK');
}
```

### **Step 11: Login Page**

```typescript
// app/login/page.tsx

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
      },
    });

    if (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cred-dark via-purple-900/20 to-cred-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-cred-purple to-cred-pink mb-6"
          >
            <CreditCard className="w-10 h-10 text-white" />
          </motion.div>
          
          <h1 className="text-4xl font-bold text-white mb-3">
            Credit Card Dashboard
          </h1>
          <p className="text-gray-400">
            Track all your credit cards in one place
          </p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10"
        >
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Sign in to continue
          </h2>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-gray-900 font-semibold py-4 px-6 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 shadow-lg"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
            Continue with Google
          </button>

          {/* Info */}
          <p className="text-xs text-gray-500 mt-6 text-center">
            By signing in, you agree to grant access to your Gmail for transaction tracking
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-3 gap-4 text-center"
        >
          {[
            { icon: '🔒', text: 'Secure' },
            { icon: '⚡', text: 'Real-time' },
            { icon: '🎯', text: 'Smart Limits' },
          ].map((feature, i) => (
            <div key={i} className="text-gray-400">
              <div className="text-2xl mb-1">{feature.icon}</div>
              <div className="text-xs">{feature.text}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
```

---

## 🧪 Testing & Verification

### **Test Checklist**

```bash
# 1. Test Authentication
# - Visit http://localhost:3000/login
# - Click "Continue with Google"
# - Verify redirect to Google OAuth
# - Verify redirect back to app
# - Check if new user → redirects to /loading
# - Check if existing user → redirects to /dashboard

# 2. Test Email Sync
# - As new user, check loading page shows progress
# - Verify processes update in real-time
# - Check Supabase tables for data:
#   - credit_cards should have entries
#   - current_transactions should have entries

# 3. Test Dashboard
# - Verify cards grouped by bank
# - Check card details on click
# - Verify spending summary shows correct totals

# 4. Test Real-time Notifications
# - Send test email to Gmail
# - Verify webhook receives notification
# - Check SSE shows toast notification
# - Verify transaction appears in dashboard

# 5. Test Spending Limits
# - Create spending limit via API/UI
# - Make transactions that exceed limit
# - Verify email alert sent
# - Verify limit progress bar updates
```

### **Debug Mode**

```typescript
// Add to .env.local for debugging
DEBUG=true
LOG_LEVEL=debug

// Use in code
if (process.env.DEBUG === 'true') {
  console.log('Debug info:', data);
}
```

---

## 🚀 Deployment to Vercel

### **Step 1: Prepare for Production**

```bash
# Update environment variables for production
# In Vercel dashboard, add:
# - All .env.local variables
# - Update URLs to production values
# - NEXT_PUBLIC_URL=https://your-app.vercel.app

# Update Gmail Pub/Sub subscription
gcloud pubsub subscriptions update gmail-push \
  --push-endpoint=https://your-app.vercel.app/api/gmail/webhook

# Update Google OAuth redirect URIs
# Add: https://your-app.vercel.app/api/auth/callback
```

### **Step 2: Deploy**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set build command: next build
# - Set output directory: .next
# - Install command: pnpm install

# Deploy to production
vercel --prod
```

### **Step 3: Post-Deployment**

```bash
# 1. Test production deployment
#    - Visit your Vercel URL
#    - Test login flow
#    - Test email sync

# 2. Monitor logs
#    - Vercel Dashboard > Logs
#    - Check for errors

# 3. Set up monitoring
#    - Vercel Analytics (free)
#    - Supabase Dashboard for DB stats
#    - Upstash Console for Redis stats
```

---

## 📊 Monitoring & Maintenance

### **Monitoring Setup**

```typescript
// lib/monitoring/logger.ts

export class Logger {
  static info(message: string, data?: any) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
  }

  static error(message: string, error?: any) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to Sentry, LogRocket, etc.
    }
  }

  static warn(message: string, data?: any) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
  }
}
```

### **Health Check Endpoint**

```typescript
// app/api/health/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString(),
  };

  try {
    // Check Supabase
    const supabase = createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    checks.database = !error;

    // Check Redis
    const redis = Redis.fromEnv();
    await redis.ping();
    checks.redis = true;

  } catch (error) {
    console.error('Health check failed:', error);
  }

  const isHealthy = checks.database && checks.redis;

  return NextResponse.json(
    { 
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks 
    },
    { status: isHealthy ? 200 : 503 }
  );
}
```

### **Performance Optimization**

```typescript
// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Optimize images
  images: {
    domains: ['lh3.googleusercontent.com'], // Google profile images
    formats: ['image/avif', 'image/webp'],
  },

  // Compression
  compress: true,

  // Reduce bundle size
  swcMinify: true,

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: 'Credit Card Dashboard',
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## 🐛 Troubleshooting Guide

### **Common Issues**

#### **Issue 1: "Supabase session not found"**

```typescript
// Solution: Ensure middleware is set up correctly

// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

#### **Issue 2: "Gmail API quota exceeded"**

```typescript
// Solution: Implement rate limiting

// lib/services/gmail.ts
class GmailRateLimiter {
  private requestCount = 0;
  private resetTime = Date.now() + 60000;

  async checkLimit(): Promise<void> {
    if (Date.now() > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = Date.now() + 60000;
    }

    if (this.requestCount >= 250) {
      const waitTime = this.resetTime - Date.now();
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.resetTime = Date.now() + 60000;
    }

    this.requestCount++;
  }
}

const rateLimiter = new GmailRateLimiter();

// Use before each Gmail API call
await rateLimiter.checkLimit();
```

#### **Issue 3: "SSE connection drops"**

```typescript
// Solution: Implement reconnection logic

// lib/hooks/useSSE.ts
useEffect(() => {
  let reconnectTimeout: NodeJS.Timeout;
  
  const connect = () => {
    const eventSource = new EventSource('/api/notifications/sse');
    
    eventSource.onerror = () => {
      eventSource.close();
      
      // Reconnect after 5 seconds
      reconnectTimeout = setTimeout(() => {
        console.log('Reconnecting SSE...');
        connect();
      }, 5000);
    };
    
    return eventSource;
  };
  
  const eventSource = connect();
  
  return () => {
    eventSource.close();
    clearTimeout(reconnectTimeout);
  };
}, []);
```

---

## 📈 Scaling Considerations

### **When You Outgrow Free Tier**

```typescript
// Cost optimization strategies:

// 1. Database Optimization
// - Add indexes to frequently queried columns
// - Use materialized views for complex queries
// - Archive old transactions (>2 years)

// 2. Redis Optimization
// - Use shorter TTL for cache entries
// - Implement LRU eviction
// - Consider Redis Enterprise for more commands

// 3. Alternative Architectures
// - Move to Railway ($5/month for all services)
// - Use Cloudflare Workers for edge computing
// - Implement caching layer with Cloudflare KV

// 4. Cost Monitoring
interface CostMetrics {
  supabaseRequests: number;
  supabaseBandwidth: number; // MB
  redisCommands: number;
  vercelBandwidth: number; // GB
  estimatedCost: number; // USD
}

async function checkCosts(): Promise<CostMetrics> {
  // Query Supabase stats
  // Query Upstash stats
  // Calculate estimated costs
  // Alert if approaching limits
}
```

---

## ✅ Production Checklist

### **Before Launch**

- [ ] All environment variables set in Vercel
- [ ] Database migrations run in Supabase
- [ ] Gmail OAuth credentials configured
- [ ] Pub/Sub webhook endpoint updated
- [ ] SSL/HTTPS enabled
- [ ] Error tracking configured
- [ ] Health check endpoint working
- [ ] Test all user flows end-to-end
- [ ] Review RLS policies in Supabase
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Test email parsing with real emails
- [ ] Verify spending limit alerts work
- [ ] Test SSE reconnection
- [ ] Mobile responsive design verified
- [ ] Performance audit passed (Lighthouse)

### **Post-Launch**

- [ ] Monitor error rates daily
- [ ] Check database growth weekly
- [ ] Review API usage monthly
- [ ] Update email patterns as needed
- [ ] Gather user feedback
- [ ] Plan feature roadmap
- [ ] Document known issues
- [ ] Set up automated backups
- [ ] Create runbook for common issues
- [ ] Schedule security audits

---

## 🎓 Additional Resources

### **Documentation Links**

- **Next.js 14**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **Upstash Redis**: https://upstash.com/docs/redis
- **Gmail API**: https://developers.google.com/gmail/api
- **Framer Motion**: https://www.framer.com/motion
- **Tailwind CSS**: https://tailwindcss.com/docs

### **Community Support**

- **Next.js Discord**: https://nextjs.org/discord
- **Supabase Discord**: https://discord.supabase.com
- **GitHub Discussions**: Create in your repo

---

## 🎉 Conclusion

You now have a **complete, production-ready credit card dashboard** that costs $0-1/month! 

### **What You've Built**

✅ **Full-stack application** with Next.js 14
✅ **Real-time email parsing** via Gmail API
✅ **Automatic transaction tracking**
✅ **Spending limits** with alerts
✅ **CRED-inspired UI** with animations
✅ **Server-Sent Events** for notifications
✅ **Secure authentication** with Supabase
✅ **Background job processing** with Upstash
✅ **Responsive design** for all devices
✅ **Production deployment** on Vercel

### **Key Differentiators**

1. **$0 monthly cost** (vs $50-100 for original architecture)
2. **Same functionality** as enterprise solution
3. **Modern tech stack** (Next.js 14 App Router)
4. **Beautiful UI** inspired by CRED
5. **Real-time updates** via SSE
6. **Scalable architecture** (can upgrade as needed)

### **Next Steps**

1. **Customize** email patterns for your banks
2. **Add features** like:
   - Budget forecasting
   - Reward points tracking
   - Bill payment reminders
   - Family card sharing
3. **Improve** email parsing accuracy
4. **Expand** card perks database
5. **Optimize** performance further

### **Support**

If you encounter issues:
1. Check the troubleshooting guide above
2. Review Vercel logs
3. Check Supabase logs
4. Test locally first
5. Review this documentation

---

## 📝 Final Notes

**Remember:**
- Keep your `.env.local` file secure
- Never commit secrets to Git
- Monitor your usage to stay in free tier
- Test thoroughly before deploying
- Back up your database regularly
- Update dependencies monthly
- Review security best practices

**You're ready to launch! 🚀**

Good luck building your credit card dashboard!