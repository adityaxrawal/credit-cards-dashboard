Credit Card Dashboard - Copilot Implementation Guide
🎯 Overview
This document provides a phased implementation plan for building a Credit Card Management Dashboard using GitHub Copilot. Each phase includes specific prompts, file structures, and validation steps to ensure successful completion.

📋 Prerequisites Setup
Phase 0: Environment Preparation
Prompt for Copilot:
Create a Next.js 14 project with TypeScript, Tailwind CSS, and App Router. 
Include the following dependencies:
- @supabase/supabase-js and @supabase/auth-helpers-nextjs for database and auth
- @upstash/redis and @upstash/qstash for background jobs
- googleapis for Gmail integration
- framer-motion for animations
- lucide-react for icons
- date-fns for date utilities

Set up the following folder structure:
- app/ (with api/, (dashboard)/ subdirectories)
- components/ (with ui/, dashboard/, transactions/, cards/ subdirectories)
- lib/ (with supabase/, services/, queue/, sse/, hooks/, utils/ subdirectories)

Create a .env.local template file with placeholders for:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_URL
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- QSTASH_TOKEN
- ENCRYPTION_KEY (32-character hex string)

Also create a comprehensive .gitignore file.
```

**Validation:**
- [ ] Project initializes without errors
- [ ] All dependencies installed
- [ ] Folder structure matches requirements
- [ ] .env.local template exists
- [ ] npm run dev starts successfully

---

## 🗄️ Phase 1: Database Schema & Supabase Setup

### Step 1.1: Supabase Client Configuration

**Prompt for Copilot:**
```
Create two Supabase client files:

1. lib/supabase/client.ts - Browser client using createBrowserClient from @supabase/ssr
   - Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env

2. lib/supabase/server.ts - Server client using createServerClient from @supabase/ssr
   - Implement cookie handling with get, set, and remove methods
   - Use next/headers cookies() function
   - Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env

Both should export a createClient() function.
```

**Validation:**
- [ ] Files created in correct locations
- [ ] TypeScript types are correct
- [ ] Environment variables properly referenced

### Step 1.2: Database Migrations

**Prompt for Copilot:**
```
Create SQL migration files in a new /supabase/migrations/ directory:

1. 001_create_profiles.sql:
   - Enable uuid-ossp extension
   - Create profiles table extending auth.users with: id (UUID PK, FK to auth.users), email (TEXT UNIQUE), full_name (TEXT), avatar_url (TEXT), global_spending_limit (DECIMAL default 50000.00), created_at, updated_at
   - Enable RLS with policies for users to view/update own profile
   - Create trigger function handle_new_user() that auto-creates profile on auth.users insert
   - Create trigger on_auth_user_created on auth.users table
   - Create trigger function handle_updated_at() for auto-updating updated_at
   - Apply updated_at trigger to profiles table

2. 002_create_credit_cards.sql:
   - Create credit_cards table with: id (UUID PK), user_id (FK to profiles), bank_name (TEXT), card_last_4 (TEXT), card_holder_name (TEXT), card_type (TEXT), statement_day (INTEGER 1-31), sender_pattern (TEXT), created_at, updated_at
   - Add unique constraint on (user_id, card_last_4)
   - Create indexes on user_id and card_last_4
   - Enable RLS with policies for SELECT, INSERT, UPDATE, DELETE (auth.uid() = user_id)
   - Apply updated_at trigger

3. 003_create_transactions.sql:
   - Create current_transactions table with: id (UUID PK), card_id (FK to credit_cards), date (TIMESTAMP), merchant (TEXT), amount (DECIMAL), category (TEXT), category_manual (TEXT), type (TEXT CHECK 'DEBIT'/'CREDIT'/'REVERSAL'), email_data (JSONB), created_at, updated_at
   - Create statements table with: id (UUID PK), card_id (FK), month (INTEGER 1-12), year (INTEGER), cycle_start (DATE), cycle_end (DATE), due_date (DATE), total_due (DECIMAL), min_due (DECIMAL), is_paid (BOOLEAN), paid_date (TIMESTAMP), created_at
   - Add unique constraint on statements (card_id, month, year)
   - Create statement_transactions table similar to current_transactions but with statement_id (FK to statements)
   - Create indexes on card_id, date, category, statement_id
   - Enable RLS for all tables with appropriate policies
   - Apply updated_at trigger to current_transactions

4. 004_create_supporting_tables.sql:
   - Create card_perks table: id, card_id (FK), type, description, value, category, valid_from, valid_to, created_at, updated_at
   - Create spending_limits table: id, user_id (FK), type (CHECK 'GLOBAL'/'CATEGORY'), category_name, limit_amount, current_spending, alert_threshold (INTEGER 0-100, default 90), is_active (BOOLEAN), created_at, updated_at
   - Create gmail_tokens table: id, user_id (FK, UNIQUE), access_token_enc, refresh_token_enc, expires_at, created_at, updated_at
   - Create email_patterns table: id, bank_name, sender_email, subject_keywords (TEXT[]), transaction_regex, statement_regex, card_regex, amount_regex, created_at, updated_at
   - Create processing_queue table: id, user_id (FK), job_type, status (CHECK 'pending'/'processing'/'completed'/'failed'), progress (INTEGER -1 to 100), message, started_at, completed_at, error, created_at
   - Create appropriate indexes
   - Enable RLS for all tables

5. 005_seed_email_patterns.sql:
   - Insert email patterns for major banks: SBI, HDFC, Axis, ICICI
   - Include sender_email, subject_keywords array, and regex patterns for transaction, card, and amount extraction
```

**Validation:**
- [ ] All 5 migration files created
- [ ] SQL syntax is valid
- [ ] RLS policies defined correctly
- [ ] Indexes created appropriately
- [ ] Foreign keys properly referenced

**Manual Steps Required:**
1. Create Supabase project at https://supabase.com
2. Navigate to SQL Editor in Supabase dashboard
3. Run each migration file in order (001 → 005)
4. Verify tables created in Table Editor
5. Copy Project URL and API keys to .env.local

---

## 🔐 Phase 2: Authentication & Core Utilities

### Step 2.1: Encryption Utilities

**Prompt for Copilot:**
```
Create lib/utils/encryption.ts with functions to encrypt and decrypt Gmail tokens:
- Use Node.js crypto module with aes-256-gcm algorithm
- encrypt(text: string): string - Takes plaintext, returns 'iv:authTag:encrypted' format
- decrypt(encrypted: string): string - Takes encrypted string, returns plaintext
- Use process.env.ENCRYPTION_KEY as the key (Buffer from hex)
- Generate random 16-byte IV for each encryption
- Include proper TypeScript types
```

**Validation:**
- [ ] File created with correct functions
- [ ] Encryption produces different output each time (due to random IV)
- [ ] Decryption successfully reverses encryption
- [ ] TypeScript types are correct

### Step 2.2: Authentication Callback Handler

**Prompt for Copilot:**
```
Create app/api/auth/callback/route.ts:
- Import createClient from lib/supabase/server
- Handle GET request with code parameter from searchParams
- Exchange code for session using supabase.auth.exchangeCodeForSession()
- If successful and user exists:
  - Query profiles table for user's created_at timestamp
  - Determine if new user (created within last 60 seconds)
  - If new user: enqueue 'initial-sync' job and redirect to '/loading'
  - If existing user: redirect to '/dashboard'
- If error: redirect to '/login?error=auth'
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] File created in correct location
- [ ] Handles OAuth callback correctly
- [ ] Differentiates new vs existing users
- [ ] Proper redirects implemented

### Step 2.3: Middleware for Session Management

**Prompt for Copilot:**
```
Create middleware.ts at project root:
- Use createServerClient from @supabase/ssr
- Implement cookie handling in middleware (get, set, remove)
- Call supabase.auth.getUser() to refresh session
- Configure matcher to run on all routes except: _next/static, _next/image, favicon.ico, and static assets (svg, png, jpg, etc.)
- Return NextResponse with updated cookies
- Include proper TypeScript types
```

**Validation:**
- [ ] File created at root level
- [ ] Cookie handling implemented correctly
- [ ] Matcher excludes static assets
- [ ] Session refresh works

---

## 🎨 Phase 3: UI Foundation & Theme

### Step 3.1: Tailwind Configuration

**Prompt for Copilot:**
```
Update tailwind.config.ts to include:
- Custom colors: cred-dark (#0F0F0F), cred-secondary (#1A1A1A), cred-tertiary (#2A2A2A), cred-purple (#9B6BFF), cred-pink (#FF6B9D), cred-blue (#4D9BFF), cred-green (#00D9A3)
- Custom screens: mobile (320px), tablet (768px), laptop (1024px), macbook-14 (1512px), desktop (1920px)
- Extend backgroundImage with gradient-radial and gradient-conic utilities
- Keep all existing Tailwind defaults
```

**Validation:**
- [ ] Config file updated
- [ ] Custom colors accessible in CSS
- [ ] Custom breakpoints work
- [ ] No TypeScript errors

### Step 3.2: Global Styles & Theme

**Prompt for Copilot:**
```
Create lib/theme.ts with:
- Export theme object containing:
  - colors: { background: { primary, secondary, tertiary }, accent: { purple, pink, blue, green }, text: { primary, secondary, tertiary }, status: { success, error, warning, info } }
  - glassmorphism: { background, backdrop, border }
- Use hex values from Tailwind config
- Include TypeScript interface for theme object

Update app/globals.css:
- Apply dark mode by default to html/body
- Set background to gradient-to-br from-cred-dark via-cred-secondary to-cred-dark
- Set default text color to white
- Include smooth scrolling behavior
- Add utility classes for glassmorphism effects
```

**Validation:**
- [ ] Theme file exports properly
- [ ] Global styles applied
- [ ] Dark theme is default
- [ ] Glassmorphism classes work

### Step 3.3: Base UI Components

**Prompt for Copilot:**
```
Create the following base UI components:

1. components/ui/Button.tsx:
   - Accept props: variant ('primary' | 'secondary' | 'outline'), size ('sm' | 'md' | 'lg'), loading (boolean), disabled, onClick, children
   - Use Tailwind for styling with gradient backgrounds for primary variant
   - Include Framer Motion for hover/tap animations
   - Show loading spinner when loading=true
   - Include proper TypeScript types

2. components/ui/LoadingSkeleton.tsx:
   - Accept props: type ('card' | 'list' | 'text'), count (number)
   - Create animated skeleton loaders with pulse animation
   - Use glassmorphism styling
   - Include proper TypeScript types

3. components/ui/CreditCard.tsx:
   - Accept props: card (object with id, bank_name, card_last_4, card_holder_name, card_type), currentDue (optional number), dueDate (optional Date), onClick (optional function)
   - Create card component with:
     - Gradient background based on bank (getBankColor helper)
     - Glassmorphism overlay
     - Animated gradient shimmer effect
     - Card number display with bullets (•) and last 4 digits
     - Cardholder name
     - Current due amount and due date (if provided)
     - Hover scale and lift animation using Framer Motion
   - Include proper TypeScript types and interfaces
```

**Validation:**
- [ ] All 3 components created
- [ ] Components render without errors
- [ ] Animations work smoothly
- [ ] TypeScript types correct
- [ ] Responsive on all screen sizes

---

## 📧 Phase 4: Email Parsing System

### Step 4.1: Email Pattern Definitions

**Prompt for Copilot:**
```
Create lib/email-patterns.ts with:
- Export EmailPattern interface with: bank, senderRegex (RegExp[]), subjectKeywords (string[]), cardRegex, amountRegex, merchantRegex, dateRegex, typeKeywords (object with debit/credit/reversal string arrays)
- Export EMAIL_PATTERNS array with patterns for SBI, HDFC, Axis, ICICI banks:
  - SBI: sender @sbicard.com, keywords ['transaction', 'alert', 'spent'], card regex /X{4,}(\d{4})/, amount /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/, etc.
  - HDFC: sender @hdfcbank.com, card regex /xx(\d{4})/i, amount /INR\s?([0-9,]+\.?\d{0,2})/, etc.
  - Axis: sender @axisbank.com, card regex /\*\*(\d{4})/, amount /Rs\.?\s?([0-9,]+\.?\d{0,2})/, etc.
  - ICICI: similar patterns
- Export STATEMENT_PATTERNS array with similar structure for statement emails
- Include comprehensive type keywords for transaction classification
```

**Validation:**
- [ ] File created with proper interfaces
- [ ] All 4 bank patterns included
- [ ] Regex patterns are valid
- [ ] TypeScript types correct

### Step 4.2: Email Parser Service

**Prompt for Copilot:**
```
Create lib/services/email-parser.ts:
- Import EMAIL_PATTERNS and STATEMENT_PATTERNS
- Export ParsedTransaction and ParsedStatement interfaces
- Export EmailParserService class with:
  - parseEmail(email: gmail_v1.Schema$Message): Promise<ParsedTransaction | ParsedStatement | null>
    - Extract from, subject, body from email
    - Find matching pattern from EMAIL_PATTERNS
    - Determine if transaction or statement email
    - Call parseTransaction() or parseStatement() accordingly
  - parseTransaction(email, pattern, body): ParsedTransaction | null
    - Extract: cardLast4, amount, merchant, date using regex
    - Determine transaction type (DEBIT/CREDIT/REVERSAL) from keywords
    - Auto-categorize using categorizeTransaction()
    - Return ParsedTransaction object with all fields
  - parseStatement(email, pattern, body): ParsedStatement | null
    - Extract: cardLast4, month, year, dates, amounts
    - Return ParsedStatement object
  - categorizeTransaction(merchant: string): string
    - Define categories object with keywords for: Food & Dining, Travel, Shopping, Bills, Entertainment, Fuel, Healthcare, etc.
    - Match merchant against keywords
    - Return category or 'Miscellaneous'
  - getHeader(email, name): string - Extract header value
  - getEmailBody(email): string - Extract email body handling multipart/base64
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Service class created
- [ ] All methods implemented
- [ ] Category matching works
- [ ] Handles edge cases (missing data, malformed emails)
- [ ] TypeScript types correct

---

## ⚙️ Phase 5: Background Job Queue

### Step 5.1: Queue Infrastructure

**Prompt for Copilot:**
```
Create lib/queue/worker.ts:
- Import Redis from @upstash/redis and Queue from @upstash/qstash
- Initialize redis and qstash clients using environment variables
- Export JobType type: 'initial-sync' | 'process-email' | 'fetch-perks' | 'check-spending-limits'
- Export Job interface with: id, type, userId, data (any), status, progress, message, createdAt, startedAt, completedAt, error
- Export JobQueue class with methods:
  - async enqueue(type, userId, data): Promise<string>
    - Generate UUID for job
    - Create Job object with pending status
    - Store in Redis with key 'job:{jobId}'
    - Add to queue with key 'queue:{type}'
    - Trigger worker via QStash publish to endpoint /api/workers/{type}
    - Return jobId
  - async getJob(jobId): Promise<Job | null>
    - Fetch from Redis and parse JSON
  - async updateJob(jobId, updates): Promise<void>
    - Get current job, merge updates, save back to Redis
- Export singleton instance: export const jobQueue = new JobQueue()
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] File created with JobQueue class
- [ ] Redis and QStash initialized
- [ ] Methods work correctly
- [ ] TypeScript types correct

### Step 5.2: Initial Sync Worker

**Prompt for Copilot:**
```
Create app/api/workers/initial-sync/route.ts:
- Handle POST request with { jobId, userId, data }
- Update job status to 'processing'
- Get Gmail client for user (create helper getGmailClient())
- Fetch emails from last 2 years using Gmail API:
  - Use query: after:{timestamp}
  - Fetch message IDs, then full messages
- Parse each email using EmailParserService
- For each parsed transaction:
  - Find or create credit card in database
  - Store transaction in current_transactions table
  - If new card, enqueue 'fetch-perks' job
- Update job progress throughout (0-100%)
- On completion: set status to 'completed', progress to 100
- On error: set status to 'failed', store error message
- Return success/error response
- Include helper functions: fetchHistoricalEmails(), getGmailClient()
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Worker endpoint created
- [ ] Handles job lifecycle correctly
- [ ] Progress updates work
- [ ] Error handling implemented
- [ ] TypeScript types correct

### Step 5.3: Real-time Email Processor

**Prompt for Copilot:**
```
Create app/api/workers/process-email/route.ts:
- Handle POST request with { messageId, userId }
- Get Gmail client and fetch specific email by messageId
- Parse email using EmailParserService
- If parsed as TRANSACTION:
  - Check for duplicate using checkDuplicateTransaction() helper
  - Find or create card
  - Store transaction in current_transactions
  - Check spending limits using SpendingLimitService
  - If limit exceeded, send email alert
  - Send SSE notification if user online
- If parsed as STATEMENT:
  - Find card
  - Create statement record
  - Move transactions from current to statement_transactions
  - Send SSE notification
- Include helper functions:
  - checkDuplicateTransaction(cardLast4, amount, merchant, date): Promise<boolean>
  - moveTransactionsToStatement(cardId, statementId, parsed)
  - sendLimitAlert(userId, limitData)
- Return success/error response
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Worker endpoint created
- [ ] Handles both transaction and statement emails
- [ ] Duplicate detection works
- [ ] Database operations correct
- [ ] TypeScript types correct

---

## 📡 Phase 6: Real-time Notifications (SSE)

### Step 6.1: SSE Manager

**Prompt for Copilot:**
```
Create lib/sse/manager.ts:
- Export SSEConnection interface with: userId, controller (ReadableStreamDefaultController), lastPing (number)
- Create SSEManager class with:
  - Private connections Map<string, SSEConnection>
  - addConnection(userId, controller): void
    - Store connection
    - Send initial 'connected' event
    - Start keep-alive interval
  - removeConnection(userId): void
  - isUserOnline(userId): boolean
  - async sendToUser(userId, event, data): Promise<void>
    - Format as SSE: "event: {event}\ndata: {JSON.stringify(data)}\n\n"
    - Encode and enqueue to controller
    - Update lastPing
    - Handle errors and remove stale connections
  - private startKeepAlive(userId): void
    - Set interval (30 seconds)
    - Check if connection stale (>60s inactive)
    - Send 'ping' event
- Export singleton: export const sseManager = new SSEManager()
- Include proper TypeScript types
```

**Validation:**
- [ ] Manager class created
- [ ] Connection management works
- [ ] Keep-alive implemented
- [ ] TypeScript types correct

### Step 6.2: SSE Endpoint

**Prompt for Copilot:**
```
Create app/api/notifications/sse/route.ts:
- Handle GET request
- Verify authentication using Supabase
- If not authenticated, return 401
- Create ReadableStream with:
  - start(controller): register with sseManager.addConnection()
  - cancel(): remove from sseManager
- Return Response with stream
- Headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Endpoint created
- [ ] Authentication check works
- [ ] Stream establishes correctly
- [ ] Headers set properly
- [ ] TypeScript types correct

### Step 6.3: Client-side SSE Hook

**Prompt for Copilot:**
```
Create lib/hooks/useSSE.ts:
- Mark as 'use client'
- Export SSEOptions interface with optional callbacks: onTransaction, onStatement, onLimitExceeded
- Export useSSE hook that accepts SSEOptions:
  - Create EventSource ref
  - In useEffect:
    - Create EventSource connection to '/api/notifications/sse'
    - Add event listeners for: 'connected', 'transaction:new', 'statement:generated', 'limit:exceeded', 'ping'
    - For transaction:new - show toast notification and call onTransaction callback
    - For statement:generated - show toast and call onStatement callback
    - For limit:exceeded - show error toast and call onLimitExceeded callback
    - Handle errors and reconnection logic
    - Cleanup on unmount
  - Return eventSource ref
- Include proper TypeScript types
- Import toast from react-hot-toast for notifications
```

**Validation:**
- [ ] Hook created
- [ ] SSE connection establishes
- [ ] Events handled correctly
- [ ] Reconnection works
- [ ] TypeScript types correct

---

## 🖥️ Phase 7: Dashboard UI

### Step 7.1: Dashboard Layout & Header

**Prompt for Copilot:**
```
Create app/(dashboard)/layout.tsx:
- Mark as 'use client'
- Create dashboard layout with:
  - Sticky header with logo, navigation, user menu
  - Main content area with gradient background
  - Responsive sidebar for mobile (hamburger menu)
  - User profile dropdown with logout option
- Use Framer Motion for animations
- Include proper TypeScript types
- Style with Tailwind and glassmorphism effects

Create components/dashboard/Header.tsx:
- Display app logo and name
- Navigation links: Dashboard, Cards, Settings
- User profile avatar with dropdown menu
- Logout functionality using Supabase auth
- Mobile responsive with hamburger menu
- Include Framer Motion animations
- Include proper TypeScript types
```

**Validation:**
- [ ] Layout created with proper structure
- [ ] Header component functional
- [ ] Navigation works
- [ ] Logout works
- [ ] Responsive design works

### Step 7.2: Spending Summary Component

**Prompt for Copilot:**
```
Create components/dashboard/SpendingSummary.tsx:
- Mark as 'use client'
- Fetch user's spending limits from Supabase
- Fetch current transactions and calculate total spending
- Calculate category breakdown
- Display:
  - Global spending limit progress bar with percentage
  - Animated progress bar using Framer Motion
  - Alert if approaching/exceeding limit (with AlertCircle icon)
  - Top 4 category spending cards in grid
  - Shimmer effect on progress bar
- Use glassmorphism styling
- Include proper loading state
- Include proper TypeScript types
- Use TrendingUp, AlertCircle from lucide-react
```

**Validation:**
- [ ] Component renders correctly
- [ ] Data fetches from Supabase
- [ ] Progress bar animates
- [ ] Alerts show appropriately
- [ ] Responsive design works

### Step 7.3: Main Dashboard Page

**Prompt for Copilot:**
```
Create app/(dashboard)/dashboard/page.tsx:
- Mark as 'use client'
- Connect to SSE using useSSE hook
- Fetch user's credit cards grouped by bank
- Display:
  - Page header with title and description
  - SpendingSummary component
  - Cards grouped by bank name in sections
  - Grid of CreditCard components (3 columns on desktop, 2 on tablet, 1 on mobile)
  - Click card to navigate to /cards/{cardId}
- Show loading skeleton while fetching
- Use Framer Motion for staggered animations
- Include proper TypeScript types
- Handle empty state (no cards)
```

**Validation:**
- [ ] Dashboard page renders
- [ ] Cards display correctly
- [ ] SSE connection works
- [ ] Navigation to card details works
- [ ] Loading state shows
- [ ] Animations work smoothly

---

## 💳 Phase 8: Card Details & Transactions

### Step 8.1: Transaction Timeline Component

**Prompt for Copilot:**
```
Create components/transactions/TransactionTimeline.tsx:
- Mark as 'use client'
- Accept props: transactions (array of Transaction objects)
- Define Transaction interface with: id, date, merchant, amount, category, type
- Display timeline with:
  - Vertical line connecting transactions
  - Category emoji icon for each transaction
  - Merchant name, category, date
  - Amount (green for CREDIT, white for DEBIT)
  - Glassmorphism card for each transaction
  - Hover effect to scale and change background
- Use Framer Motion for staggered entry animations
- Create helper functions:
  - getCategoryIcon(category): returns emoji
  - getAmountColor(type): returns Tailwind color class
- Include proper TypeScript types
- Use Calendar icon from lucide-react
```

**Validation:**
- [ ] Component renders timeline correctly
- [ ] Icons display for categories
- [ ] Colors correct for transaction types
- [ ] Animations work
- [ ] Responsive design

### Step 8.2: Card Perks Component

**Prompt for Copilot:**
```
Create components/cards/CardPerks.tsx:
- Mark as 'use client'
- Accept props: cardId (string)
- Fetch card perks from Supabase for given cardId
- Display perks in grid:
  - Perk type with icon
  - Description
  - Value (if applicable)
  - Valid from/to dates
  - Category badge
- Use glassmorphism cards
- Show loading skeleton while fetching
- Handle empty state (no perks)
- Include Framer Motion animations
- Include proper TypeScript types
- Use icons from lucide-react (Gift, Star, CreditCard, etc.)
```

**Validation:**
- [ ] Component fetches perks
- [ ] Perks display in grid
- [ ] Loading state works
- [ ] Empty state shows
- [ ] Responsive design

### Step 8.3: Card Detail Page

**Prompt for Copilot:**
```
Create app/(dashboard)/cards/[cardId]/page.tsx:
- Mark as 'use client'
- Extract cardId from params
- Fetch card details, perks, statements, and current transactions from Supabase
- Display:
  - Large CreditCard component at top
  - Tabs: Overview, Transactions, Statements, Perks
  - Overview tab: Current due, due date, spending by category chart
  - Transactions tab: TransactionTimeline component with current transactions
  - Statements tab: List of statements with download option
  - Perks tab: CardPerks component
- Include back button to dashboard
- Use Framer Motion for page transitions
- Include proper loading state
- Include proper TypeScript types
- Use recharts for spending chart
```

**Validation:**
- [ ] Page renders with card details
- [ ] Tabs work correctly
- [ ] All data displays correctly
- [ ] Back navigation works
- [ ] Charts render (if data available)

---

## ⚙️ Phase 9: Settings & Spending Limits

### Step 9.1: Spending Limits Page

**Prompt for Copilot:**
```
Create app/(dashboard)/settings/page.tsx:
- Mark as 'use client'
- Create tabs: Profile, Spending Limits, Email Patterns, Danger Zone
- Spending Limits tab:
  - Display current limits with progress bars
  - Form to add new limit: type (GLOBAL/CATEGORY), category (if CATEGORY), amount, alert threshold
  - Toggle to enable/disable limits
  - Delete limit button
  - Validation: amount > 0, threshold 0-100
- Profile tab:
  - Display user email, name, avatar
  - Form to update profile
- Email Patterns tab:
  - Display current email patterns from database
  - Form to add custom pattern for unlisted bank
- Danger Zone tab:
  - Delete all data button with confirmation
  - Export data button (download JSON)
- Use glassmorphism styling
- Include Framer Motion animations
- Include proper TypeScript types
- Create API routes for CRUD operations
```

**Validation:**
- [ ] Settings page renders
- [ ] All tabs functional
- [ ] Forms validate correctly
- [ ] CRUD operations work
- [ ] Confirmations show for destructive actions

### Step 9.2: Spending Limit Service

**Prompt for Copilot:**
```
Create lib/services/spending-limit.ts:
- Export SpendingLimitService class with:
  - async checkLimits(userId, transaction): Promise<LimitExceeded | null>
    - Fetch active spending limits for user
    - Calculate current spending (from current_transactions)
    - Check global limit
    - Check category-specific limits
    - If any limit exceeded or approaching threshold:
      - Return LimitExceeded object with details
    - Return null if within limits
  - async updateSpending(userId): Promise<void>
    - Recalculate current_spending for all active limits
    - Update spending_limits table
- Export LimitExceeded interface with: type, limitAmount, currentSpending, category
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Service class created
- [ ] Limit checking works
- [ ] Database updates correctly
- [ ] TypeScript types correct

---

## 🔌 Phase 10: API Routes

### Step 10.1: Cards API

**Prompt for Copilot:**
```
Create the following API routes:

1. app/api/cards/route.ts:
   - GET: Fetch all cards for authenticated user with latest statement
   - Group by bank_name
   - Return { cards: [], grouped_by_bank: {} }
   - Include auth check

2. app/api/cards/[cardId]/route.ts:
   - GET: Fetch single card with perks, statements, and current transactions
   - Include auth check and ownership verification
   - Return full card object

Both should:
- Use createClient from lib/supabase/server
- Return 401 if not authenticated
- Return 404 if card not found
- Include proper error handling and TypeScript types
Validation:

 Both endpoints created
 Authentication works
 Data returns correctly
 Error cases handled

Step 10.2: Transactions API
Prompt for Copilot:
Create app/api/transactions/current/RetryClaude does not have the ability to run the code it generates yet.AContinueCreate app/api/transactions/current/route.ts:
- GET: Fetch current transactions for authenticated user
- Accept query params: cardId (optional), category (optional), page (default 1), limit (default 50)
- Join with credit_cards to verify ownership
- Filter by cardId and/or category if provided
- Order by date descending
- Implement pagination using range()
- Return { transactions: [], total: count, page, limit }
- Include auth check
- Include proper error handling and TypeScript types

Create app/api/transactions/[id]/route.ts:
- GET: Fetch single transaction by id
- PATCH: Update transaction (category_manual field only)
- DELETE: Delete transaction (soft delete or hard delete)
- Include auth check and ownership verification
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Endpoints created
- [ ] Pagination works correctly
- [ ] Filtering works
- [ ] Update/delete operations work
- [ ] Auth and ownership checks pass

### Step 10.3: Spending Limits API

**Prompt for Copilot:**
```
Create app/api/spending-limits/route.ts:
- GET: Fetch all active spending limits for authenticated user
- POST: Create new spending limit
  - Validate: type, limit_amount required
  - If type='CATEGORY', category_name required
  - Alert threshold defaults to 90
  - Initialize current_spending to 0
  - Return created limit
- Include auth check
- Include validation and error handling
- Include proper TypeScript types

Create app/api/spending-limits/[id]/route.ts:
- PATCH: Update limit (amount, threshold, is_active)
- DELETE: Delete spending limit
- Include auth check and ownership verification
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] CRUD operations work
- [ ] Validation prevents invalid data
- [ ] Auth checks pass
- [ ] Error handling works

---

## 📬 Phase 11: Gmail Integration

### Step 11.1: Gmail Service

**Prompt for Copilot:**
```
Create lib/services/gmail.ts:
- Import google.auth and gmail_v1 from googleapis
- Export GmailService class with:
  - constructor(userId: string)
  - async getClient(): Promise<gmail_v1.Gmail>
    - Fetch encrypted tokens from gmail_tokens table
    - Decrypt using encryption utils
    - Create OAuth2 client with credentials
    - Set credentials (access_token, refresh_token, expiry_date)
    - Return Gmail client
  - async fetchMessages(query: string, maxResults: number): Promise<gmail_v1.Schema$Message[]>
    - Get Gmail client
    - List messages with query
    - Fetch full message data for each
    - Return array of messages
  - async setupWatch(topicName: string): Promise<void>
    - Setup Gmail push notifications
    - Call users.watch() with topic
    - Store watch history ID in database
  - async refreshToken(): Promise<void>
    - Refresh access token if expired
    - Update gmail_tokens table with new token
- Include rate limiting using GmailRateLimiter class:
  - Track requests per minute (max 250/min)
  - Implement async checkLimit() that waits if limit reached
- Include proper error handling and TypeScript types
```

**Validation:**
- [ ] Service class created
- [ ] Token encryption/decryption works
- [ ] Gmail API calls succeed
- [ ] Rate limiting works
- [ ] TypeScript types correct

### Step 11.2: Gmail Webhook Handler

**Prompt for Copilot:**
```
Create app/api/gmail/webhook/route.ts:
- POST handler:
  - Parse incoming Pub/Sub message
  - Decode base64 data
  - Extract emailAddress and historyId
  - Find user by email in profiles table
  - If user found, enqueue 'process-email' job with messageId
  - Return 200 response
- GET handler (for verification):
  - Accept challenge parameter
  - Return challenge as plain text response
- Include proper error handling and TypeScript types
- Add logging for debugging
```

**Validation:**
- [ ] Endpoint handles Pub/Sub messages
- [ ] Decoding works correctly
- [ ] Jobs enqueued successfully
- [ ] Verification endpoint works
- [ ] Error handling works

### Step 11.3: Gmail Setup API

**Prompt for Copilot:**
```
Create app/api/gmail/setup/route.ts:
- POST handler:
  - Verify authenticated user
  - Call GmailService.setupWatch() with Pub/Sub topic
  - Store watch configuration in database
  - Return success response
- Include auth check
- Include proper error handling and TypeScript types

This endpoint should be called after OAuth callback to enable push notifications.
```

**Validation:**
- [ ] Setup endpoint works
- [ ] Watch configuration stored
- [ ] Push notifications enabled
- [ ] Error handling works

---

## 🚀 Phase 12: Loading Experience for New Users

### Step 12.1: Loading Page with SSE Progress

**Prompt for Copilot:**
```
Create app/(dashboard)/loading/page.tsx:
- Mark as 'use client'
- Create ProcessStatus interface: { progress: number, message: string, isComplete: boolean }
- State for 3 processes: 'process-1' (email sync), 'process-2' (pub/sub setup), 'process-3' (perks fetch)
- Connect to SSE endpoint
- Listen for 'progress' events and update process states
- Listen for 'complete' event and redirect to /dashboard after 1 second
- Display:
  - Page title: "🚀 Setting Up Your Dashboard"
  - 3 ProcessItem components showing progress
  - Each ProcessItem shows:
    - CheckCircle (green) if complete, Loader (spinning) if in progress
    - Progress bar (animated)
    - Current message
  - "This may take 2-3 minutes..." text
  - "Setup complete! Redirecting..." when done
- Use Framer Motion for animations
- Use gradient background matching dashboard
- Include proper TypeScript types

Create ProcessItem component inline:
- Props: number, progress, message, isComplete
- Animated entrance (stagger by number)
- Glassmorphism card styling
- Animated progress bar
```

**Validation:**
- [ ] Page renders correctly
- [ ] SSE updates show in real-time
- [ ] Progress bars animate
- [ ] Redirect works after completion
- [ ] Animations smooth

### Step 12.2: Update Workers to Send SSE Progress

**Prompt for Copilot:**
```
Update app/api/workers/initial-sync/route.ts:
- Import sseManager
- Throughout processing, call sseManager.sendToUser() with 'progress' event:
  - process: 'process-1'
  - progress: 0-100
  - message: descriptive status
- Send specific events:
  - At start: { process: 'process-1', progress: 0, message: 'Starting email sync...' }
  - At 10%: { process: 'process-1', progress: 10, message: 'Fetching emails...' }
  - At 30%: { process: 'process-1', progress: 30, message: 'Found X emails, parsing...' }
  - During loop: { process: 'process-1', progress: calculated%, message: 'Processed X/Y emails' }
  - At end: { process: 'process-1', progress: 100, message: '✅ Found X cards, Y transactions' }
- When all processes complete, send 'complete' event

Create similar worker for app/api/workers/setup-gmail/route.ts:
- Handle 'process-2' for Gmail Pub/Sub setup
- Call GmailService.setupWatch()
- Send progress updates via SSE

Create app/api/workers/fetch-perks/route.ts:
- Handle 'process-3' for fetching card perks
- Scrape or fetch perks data for card
- Store in card_perks table
- Send progress updates via SSE
```

**Validation:**
- [ ] Workers updated to send SSE
- [ ] Progress updates in real-time
- [ ] All 3 processes tracked
- [ ] Complete event fires
- [ ] Error states handled

---

## 🔐 Phase 13: Login & Authentication UI

### Step 13.1: Login Page

**Prompt for Copilot:**
```
Create app/login/page.tsx:
- Mark as 'use client'
- Create beautiful login page with:
  - Gradient background (from-cred-dark via-purple-900/20 to-cred-dark)
  - App logo (CreditCard icon in gradient circle)
  - Title: "Credit Card Dashboard"
  - Subtitle: "Track all your credit cards in one place"
  - Google Sign-In button (white, with Google logo SVG)
  - Info text: "By signing in, you agree to grant access to your Gmail for transaction tracking"
  - Feature badges: 🔒 Secure, ⚡ Real-time, 🎯 Smart Limits
- Use Framer Motion for entrance animations (staggered)
- handleGoogleLogin function:
  - Use supabase.auth.signInWithOAuth()
  - Provider: 'google'
  - Scopes: 'https://www.googleapis.com/auth/gmail.readonly'
  - Redirect to /api/auth/callback
- Include proper TypeScript types
- Use CreditCard icon from lucide-react
```

**Validation:**
- [ ] Login page renders beautifully
- [ ] Google OAuth flow works
- [ ] Redirects correctly
- [ ] Animations smooth
- [ ] Responsive design

### Step 13.2: Protected Route Wrapper

**Prompt for Copilot:**
```
Create app/(dashboard)/layout.tsx enhancement:
- Add authentication check at top of component
- Use Supabase client to check session
- If no session, redirect to /login
- Show loading state while checking auth
- Only render children if authenticated
- Include proper TypeScript types
```

**Validation:**
- [ ] Protected routes redirect to login
- [ ] Authenticated users see dashboard
- [ ] Loading state shows
- [ ] No flash of content

---

## 📊 Phase 14: Data Visualization & Charts

### Step 14.1: Spending Chart Component

**Prompt for Copilot:**
```
Create components/dashboard/SpendingChart.tsx:
- Mark as 'use client'
- Accept props: data (array of { category: string, amount: number })
- Use recharts library to create:
  - BarChart for category spending
  - Or PieChart for category distribution
  - Custom colors using CRED theme
  - Animated entrance
  - Responsive container
  - Tooltips showing amount
- Include toggle to switch between chart types
- Use glassmorphism container
- Include proper TypeScript types
```

**Validation:**
- [ ] Chart component renders
- [ ] Data visualizes correctly
- [ ] Animations work
- [ ] Responsive design
- [ ] Toggle works

### Step 14.2: Statement Timeline Component

**Prompt for Copilot:**
```
Create components/cards/StatementTimeline.tsx:
- Mark as 'use client'
- Accept props: statements (array of Statement objects)
- Display timeline of statements:
  - Month/Year
  - Total due amount
  - Payment status (paid/unpaid)
  - Due date
  - Download button (if available)
  - View transactions button
- Use vertical timeline design
- Glassmorphism cards
- Color code by payment status (green=paid, red=overdue, yellow=upcoming)
- Include Framer Motion animations
- Include proper TypeScript types
```

**Validation:**
- [ ] Timeline displays correctly
- [ ] Status colors work
- [ ] Actions functional
- [ ] Animations smooth
- [ ] Responsive design

---

## 🧪 Phase 15: Testing & Error Handling

### Step 15.1: Error Boundary Component

**Prompt for Copilot:**
```
Create components/ErrorBoundary.tsx:
- Create React error boundary class component
- Catch errors in component tree
- Display fallback UI with:
  - Error icon
  - Error message
  - "Try again" button to reload
  - "Go to dashboard" button
- Log errors to console (in production, send to monitoring service)
- Use glassmorphism styling
- Include proper TypeScript types

Wrap app/(dashboard)/layout.tsx with ErrorBoundary.
```

**Validation:**
- [ ] Error boundary catches errors
- [ ] Fallback UI displays
- [ ] Actions work (reload, navigate)
- [ ] Errors logged

### Step 15.2: Toast Notifications Setup

**Prompt for Copilot:**
```
Install react-hot-toast:
- Add dependency: pnpm add react-hot-toast

Update app/(dashboard)/layout.tsx:
- Import Toaster from react-hot-toast
- Add <Toaster /> component with custom styling:
  - Position: top-right
  - Dark theme
  - Custom colors matching CRED theme
  - Success: cred-green
  - Error: red-500
  - Loading: cred-blue

Create lib/utils/toast.ts:
- Export helper functions:
  - showSuccess(message: string)
  - showError(message: string)
  - showLoading(message: string)
  - dismissToast(id?: string)
- Use toast from react-hot-toast
- Include proper TypeScript types
```

**Validation:**
- [ ] Toast notifications work
- [ ] Styling matches theme
- [ ] Helper functions work
- [ ] Toasts dismissible

### Step 15.3: API Error Handling Utilities

**Prompt for Copilot:**
```
Create lib/utils/api-error.ts:
- Export ApiError class extending Error:
  - Properties: message, statusCode, code
  - Constructor accepts message, statusCode, optional code
- Export handleApiError(error: unknown): ApiError function:
  - Handles different error types (Supabase, network, unknown)
  - Returns standardized ApiError
- Export apiResponse helper functions:
  - success(data: any, status = 200)
  - error(message: string, status = 500, code?: string)
- Include proper TypeScript types

Update all API routes to use these utilities for consistent error handling.
```

**Validation:**
- [ ] Error utilities created
- [ ] API routes updated
- [ ] Error responses consistent
- [ ] TypeScript types correct

---

## 🔧 Phase 16: Configuration & Environment

### Step 16.1: Next.js Configuration

**Prompt for Copilot:**
```
Update next.config.js with:
- Enable React strict mode
- Configure images domains: ['lh3.googleusercontent.com'] for Google avatars
- Image formats: ['image/avif', 'image/webp']
- Enable compression
- Enable swcMinify for smaller bundles
- Add security headers:
  - X-DNS-Prefetch-Control: on
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1; mode=block
- Configure environment variables
- Include proper TypeScript types
```

**Validation:**
- [ ] Config file updated
- [ ] Images load from Google
- [ ] Security headers set
- [ ] Build succeeds

### Step 16.2: Environment Validation

**Prompt for Copilot:**
```
Create lib/config/env.ts:
- Validate all required environment variables at runtime
- Export validated config object with typed properties:
  - supabase: { url, anonKey, serviceRoleKey }
  - google: { clientId, clientSecret }
  - upstash: { redisUrl, redisToken, qstashToken }
  - app: { url, encryptionKey }
- Throw descriptive error if any required var is missing
- Include TypeScript types

Import and validate in middleware.ts and critical API routes.
```

**Validation:**
- [ ] Validation works
- [ ] Missing vars throw errors
- [ ] Config object typed correctly
- [ ] Used in appropriate places

---

## 🎨 Phase 17: Polish & Optimization

### Step 17.1: Loading States & Skeletons

**Prompt for Copilot:**
```
Update all data-fetching components to show loading skeletons:

1. Dashboard page - show card skeletons while loading
2. Card detail page - show content skeletons
3. Transaction timeline - show list skeletons
4. Spending summary - show progress bar skeleton

Use LoadingSkeleton component with appropriate types.
Ensure smooth transition from skeleton to real content using Framer Motion.
```

**Validation:**
- [ ] All pages have loading states
- [ ] Skeletons match final layout
- [ ] Transitions smooth
- [ ] No layout shift

### Step 17.2: Empty States

**Prompt for Copilot:**
```
Create components/ui/EmptyState.tsx:
- Accept props: icon (ReactNode), title (string), description (string), action (optional { label, onClick })
- Display centered empty state with:
  - Large icon (from lucide-react)
  - Title and description
  - Optional action button
  - Glassmorphism container
- Use Framer Motion for entrance animation
- Include proper TypeScript types

Add empty states to:
1. Dashboard (no cards): "No Cards Found" with "Connect Gmail" action
2. Transactions (no data): "No Transactions Yet"
3. Perks (no data): "No Perks Available"
4. Statements (no data): "No Statements Generated"
```

**Validation:**
- [ ] Empty state component created
- [ ] All pages have empty states
- [ ] Actions work
- [ ] Design consistent

### Step 17.3: Mobile Responsiveness

**Prompt for Copilot:**
```
Audit and fix responsive design for all components:

1. Dashboard:
   - Stack cards vertically on mobile
   - Make header sticky
   - Adjust spacing and padding

2. Card detail page:
   - Stack sections vertically on mobile
   - Make tabs scrollable horizontally
   - Adjust chart sizes

3. Transaction timeline:
   - Reduce icon sizes on mobile
   - Stack content vertically
   - Adjust font sizes

4. Forms and modals:
   - Full screen on mobile
   - Larger touch targets
   - Bottom sheet style for actions

Test on breakpoints: 320px (mobile), 768px (tablet), 1024px (laptop), 1512px (macbook-14).
```

**Validation:**
- [ ] All pages responsive
- [ ] Touch targets adequate (44px min)
- [ ] No horizontal scroll
- [ ] Readable on all sizes
- [ ] Tested on actual devices

---

## 📦 Phase 18: Deployment Preparation

### Step 18.1: Production Environment Variables

**Prompt for Copilot:**
```
Create .env.production template with all required variables:
- Update NEXT_PUBLIC_URL to production domain
- Keep other variables as placeholders
- Add comments explaining each variable
- Include instructions for obtaining credentials

Create scripts/setup-env.sh:
- Bash script to help set up environment variables
- Prompt for each required value
- Validate format (URLs, etc.)
- Generate ENCRYPTION_KEY automatically
- Write to .env.local
- Include usage instructions
```

**Validation:**
- [ ] Production template created
- [ ] Setup script works
- [ ] Instructions clear
- [ ] Validation works

### Step 18.2: Build Optimization

**Prompt for Copilot:**
```
Update package.json with build scripts:
- "build": "next build"
- "start": "next start"
- "analyze": "ANALYZE=true next build"
- "lint": "next lint"
- "type-check": "tsc --noEmit"

Create .vercelignore file to exclude:
- node_modules
- .next
- .env*
- *.log
- .DS_Store

Create vercel.json with configuration:
- Build command: pnpm build
- Output directory: .next
- Install command: pnpm install
- Framework: nextjs
- Environment variables reference
```

**Validation:**
- [ ] Build succeeds locally
- [ ] Type check passes
- [ ] Lint passes
- [ ] Bundle size reasonable (<1MB initial)

### Step 18.3: Health Check & Monitoring

**Prompt for Copilot:**
```
Create app/api/health/route.ts:
- GET endpoint
- Check Supabase connectivity (simple query)
- Check Redis connectivity (ping)
- Check environment variables loaded
- Return JSON:
  - status: 'healthy' | 'unhealthy'
  - checks: { database: boolean, redis: boolean, env: boolean }
  - timestamp: ISO string
- Return 200 if healthy, 503 if unhealthy
- Include proper error handling

Create app/api/metrics/route.ts:
- GET endpoint (protected, require auth header)
- Return metrics:
  - Total users
  - Total cards
  - Total transactions
  - Active SSE connections
  - Job queue length
- Only accessible with admin API key
- Include proper error handling
```

**Validation:**
- [ ] Health check returns correct status
- [ ] All checks work
- [ ] Metrics endpoint secure
- [ ] Data accurate

---

## 📚 Phase 19: Documentation

### Step 19.1: README

**Prompt for Copilot:**
```
Create comprehensive README.md:
- Project title and description
- Features list with checkmarks
- Tech stack
- Prerequisites
- Installation steps:
  1. Clone repository
  2. Install dependencies
  3. Set up Supabase
  4. Configure Google OAuth
  5. Set up Upstash Redis
  6. Configure environment variables
  7. Run migrations
  8. Start development server
- Deployment instructions for Vercel
- Usage guide
- API documentation (link to separate file)
- Troubleshooting section
- Contributing guidelines
- License

Create API.md with:
- All API endpoints documented
- Request/response formats
- Authentication requirements
- Example requests using curl
```

**Validation:**
- [ ] README comprehensive
- [ ] Instructions tested by following them
- [ ] API docs complete
- [ ] Links work

### Step 19.2: Code Comments & JSDoc

**Prompt for Copilot:**
```
Add JSDoc comments to all major functions and components:
- Description of what function/component does
- @param tags for parameters with types
- @returns tag for return values
- @throws tag for potential errors
- @example tag with usage example

Focus on:
- All service classes
- API route handlers
- Complex utility functions
- Custom hooks
- Main page components

Use consistent style throughout.
```

**Validation:**
- [ ] Comments added to key files
- [ ] JSDoc syntax correct
- [ ] Examples helpful
- [ ] Types documented

---

## ✅ Phase 20: Final Testing & Launch

### Step 20.1: Integration Testing

**Prompt for Copilot:**
```
Create comprehensive test checklist document (TESTING.md):

1. Authentication Flow:
   - [ ] New user can sign in with Google
   - [ ] Redirects to loading page
   - [ ] Email sync completes
   - [ ] Redirects to dashboard
   - [ ] Existing user redirects to dashboard directly
   - [ ] Logout works
   - [ ] Protected routes redirect to login

2. Email Processing:
   - [ ] Manual trigger of initial sync works
   - [ ] Transactions parsed correctly for all banks
   - [ ] Cards auto-created
   - [ ] Categories auto-assigned
   - [ ] Real-time notifications work
   - [ ] Duplicate detection works

3. Dashboard:
   - [ ] Cards display grouped by bank
   - [ ] Spending summary accurate
   - [ ] Progress bars animate
   - [ ] Alerts show for limits
   - [ ] SSE connection establishes
   - [ ] Real-time updates appear

4. Card Details:
   - [ ] All tabs functional
   - [ ] Transactions display correctly
   - [ ] Perks show (if available)
   - [ ] Statements list correctly
   - [ ] Charts render with data

5. Spending Limits:
   - [ ] Can create global limit
   - [ ] Can create category limits
   - [ ] Alerts trigger correctly
   - [ ] Email alerts sent
   - [ ] Progress updates real-time

6. Settings:
   - [ ] Profile updates work
   - [ ] Spending limits CRUD works
   - [ ] Email patterns CRUD works
   - [ ] Data export works
   - [ ] Dangerous actions require confirmation

7. Mobile:
   - [ ] All pages responsive
   - [ ] Navigation works
   - [ ] Forms usable
   - [ ] No horizontal scroll
   - [ ] Touch targets adequate

8. Performance:
   - [ ] Initial load < 3s
   - [ ] Page transitions smooth
   - [ ] No layout shifts
   - [ ] Images optimized
   - [ ] Bundle size reasonable

9. Error Handling:
   - [ ] Network errors handled gracefully
   - [ ] Invalid data shows errors
   - [ ] Error boundary catches crashes
   - [ ] User-friendly error messages

Include test scripts and manual testing procedures.
```

**Validation:**
- [ ] All checklist items pass
- [ ] Edge cases tested
- [ ] Error paths tested
- [ ] Different screen sizes tested

### Step 20.2: Pre-launch Checklist

**Prompt for Copilot:**
```
Create LAUNCH_CHECKLIST.md:

Production Setup:
- [ ] Supabase project created and configured
- [ ] All database migrations run
- [ ] RLS policies enabled and tested
- [ ] Google OAuth configured with production callback
- [ ] Gmail API enabled and credentials set
- [ ] Pub/Sub topic created and configured
- [ ] Upstash Redis created
- [ ] QStash configured
- [ ] All environment variables set in Vercel
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active

Security:
- [ ] All API routes have auth checks
- [ ] RLS policies prevent unauthorized access
- [ ] Encryption key is secure and random
- [ ] No secrets in client-side code
- [ ] CORS configured correctly
- [ ] Rate limiting implemented
- [ ] Input validation on all forms

Performance:
- [ ] Lighthouse score > 90
- [ ] Images optimized
- [ ] Code split appropriately
- [ ] Unused dependencies removed
- [ ] Build size optimized

Monitoring:
- [ ] Health check endpoint working
- [ ] Error logging configured
- [ ] Analytics setup (if applicable)
- [ ] Uptime monitoring configured

Documentation:
- [ ] README complete
- [ ] API docs complete
- [ ] Environment setup guide complete
- [ ] Troubleshooting guide complete

User Experience:
- [ ] All user flows tested end-to-end
- [ ] Error messages helpful
- [ ] Loading states everywhere
- [ ] Empty states everywhere
- [ ] Success confirmations clear
```

**Validation:**
- [ ] All checklist items complete
- [ ] Production environment tested
- [ ] Rollback plan prepared
- [ ] Support plan ready

### Step 20.3: Deployment

**Prompt for Copilot:**
```
Create deployment script scripts/deploy.sh:
- Run type check
- Run linter
- Run build
- Verify build success
- Deploy to Vercel
- Run post-deploy health check
- Output deployment URL
- Include error handling

Create scripts/rollback.sh:
- Revert to previous Vercel deployment
- Verify rollback successful
- Notify team
```

**Validation:**
- [ ] Deploy script works
- [ ] Deployment succeeds
- [ ] Health check passes
- [ ] Application accessible
- [ ] All features work in production

---

## 🎉 Post-Launch

### Monitoring (Week 1)

**Tasks:**
```
1. Monitor error rates daily
2. Check database growth
3. Review API usage
4. Collect user feedback
5. Fix critical bugs immediately
6. Document known issues
7. Plan next features
```

### Optimization (Ongoing)

**Tasks:**
```
1. Analyze performance metrics
2. Optimize slow queries
3. Reduce bundle size
4. Improve cache strategies
5. Update dependencies
6. Security patches
7. User-requested features

📝 Summary
This phased implementation guide provides 20 detailed phases for building the Credit Card Dashboard with GitHub Copilot:

Phase 0: Environment setup
Phase 1: Database & Supabase
Phase 2: Authentication & utilities
Phase 3: UI foundation & theme
Phase 4: Email parsing system
Phase 5: Background job queue
Phase 6: Real-time notifications (SSE)
Phase 7: Dashboard UI
Phase 8: Card details & transactions
Phase 9: Settings & spending limits
Phase 10: API routes
Phase 11: Gmail integration
Phase 12: Loading experience
Phase 13: Login & auth UI
Phase 14: Data visualization
Phase 15: Testing & error handling
Phase 16: Configuration
Phase 17: Polish & optimization
Phase 18: Deployment prep
Phase 19: Documentation
Phase 20: Final testing & launch

Each phase includes:

✅ Specific prompts for Copilot
✅ File locations and structure
✅ Validation checklist
✅ Manual steps (when required)

Estimated Timeline: 2-3 weeks (depending on experience level)
Cost: $0-1/month in production 🎉