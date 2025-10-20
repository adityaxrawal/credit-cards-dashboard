# Credit Card Dashboard - Complete Development Specification

## 🎯 Project Overview

Build a **Credit Card Management Dashboard** that automatically tracks all credit card transactions, statements, perks, and spending limits by parsing Gmail emails in real-time.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │   MacBook    │         │   Mobile/    │                      │
│  │   Desktop    │         │   Tablet     │                      │
│  └──────┬───────┘         └──────┬───────┘                      │
└─────────┼────────────────────────┼──────────────────────────────┘
          │                        │
          └────────────┬───────────┘
                       │ HTTPS
┌─────────────────────▼────────────────────────────────────────────┐
│                    FRONTEND LAYER                                 │
│  React + TypeScript + Tailwind + Framer Motion                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │ Dashboard  │  │ Card Detail│  │ Settings   │                 │
│  │ Component  │  │ Component  │  │ Component  │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
│         │              │               │                          │
│         └──────────────┴───────────────┘                          │
│                        │ REST API + WebSocket                     │
└────────────────────────┼──────────────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────────────┐
│                    BACKEND LAYER (NestJS)                          │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  API Gateway Module (REST Controllers)                   │    │
│  │  - Auth Controller    - Cards Controller                 │    │
│  │  - Transactions Ctrl  - Notifications Ctrl               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Core Services                                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │ Auth Service│  │Email Parser │  │Notification │     │    │
│  │  │  (Google)   │  │   Service   │  │  Service    │     │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │Transaction  │  │Card Perks   │  │Spending Limit│    │    │
│  │  │   Service   │  │   Service   │  │   Service    │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Background Workers (Bull Queue)                          │    │
│  │  - Initial Email Sync Worker (Process 1)                 │    │
│  │  - Card Perks Scraper Worker (Process 3)                 │    │
│  │  - Real-time Email Processor (Process 2)                 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  WebSocket Gateway                                        │    │
│  │  - Real-time transaction notifications                    │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────┬──────────────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────────────┐
│               GOOGLE CLOUD SERVICES                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │Cloud SQL    │  │ Pub/Sub     │  │ Gmail API   │              │
│  │(PostgreSQL) │  │ (Email Push)│  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                                │
│  │Cloud Run    │  │Cloud Storage│                                │
│  │(Backend)    │  │(Logs/Backup)│                                │
│  └─────────────┘  └─────────────┘                                │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### **ERD (Entity Relationship Diagram)**

```
┌─────────────────────────┐
│        users            │
├─────────────────────────┤
│ id (PK)                 │
│ google_id (UNIQUE)      │
│ email (UNIQUE)          │
│ full_name               │
│ profile_picture_url     │
│ global_spending_limit   │◄────┐
│ created_at              │     │
│ updated_at              │     │
└───────────┬─────────────┘     │
            │                   │
            │ 1:N               │
            │                   │
┌───────────▼─────────────┐     │
│    credit_cards         │     │
├─────────────────────────┤     │
│ id (PK)                 │     │
│ user_id (FK)            │─────┘
│ bank_name               │
│ card_last_4_digits      │
│ card_holder_name        │
│ card_type (VISA/MC/etc) │
│ statement_generation_day│
│ sender_email_pattern    │
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
│ id (PK)                 │  │ id (PK)                 │
│ card_id (FK)            │  │ card_id (FK)            │
│ transaction_date        │  │ statement_id (FK)       │
│ merchant_name           │  │ transaction_date        │
│ amount                  │  │ merchant_name           │
│ category (auto)         │  │ amount                  │
│ category_manual         │  │ category                │
│ description             │  │ description             │
│ transaction_type        │  │ transaction_type        │
│  (DEBIT/CREDIT/REVERSAL)│  │ email_metadata_json     │
│ email_metadata_json     │  │ created_at              │
│ created_at              │  └─────────────────────────┘
│ updated_at              │
└─────────────────────────┘           │
                                      │ N:1
            ┌─────────────────────────┘
            │
┌───────────▼─────────────┐
│      statements         │
├─────────────────────────┤
│ id (PK)                 │
│ card_id (FK)            │
│ statement_month         │
│ statement_year          │
│ billing_cycle_start     │
│ billing_cycle_end       │
│ due_date                │
│ total_amount_due        │
│ minimum_amount_due      │
│ total_transactions      │
│ statement_pdf_url       │
│ is_paid                 │
│ paid_date               │
│ created_at              │
└─────────────────────────┘

┌─────────────────────────┐
│     card_perks          │
├─────────────────────────┤
│ id (PK)                 │
│ card_id (FK)            │
│ perk_type               │
│  (CASHBACK/REWARD/etc)  │
│ perk_description        │
│ perk_value              │
│ perk_category           │
│ validity_start          │
│ validity_end            │
│ terms_and_conditions    │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│   spending_limits       │
├─────────────────────────┤
│ id (PK)                 │
│ user_id (FK)            │
│ limit_type (GLOBAL/     │
│  CATEGORY)              │
│ category_name (nullable)│
│ limit_amount            │
│ current_spending        │
│ alert_threshold_percent │
│ is_active               │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│   email_patterns        │
├─────────────────────────┤
│ id (PK)                 │
│ bank_name               │
│ sender_email            │
│ subject_keywords        │
│ transaction_regex       │
│ statement_regex         │
│ card_last_4_regex       │
│ amount_regex            │
│ date_regex              │
│ merchant_regex          │
│ created_at              │
│ updated_at              │
└─────────────────────────┘
```

---

## 🔄 User Flow Diagrams

### **New User Onboarding Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                     NEW USER JOURNEY                             │
└─────────────────────────────────────────────────────────────────┘

1. USER VISITS WEBSITE
   │
   ├──► Clicks "Sign in with Google"
   │
   ├──► Google OAuth2 Redirect
   │    - Request scopes: email, profile, gmail.readonly
   │
   ├──► User grants permissions
   │
   ├──► Redirect back with auth code
   │
   ├──► Backend validates token
   │
   ├──► Check if user exists in DB
   │    │
   │    ├──► NO (New User) ──────────────────────────────┐
   │    │                                                  │
   │    │                                                  ▼
   │    │                                    ┌─────────────────────┐
   │    │                                    │ CREATE USER RECORD  │
   │    │                                    │ - Store Google ID   │
   │    │                                    │ - Store email       │
   │    │                                    │ - Generate JWT      │
   │    │                                    └──────────┬──────────┘
   │    │                                               │
   │    │                                               ▼
   │    │                                    ┌─────────────────────┐
   │    │                                    │ REDIRECT TO         │
   │    │                                    │ LOADING DASHBOARD   │
   │    │                                    └──────────┬──────────┘
   │    │                                               │
   │    │                        ┌──────────────────────┴────────────────────┐
   │    │                        │                                           │
   │    │                        ▼                                           ▼
   │    │         ┌──────────────────────────┐              ┌──────────────────────────┐
   │    │         │    PROCESS 1 STARTS       │              │    PROCESS 2 STARTS      │
   │    │         │  (Background Worker)      │              │  (Gmail Pub/Sub Setup)   │
   │    │         │                           │              │                          │
   │    │         │ 1. Fetch all emails from  │              │ 1. Subscribe user email  │
   │    │         │    Gmail API (last 2 yrs) │              │    to Pub/Sub topic      │
   │    │         │ 2. Filter transaction &   │              │ 2. Configure push        │
   │    │         │    statement emails       │              │    endpoint to backend   │
   │    │         │ 3. Parse each email:      │              │ 3. Set up WebSocket      │
   │    │         │    - Extract card details │              │    connection for user   │
   │    │         │    - Extract transactions │              │                          │
   │    │         │    - Extract statements   │              │ ✅ PROCESS 2 COMPLETE   │
   │    │         │ 4. Group by card (last 4) │              │    (Real-time ready)     │
   │    │         │ 5. Create card records    │              └──────────────────────────┘
   │    │         │ 6. Store transactions in  │
   │    │         │    appropriate tables     │
   │    │         │                           │
   │    │         │ Progress Updates:         │
   │    │         │ - "Scanning emails..."    │
   │    │         │ - "Found X transactions"  │
   │    │         │ - "Processing cards..."   │
   │    │         │                           │
   │    │         │ ✅ PROCESS 1 COMPLETE    │
   │    │         └────────────┬──────────────┘
   │    │                      │
   │    │                      ▼
   │    │         ┌──────────────────────────┐
   │    │         │    PROCESS 3 STARTS       │
   │    │         │  (Background Worker)      │
   │    │         │                           │
   │    │         │ For each card found:      │
   │    │         │ 1. Identify bank + type   │
   │    │         │ 2. Scrape bank website    │
   │    │         │    for card perks (try)   │
   │    │         │ 3. If fails, use AI to    │
   │    │         │    research and compile   │
   │    │         │ 4. Store in card_perks    │
   │    │         │    table                  │
   │    │         │                           │
   │    │         │ Progress Updates:         │
   │    │         │ - "Fetching card perks..." │
   │    │         │ - "Loading benefits..."   │
   │    │         │                           │
   │    │         │ ✅ PROCESS 3 COMPLETE    │
   │    │         └────────────┬──────────────┘
   │    │                      │
   │    │                      ▼
   │    │         ┌──────────────────────────┐
   │    │         │    PROCESS 4 STARTS       │
   │    │         │  (API Service)            │
   │    │         │                           │
   │    │         │ 1. Fetch all user cards   │
   │    │         │ 2. Fetch current          │
   │    │         │    transactions           │
   │    │         │ 3. Calculate spending     │
   │    │         │ 4. Fetch card perks       │
   │    │         │ 5. Build dashboard data   │
   │    │         │                           │
   │    │         │ ✅ PROCESS 4 COMPLETE    │
   │    │         └────────────┬──────────────┘
   │    │                      │
   │    │                      ▼
   │    │         ┌──────────────────────────┐
   │    │         │  SHOW FULL DASHBOARD      │
   │    │         │  - All cards visible      │
   │    │         │  - Transactions loaded    │
   │    │         │  - Perks available        │
   │    │         └───────────────────────────┘
   │    │
   │    └──► YES (Existing User) ──────────────────────────┐
   │                                                        │
   │                                                        ▼
   │                                          ┌──────────────────────────┐
   │                                          │ VALIDATE JWT & LOGIN     │
   │                                          │ - Skip Process 1-3       │
   │                                          │ - Run Process 4 only     │
   │                                          │ - Show dashboard         │
   │                                          └──────────────────────────┘
   │
   └─────────────────────────────────────────────────────────────────────┘
```

### **Real-time Transaction Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│              REAL-TIME TRANSACTION PROCESSING                    │
└─────────────────────────────────────────────────────────────────┘

User receives new email in Gmail
   │
   ├──► Gmail Pub/Sub triggers push notification
   │
   ├──► Backend receives webhook at /api/gmail/push
   │
   ├──► Email Parser Service activated
   │    │
   │    ├──► Fetch email using message ID
   │    │
   │    ├──► Check sender email against email_patterns
   │    │
   │    ├──► Is it a transaction or statement?
   │    │    │
   │    │    ├──► TRANSACTION DETECTED
   │    │    │    │
   │    │    │    ├──► Extract:
   │    │    │    │    - Card last 4 digits
   │    │    │    │    - Merchant name
   │    │    │    │    - Amount
   │    │    │    │    - Date
   │    │    │    │    - Transaction type
   │    │    │    │
   │    │    │    ├──► Find card by last 4 digits
   │    │    │    │    │
   │    │    │    │    ├──► CARD EXISTS
   │    │    │    │    │    │
   │    │    │    │    │    ├──► Insert into current_transactions
   │    │    │    │    │    │
   │    │    │    │    │    ├──► Auto-categorize transaction
   │    │    │    │    │    │    (merchant name matching)
   │    │    │    │    │    │
   │    │    │    │    │    ├──► Update spending_limits.current_spending
   │    │    │    │    │    │
   │    │    │    │    │    ├──► Check if limit exceeded
   │    │    │    │    │    │    │
   │    │    │    │    │    │    ├──► YES
   │    │    │    │    │    │    │    │
   │    │    │    │    │    │    │    ├──► Send email alert via Gmail API
   │    │    │    │    │    │    │    │    "You've exceeded your spending limit"
   │    │    │    │    │    │    │    │
   │    │    │    │    │    │    │    └──► Log alert sent
   │    │    │    │    │    │    │
   │    │    │    │    │    │    └──► NO → Continue
   │    │    │    │    │    │
   │    │    │    │    │    ├──► Check if user is logged in
   │    │    │    │    │    │    │
   │    │    │    │    │    │    ├──► YES
   │    │    │    │    │    │    │    │
   │    │    │    │    │    │    │    └──► Send WebSocket notification
   │    │    │    │    │    │    │         to active user session
   │    │    │    │    │    │    │         "New transaction: ₹X at Merchant"
   │    │    │    │    │    │    │
   │    │    │    │    │    │    └──► NO → Skip notification
   │    │    │    │    │    │
   │    │    │    │    │    └──► ✅ Transaction stored
   │    │    │    │    │
   │    │    │    │    └──► CARD DOES NOT EXIST
   │    │    │    │         │
   │    │    │    │         ├──► Create new credit_cards record
   │    │    │    │         │    - Extract bank from sender email
   │    │    │    │         │    - Store card last 4
   │    │    │    │         │    - Store sender pattern
   │    │    │    │         │
   │    │    │    │         ├──► Create current_transactions table entry
   │    │    │    │         │
   │    │    │    │         ├──► Trigger Process 3 for this new card
   │    │    │    │         │    (fetch perks in background)
   │    │    │    │         │
   │    │    │    │         └──► ✅ New card added
   │    │    │    │
   │    │    │
   │    │    └──► STATEMENT DETECTED
   │    │         │
   │    │         ├──► Extract:
   │    │         │    - Card last 4 digits
   │    │         │    - Billing cycle dates
   │    │         │    - Due date
   │    │         │    - Total amount due
   │    │         │    - All transactions in statement
   │    │         │
   │    │         ├──► Find card by last 4 digits
   │    │         │
   │    │         ├──► Create statements record
   │    │         │
   │    │         ├──► Move all current_transactions for this
   │    │         │    card within the cycle to
   │    │         │    statement_transactions
   │    │         │    │
   │    │         │    └──► Link to statement_id
   │    │         │
   │    │         ├──► Clear current_transactions for this card
   │    │         │
   │    │         └──► ✅ Statement processed
   │    │
   │    └──► NOT A CARD EMAIL → Ignore
   │
   └──► End
```

---

## 🎨 Frontend Component Architecture

### **Dashboard Layout (MacBook 14" - 1512x982)**

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Credit Card Dashboard    [🔔 Notifications]  [⚙️ Settings] [👤]│ │
│  └─────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  SPENDING SUMMARY                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Total Due: ₹38,494.52                                          │ │
│  │  Current Spending: ₹12,450 / ₹50,000 (Global Limit)            │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 24%                       │ │
│  │                                                                  │ │
│  │  Category Breakdown:                                            │ │
│  │  🍕 Food: ₹5,200/₹10,000  🚗 Travel: ₹3,500/₹8,000            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  CREDIT CARDS (Grouped by Bank)                                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  SBI BANK                                                        │ │
│  │  ┌──────────────────┐                                           │ │
│  │  │  🔵 SBI Card     │   Hover: Glassmorphism glow effect        │ │
│  │  │  VISA •• 7603    │   Click: Navigate to detail page          │ │
│  │  │                  │                                            │ │
│  │  │  ADITYA RAWAL    │                                            │ │
│  │  │                  │                                            │ │
│  │  │  ₹12,489.00      │                                            │ │
│  │  │  Due: 29 Oct     │                                            │ │
│  │  │                  │                                            │ │
│  │  │  [Pay Now]       │                                            │ │
│  │  └──────────────────┘                                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  HDFC BANK                                                       │ │
│  │  ┌──────────────────┐                                           │ │
│  │  │  🟠 HDFC Card    │                                            │ │
│  │  │  MC •• 0364      │                                            │ │
│  │  │                  │                                            │ │
│  │  │  ADITYA RAWAL    │                                            │ │
│  │  │                  │                                            │ │
│  │  │  ₹6,624.00       │                                            │ │
│  │  │  Due: 2 Nov      │                                            │ │
│  │  │                  │                                            │ │
│  │  │  [Pay Now]       │                                            │ │
│  │  └──────────────────┘                                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  AXIS BANK                                                       │ │
│  │  ┌──────────────────┐                                           │ │
│  │  │  ⚫ Axis Card    │                                            │ │
│  │  │  MC •• 3825      │                                            │ │
│  │  │                  │                                            │ │
│  │  │  ADITYA RAWAL    │                                            │ │
│  │  │                  │                                            │ │
│  │  │  ₹6,603.77       │                                            │ │
│  │  │  Due: 1 Nov      │                                            │ │
│  │  │                  │                                            │ │
│  │  │  [Pay Now]       │                                            │ │
│  │  └──────────────────┘                                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### **Card Detail Page**

```
┌──────────────────────────────────────────────────────────────────────┐
│  [← Back]                          AXIS BANK CARD                     │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ⚫ AXIS BANK                           ₹6,603.77              │  │
│  │  MC •• 3825                             Due: 1 Nov             │  │
│  │                                                                 │  │
│  │  ADITYA RAWAL                                                  │  │
│  │                                                    [Pay Now]   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  CARD PERKS & BENEFITS                                    [▼]  │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │  🎯 5% cashback on dining                                      │ │
│  │  ✈️ 2 free airport lounge access per quarter                   │ │
│  │  🎬 Buy 1 Get 1 movie tickets                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  TRANSACTIONS                                                   │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │  Showing: Current Month (12 Oct - Today)                       │ │
│  │                                                                 │ │
│  │  📅 October Statement Generated                                │ │
│  │  Period: 12 Sep - 12 Oct                                       │ │
│  │  Total: ₹6,603.77  →  [View Full Statement]                   │ │
│  │                                                                 │ │
│  │  Recent Spends (12 Oct - Today):                               │ │
│  │                                                                 │ │
│  │  🍕 Airtel                                      ₹379.00  17 Oct│ │
│  │     housing and utilities                                      │ │
│  │                                                                 │ │
│  │  💰 Cashback Credit Sep25                     +₹250.00   8 Oct│ │
│  │     cashback                                                   │ │
│  │                                                                 │ │
│  │  ▶️ Youtube                                       ₹2.00   8 Oct│ │
│  │     apps and software                                          │ │
│  │                                                                 │ │
│  │  💸 EMI Principal                              ₹5,310.39  8 Oct│ │
│  │     emi                                                        │ │
│  │                                                                 │ │
│  │  [Load More]                                                   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  FEES & CHARGES                                            [▼] │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │  Annual Fee: ₹500 (waived on ₹1.5L annual spend)              │ │
│  │  Late Payment: ₹500                                            │ │
│  │  GST on Charges: ₹12.75                                        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### **Loading Screen (New User)**

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                    🚀 Setting Up Your Dashboard                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ✅ Process 1: Scanning your emails...                          │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%         │ │
│  │     Found 3 credit cards, 247 transactions                      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ✅ Process 2: Setting up real-time sync...                     │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100%         │ │
│  │     Email notifications configured                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  🔄 Process 3: Fetching card perks...                           │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 67%             │ │
│  │     Loading benefits for Axis Card...                           │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ⏳ Process 4: Preparing your dashboard...                      │ │
│  │  ━━━━━━━━━━━━━━━━━ 0%                                         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│                    This may take 2-3 minutes...                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Endpoints Specification

### **Authentication Module**

```typescript
POST /api/auth/google
  - Body: { code: string }
  - Response: { access_token: string, user: UserDto }
  - Description: Exchange Google OAuth code for JWT

GET /api/auth/me
  - Headers: { Authorization: Bearer <token> }
  - Response: UserDto
  - Description: Get current user info

POST /api/auth/logout
  - Headers: { Authorization: Bearer <token> }
  - Response: { message: string }
  - Description: Invalidate session
```

### **Cards Module**

```typescript
GET /api/cards
  - Headers: { Authorization: Bearer <token> }
  - Response: CardDto[]
  - Description: Get all credit cards for user, grouped by bank

GET /api/cards/:cardId
  - Headers: { Authorization: Bearer <token> }
  - Response: CardDetailDto (includes perks, current spending)
  - Description: Get detailed info for specific card

GET /api/cards/:cardId/perks
  - Headers: { Authorization: Bearer <token> }
  - Response: CardPerkDto[]
  - Description: Get all perks/benefits for card

GET /api/cards/:cardId/statements
  - Headers: { Authorization: Bearer <token> }
  - Query: { page: number, limit: number }
  - Response: { statements: StatementDto[], total: number }
  - Description: Get paginated statements for card
```

### **Transactions Module**

```typescript
GET /api/transactions/current
  - Headers: { Authorization: Bearer <token> }
  - Query: { cardId?: string, category?: string, page: number, limit: number }
  - Response: { transactions: TransactionDto[], total: number }
  - Description: Get current month transactions (not in statement)

GET /api/transactions/statement/:statementId
  - Headers: { Authorization: Bearer <token> }
  - Query: { page: number, limit: number }
  - Response: { transactions: TransactionDto[], total: number }
  - Description: Get transactions from specific statement

PATCH /api/transactions/:transactionId/category
  - Headers: { Authorization: Bearer <token> }
  - Body: { category_manual: string }
  - Response: TransactionDto
  - Description: Manually update transaction category

GET /api/transactions/summary
  - Headers: { Authorization: Bearer <token> }
  - Response: { 
      totalSpending: number,
      categoryBreakdown: Record<string, number>,
      cardWiseBreakdown: Record<string, number>
    }
  - Description: Get spending summary for dashboard
```

### **Spending Limits Module**

```typescript
GET /api/spending-limits
  - Headers: { Authorization: Bearer <token> }
  - Response: SpendingLimitDto[]
  - Description: Get all spending limits (global + category)

POST /api/spending-limits
  - Headers: { Authorization: Bearer <token> }
  - Body: { 
      limit_type: 'GLOBAL' | 'CATEGORY',
      category_name?: string,
      limit_amount: number,
      alert_threshold_percent: number
    }
  - Response: SpendingLimitDto
  - Description: Create new spending limit

PUT /api/spending-limits/:limitId
  - Headers: { Authorization: Bearer <token> }
  - Body: { limit_amount: number, alert_threshold_percent: number }
  - Response: SpendingLimitDto
  - Description: Update existing limit

DELETE /api/spending-limits/:limitId
  - Headers: { Authorization: Bearer <token> }
  - Response: { message: string }
  - Description: Delete spending limit
```

### **Notifications Module (WebSocket)**

```typescript
WS /api/notifications
  - Headers: { Authorization: Bearer <token> }
  - Events:
    - 'transaction:new' → { transaction: TransactionDto, card: CardDto }
    - 'limit:exceeded' → { limit: SpendingLimitDto, currentSpending: number }
    - 'statement:generated' → { statement: StatementDto, card: CardDto }
  - Description: Real-time notifications for logged-in users
```

### **Gmail Webhook**

```typescript
POST /api/gmail/push
  - Headers: { Authorization: <Google Pub/Sub verification> }
  - Body: { message: { data: string, messageId: string } }
  - Response: { status: 'ok' }
  - Description: Receive Gmail push notifications
```

---

## 🧩 Backend Service Architecture

### **Core Services to Implement**

#### **1. AuthService**
```typescript
class AuthService {
  async validateGoogleToken(code: string): Promise<User>
  async createUser(googleProfile: GoogleProfile): Promise<User>
  async generateJWT(user: User): Promise<string>
  async validateJWT(token: string): Promise<User>
}
```

#### **2. EmailParserService**
```typescript
class EmailParserService {
  async fetchEmailById(messageId: string): Promise<GmailMessage>
  async identifyEmailType(email: GmailMessage): 'TRANSACTION' | 'STATEMENT' | 'UNKNOWN'
  async parseTransaction(email: GmailMessage): Promise<ParsedTransaction>
  async parseStatement(email: GmailMessage): Promise<ParsedStatement>
  async extractCardDetails(email: GmailMessage): Promise<{ bank: string, last4: string }>
  async categorizeTransaction(merchantName: string): Promise<string>
}
```

#### **3. GmailSyncService**
```typescript
class GmailSyncService {
  async setupPubSub(userEmail: string): Promise<void>
  async fetchHistoricalEmails(userEmail: string, fromDate: Date): Promise<GmailMessage[]>
  async filterRelevantEmails(messages: GmailMessage[]): Promise<GmailMessage[]>
  async processEmailBatch(messages: GmailMessage[], userId: string): Promise<void>
}
```

#### **4. CardPerksService**
```typescript
class CardPerksService {
  async fetchCardPerks(bankName: string, cardType: string): Promise<CardPerk[]>
  async scrapePerksFromWebsite(bankUrl: string): Promise<CardPerk[]>
  async fetchPerksViaAI(bankName: string, cardType: string): Promise<CardPerk[]>
  async storePerks(cardId: string, perks: CardPerk[]): Promise<void>
}
```

#### **5. TransactionService**
```typescript
class TransactionService {
  async createTransaction(data: CreateTransactionDto): Promise<Transaction>
  async moveToStatement(cardId: string, statementId: string): Promise<void>
  async getCurrentTransactions(cardId: string): Promise<Transaction[]>
  async getStatementTransactions(statementId: string): Promise<Transaction[]>
  async updateCategory(transactionId: string, category: string): Promise<Transaction>
}
```

#### **6. SpendingLimitService**
```typescript
class SpendingLimitService {
  async checkLimits(userId: string, newTransaction: Transaction): Promise<boolean>
  async updateCurrentSpending(limitId: string, amount: number): Promise<void>
  async sendLimitExceededAlert(user: User, limit: SpendingLimit): Promise<void>
  async getSpendingSummary(userId: string): Promise<SpendingSummary>
}
```

#### **7. NotificationService**
```typescript
class NotificationService {
  async sendWebSocketNotification(userId: string, event: string, data: any): Promise<void>
  async sendEmailAlert(to: string, subject: string, body: string): Promise<void>
  async isUserOnline(userId: string): Promise<boolean>
}
```

---

## 🎯 Email Parsing Logic

### **Transaction Email Pattern Matching**

```typescript
interface EmailPattern {
  bank: string;
  senderRegex: RegExp[];
  subjectKeywords: string[];
  cardLast4Regex: RegExp;
  amountRegex: RegExp;
  merchantRegex: RegExp;
  dateRegex: RegExp;
  transactionTypeKeywords: {
    debit: string[];
    credit: string[];
    reversal: string[];
  };
}

const EMAIL_PATTERNS: EmailPattern[] = [
  {
    bank: 'SBI',
    senderRegex: [
      /sbicard\.com$/,
      /sbicardservices\.com$/
    ],
    subjectKeywords: ['transaction', 'alert', 'spent', 'purchase'],
    cardLast4Regex: /X{4,}(\d{4})/,
    amountRegex: /(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\s+on/i,
    dateRegex: /(\d{2}-\w{3}-\d{4}|\d{2}\/\d{2}\/\d{4})/,
    transactionTypeKeywords: {
      debit: ['debited', 'spent', 'purchase', 'paid'],
      credit: ['credited', 'cashback', 'refund', 'reward'],
      reversal: ['reversed', 'chargeback']
    }
  },
  {
    bank: 'HDFC',
    senderRegex: [
      /hdfcbank\.com$/,
      /alerts\.hdfcbank\.com$/
    ],
    subjectKeywords: ['transaction', 'alert', 'update'],
    cardLast4Regex: /xx(\d{4})/i,
    amountRegex: /INR\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)\./i,
    dateRegex: /on\s+(\d{2}-\w{3}-\d{2})/,
    transactionTypeKeys: {
      debit: ['debited'],
      credit: ['credited'],
      reversal: ['reversed']
    }
  },
  {
    bank: 'Axis',
    senderRegex: [
      /axisbank\.com$/,
      /alerts\.axisbank\.com$/
    ],
    subjectKeywords: ['transaction', 'alert'],
    cardLast4Regex: /\*\*(\d{4})/,
    amountRegex: /Rs\.?\s?([0-9,]+\.?\d{0,2})/,
    merchantRegex: /at\s+(.*?)(?:\s+on|\.|$)/i,
    dateRegex: /(\d{2}\/\d{2}\/\d{4})/,
    transactionTypeKeywords: {
      debit: ['debited'],
      credit: ['credited'],
      reversal: ['reversed']
    }
  }
  // Add more banks as needed
];
```

### **Statement Email Pattern Matching**

```typescript
interface StatementPattern {
  bank: string;
  senderRegex: RegExp[];
  subjectKeywords: string[];
  attachmentName: RegExp;
  dueDateRegex: RegExp;
  totalAmountRegex: RegExp;
  minimumAmountRegex: RegExp;
  billingCycleRegex: RegExp;
}

const STATEMENT_PATTERNS: StatementPattern[] = [
  {
    bank: 'SBI',
    senderRegex: [/statements\.sbicard\.com$/],
    subjectKeywords: ['statement', 'credit card statement'],
    attachmentName: /statement.*\.pdf$/i,
    dueDateRegex: /payment.*due.*?(\d{2}[/-]\w{3}[/-]\d{4})/i,
    totalAmountRegex: /total.*amount.*due.*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i,
    minimumAmountRegex: /minimum.*amount.*due.*?(?:INR|Rs\.?|₹)\s?([0-9,]+\.?\d{0,2})/i,
    billingCycleRegex: /(\d{2}[/-]\w{3}[/-]\d{4})\s*to\s*(\d{2}[/-]\w{3}[/-]\d{4})/i
  }
  // Add more banks
];
```

### **Parsing Workflow**

```typescript
async function parseEmail(email: GmailMessage): Promise<ParsedResult> {
  // 1. Identify bank from sender
  const pattern = EMAIL_PATTERNS.find(p => 
    p.senderRegex.some(regex => regex.test(email.from))
  );
  
  if (!pattern) {
    return { type: 'UNKNOWN' };
  }

  // 2. Check if transaction or statement
  const isStatement = STATEMENT_PATTERNS.some(sp => 
    sp.subjectKeywords.some(kw => email.subject.toLowerCase().includes(kw))
  );

  if (isStatement) {
    return parseStatementEmail(email, pattern);
  } else {
    return parseTransactionEmail(email, pattern);
  }
}

async function parseTransactionEmail(
  email: GmailMessage, 
  pattern: EmailPattern
): Promise<ParsedTransaction> {
  const body = email.body;
  
  // Extract card last 4
  const cardMatch = body.match(pattern.cardLast4Regex);
  const cardLast4 = cardMatch ? cardMatch[1] : null;
  
  // Extract amount
  const amountMatch = body.match(pattern.amountRegex);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  
  // Extract merchant
  const merchantMatch = body.match(pattern.merchantRegex);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown';
  
  // Extract date
  const dateMatch = body.match(pattern.dateRegex);
  const transactionDate = dateMatch ? new Date(dateMatch[1]) : new Date();
  
  // Determine transaction type
  let transactionType = 'DEBIT';
  for (const [type, keywords] of Object.entries(pattern.transactionTypeKeywords)) {
    if (keywords.some(kw => body.toLowerCase().includes(kw))) {
      transactionType = type.toUpperCase();
      break;
    }
  }
  
  // Auto-categorize
  const category = await categorizeTransaction(merchant);
  
  return {
    cardLast4,
    amount,
    merchant,
    transactionDate,
    transactionType,
    category,
    emailMetadata: {
      messageId: email.id,
      sender: email.from,
      subject: email.subject,
      receivedAt: email.date
    }
  };
}
```

---

## 🔄 Background Workers

### **Worker 1: Initial Email Sync**

```typescript
@Process('initial-sync')
async handleInitialSync(job: Job<{ userId: string, email: string }>) {
  const { userId, email } = job.data;
  
  try {
    // Update progress
    await job.progress(10);
    await this.notificationService.updateProgress(userId, 'process1', 10, 'Connecting to Gmail...');
    
    // Fetch emails from last 2 years
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const messages = await this.gmailService.fetchHistoricalEmails(email, twoYearsAgo);
    await job.progress(30);
    await this.notificationService.updateProgress(userId, 'process1', 30, `Found ${messages.length} emails`);
    
    // Filter transaction/statement emails
    const relevantEmails = await this.gmailService.filterRelevantEmails(messages);
    await job.progress(50);
    await this.notificationService.updateProgress(userId, 'process1', 50, `Parsing ${relevantEmails.length} card emails`);
    
    // Parse and store
    const cards = new Map<string, string>(); // last4 -> cardId
    let transactionCount = 0;
    
    for (let i = 0; i < relevantEmails.length; i++) {
      const parsed = await this.emailParserService.parseEmail(relevantEmails[i]);
      
      if (parsed.type === 'TRANSACTION') {
        // Find or create card
        let cardId = cards.get(parsed.cardLast4);
        if (!cardId) {
          const card = await this.cardsService.findOrCreate(userId, parsed);
          cardId = card.id;
          cards.set(parsed.cardLast4, cardId);
        }
        
        // Store transaction
        await this.transactionsService.create({
          cardId,
          ...parsed
        });
        
        transactionCount++;
      } else if (parsed.type === 'STATEMENT') {
        // Similar logic for statements
      }
      
      // Update progress
      const progress = 50 + Math.floor((i / relevantEmails.length) * 40);
      await job.progress(progress);
    }
    
    await job.progress(100);
    await this.notificationService.updateProgress(
      userId, 
      'process1', 
      100, 
      `Found ${cards.size} cards, ${transactionCount} transactions`
    );
    
    // Trigger Process 3 for each card
    for (const cardId of cards.values()) {
      await this.perksQueue.add('fetch-perks', { cardId });
    }
    
    return { success: true, cards: cards.size, transactions: transactionCount };
    
  } catch (error) {
    await this.notificationService.updateProgress(userId, 'process1', -1, 'Error occurred');
    throw error;
  }
}
```

### **Worker 2: Real-time Email Processor**

```typescript
@Process('process-email')
async handleNewEmail(job: Job<{ messageId: string, userId: string }>) {
  const { messageId, userId } = job.data;
  
  // Fetch email
  const email = await this.gmailService.fetchEmailById(messageId);
  
  // Parse
  const parsed = await this.emailParserService.parseEmail(email);
  
  if (parsed.type === 'TRANSACTION') {
    // Find or create card
    const card = await this.cardsService.findOrCreate(userId, parsed);
    
    // Store transaction
    const transaction = await this.transactionsService.create({
      cardId: card.id,
      ...parsed
    });
    
    // Check spending limits
    const limitExceeded = await this.spendingLimitService.checkLimits(userId, transaction);
    
    if (limitExceeded) {
      const user = await this.usersService.findById(userId);
      await this.notificationService.sendEmailAlert(
        user.email,
        'Spending Limit Exceeded',
        `You've exceeded your spending limit. Current spending: ₹${limitExceeded.currentSpending}`
      );
    }
    
    // Send WebSocket notification if user is online
    const isOnline = await this.notificationService.isUserOnline(userId);
    if (isOnline) {
      await this.notificationService.sendWebSocketNotification(userId, 'transaction:new', {
        transaction,
        card
      });
    }
    
  } else if (parsed.type === 'STATEMENT') {
    // Find card
    const card = await this.cardsService.findByLast4(userId, parsed.cardLast4);
    
    // Create statement
    const statement = await this.statementsService.create({
      cardId: card.id,
      ...parsed
    });
    
    // Move current transactions to statement
    await this.transactionsService.moveToStatement(card.id, statement.id);
    
    // Notify user if online
    const isOnline = await this.notificationService.isUserOnline(userId);
    if (isOnline) {
      await this.notificationService.sendWebSocketNotification(userId, 'statement:generated', {
        statement,
        card
      });
    }
  }
  
  return { success: true };
}
```

### **Worker 3: Card Perks Scraper**

```typescript
@Process('fetch-perks')
async handleFetchPerks(job: Job<{ cardId: string }>) {
  const { cardId } = job.data;
  
  const card = await this.cardsService.findById(cardId);
  
  try {
    // Try web scraping first
    const perks = await this.scrapingService.scrapePerks(card.bank, card.cardType);
    await this.perksService.storePerks(cardId, perks);
    return { success: true, method: 'scraping' };
    
  } catch (scrapingError) {
    // Fallback to AI
    try {
      const perks = await this.aiService.fetchPerks(card.bank, card.cardType);
      await this.perksService.storePerks(cardId, perks);
      return { success: true, method: 'ai' };
      
    } catch (aiError) {
      throw new Error('Failed to fetch perks');
    }
  }
}
```

---

## 🎨 Frontend Component Structure

```typescript
// Component Hierarchy
App
├── AuthProvider
├── WebSocketProvider
└── Router
    ├── LoginPage
    ├── LoadingPage (First-time users)
    └── DashboardLayout
        ├── Header
        │   ├── Logo
        │   ├── NotificationBell (WebSocket updates)
        │   ├── SettingsDropdown
        │   └── UserProfile
        ├── SpendingSummary
        │   ├── TotalDueCard
        │   ├── GlobalLimitProgress
        │   └── CategoryBreakdown
        ├── CardsList
        │   └── BankGroup[]
        │       └── CreditCard[]
        │           ├── CardFace (Glassmorphism)
        │           ├── DueAmount
        │           └── PayNowButton
        └── CardDetailPage
            ├── CardHeader
            ├── PerksSection (Collapsible)
            ├── TransactionsSection
            │   ├── StatementBanner
            │   └── TransactionList
            │       └── TransactionItem[]
            └── FeesSection (Collapsible)
```

### **Key Frontend Components**

#### **1. CreditCard Component**

```typescript
interface CreditCardProps {
  card: Card;
  onClick: () => void;
}

export const CreditCard: React.FC<CreditCardProps> = ({ card, onClick }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          🚀 Setting Up Your Dashboard
        </h1>
        
        <div className="space-y-6">
          {Object.entries(progress).map(([key, status], index) => (
            <ProcessItem
              key={key}
              number={index + 1}
              progress={status.progress}
              message={status.message}
              isComplete={status.progress === 100}
            />
          ))}
        </div>
        
        <p className="text-gray-400 text-center mt-8">
          This may take 2-3 minutes...
        </p>
      </motion.div>
    </div>
  );
};

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
          <CheckCircle className="w-6 h-6 text-green-400" />
        ) : (
          <Loader className="w-6 h-6 text-blue-400 animate-spin" />
        )}
        <span className="text-white font-medium">Process {number}</span>
      </div>
      
      <div className="mb-2">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
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

---

## 🗄️ Database Migrations

### **Migration 1: Create Users Table**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  profile_picture_url TEXT,
  global_spending_limit DECIMAL(12, 2) DEFAULT 50000.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);
```

### **Migration 2: Create Credit Cards Table**

```sql
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  card_last_4_digits VARCHAR(4) NOT NULL,
  card_holder_name VARCHAR(255),
  card_type VARCHAR(50), -- VISA, MASTERCARD, RUPAY, AMEX
  statement_generation_day INT, -- 1-31
  sender_email_pattern TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_card UNIQUE(user_id, card_last_4_digits)
);

CREATE INDEX idx_cards_user_id ON credit_cards(user_id);
CREATE INDEX idx_cards_last_4 ON credit_cards(card_last_4_digits);
```

### **Migration 3: Create Current Transactions Table**

```sql
CREATE TABLE current_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  transaction_date TIMESTAMP NOT NULL,
  merchant_name VARCHAR(255),
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(100), -- auto-categorized
  category_manual VARCHAR(100), -- user override
  description TEXT,
  transaction_type VARCHAR(20) DEFAULT 'DEBIT', -- DEBIT, CREDIT, REVERSAL
  email_metadata_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_current_trans_card_id ON current_transactions(card_id);
CREATE INDEX idx_current_trans_date ON current_transactions(transaction_date DESC);
CREATE INDEX idx_current_trans_category ON current_transactions(category);
```

### **Migration 4: Create Statements Table**

```sql
CREATE TABLE statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_month INT NOT NULL, -- 1-12
  statement_year INT NOT NULL,
  billing_cycle_start DATE NOT NULL,
  billing_cycle_end DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount_due DECIMAL(12, 2) NOT NULL,
  minimum_amount_due DECIMAL(12, 2),
  total_transactions INT DEFAULT 0,
  statement_pdf_url TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_card_statement UNIQUE(card_id, statement_month, statement_year)
);

CREATE INDEX idx_statements_card_id ON statements(card_id);
CREATE INDEX idx_statements_due_date ON statements(due_date);
CREATE INDEX idx_statements_is_paid ON statements(is_paid);
```

### **Migration 5: Create Statement Transactions Table**

```sql
CREATE TABLE statement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  transaction_date TIMESTAMP NOT NULL,
  merchant_name VARCHAR(255),
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  transaction_type VARCHAR(20) DEFAULT 'DEBIT',
  email_metadata_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_statement_trans_card_id ON statement_transactions(card_id);
CREATE INDEX idx_statement_trans_statement_id ON statement_transactions(statement_id);
CREATE INDEX idx_statement_trans_date ON statement_transactions(transaction_date DESC);
```

### **Migration 6: Create Card Perks Table**

```sql
CREATE TABLE card_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  perk_type VARCHAR(50), -- CASHBACK, REWARD_POINTS, LOUNGE_ACCESS, etc.
  perk_description TEXT NOT NULL,
  perk_value VARCHAR(100), -- e.g., "5%", "2 per quarter"
  perk_category VARCHAR(100), -- dining, travel, fuel, etc.
  validity_start DATE,
  validity_end DATE,
  terms_and_conditions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_perks_card_id ON card_perks(card_id);
CREATE INDEX idx_perks_type ON card_perks(perk_type);
```

### **Migration 7: Create Spending Limits Table**

```sql
CREATE TABLE spending_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  limit_type VARCHAR(20) NOT NULL, -- GLOBAL, CATEGORY
  category_name VARCHAR(100), -- nullable, only for CATEGORY type
  limit_amount DECIMAL(12, 2) NOT NULL,
  current_spending DECIMAL(12, 2) DEFAULT 0.00,
  alert_threshold_percent INT DEFAULT 90, -- Alert when 90% of limit reached
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_limits_user_id ON spending_limits(user_id);
CREATE INDEX idx_limits_type ON spending_limits(limit_type);
CREATE INDEX idx_limits_active ON spending_limits(is_active);
```

### **Migration 8: Create Email Patterns Table**

```sql
CREATE TABLE email_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(100) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  subject_keywords TEXT[], -- Array of keywords
  transaction_regex TEXT,
  statement_regex TEXT,
  card_last_4_regex TEXT,
  amount_regex TEXT,
  date_regex TEXT,
  merchant_regex TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_patterns_bank ON email_patterns(bank_name);
CREATE INDEX idx_email_patterns_sender ON email_patterns(sender_email);
```

---

## 🔐 Authentication Flow

### **Google OAuth2 Setup**

```typescript
// backend/src/auth/google.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails, displayName, photos } = profile;
    
    const user = {
      googleId: id,
      email: emails[0].value,
      fullName: displayName,
      profilePicture: photos[0].value,
      accessToken,
      refreshToken,
    };
    
    done(null, user);
  }
}
```

### **JWT Strategy**

```typescript
// backend/src/auth/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
```

---

## 🎯 Category Auto-Classification

### **Merchant Category Mapping**

```typescript
const MERCHANT_CATEGORIES: Record<string, string[]> = {
  'Food & Dining': [
    'swiggy', 'zomato', 'dominos', 'pizza', 'restaurant', 'cafe',
    'mcdonald', 'kfc', 'subway', 'starbucks', 'burger', 'food'
  ],
  'Travel': [
    'uber', 'ola', 'rapido', 'airline', 'irctc', 'makemytrip',
    'goibibo', 'booking', 'hotel', 'flight', 'train', 'bus'
  ],
  'Shopping': [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho',
    'mall', 'store', 'retail', 'fashion', 'clothing'
  ],
  'Bills & Utilities': [
    'electricity', 'water', 'gas', 'airtel', 'jio', 'vi', 'vodafone',
    'broadband', 'wifi', 'recharge', 'mobile', 'utility'
  ],
  'Entertainment': [
    'netflix', 'amazon prime', 'disney', 'hotstar', 'spotify',
    'youtube', 'movie', 'theatre', 'pvr', 'inox', 'gaming'
  ],
  'Fuel': [
    'petrol', 'diesel', 'fuel', 'hp', 'bharat petroleum', 'indian oil',
    'shell', 'cng', 'gas station'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'pharmacy', 'medicine',
    'apollo', 'medplus', 'netmeds', 'health'
  ],
  'Education': [
    'school', 'college', 'university', 'course', 'tuition',
    'udemy', 'coursera', 'unacademy', 'byjus'
  ],
  'Insurance': [
    'insurance', 'lic', 'policy', 'premium', 'hdfc life',
    'icici prudential', 'max life'
  ],
  'EMI': [
    'emi', 'loan', 'installment', 'principal', 'interest'
  ],
  'Investments': [
    'mutual fund', 'sip', 'zerodha', 'groww', 'upstox',
    'investment', 'trading', 'stock'
  ],
  'Miscellaneous': []
};

export function categorizeTransaction(merchantName: string): string {
  const merchant = merchantName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(MERCHANT_CATEGORIES)) {
    if (keywords.some(keyword => merchant.includes(keyword))) {
      return category;
    }
  }
  
  return 'Miscellaneous';
}
```

---

## 🚀 Deployment Architecture (Google Cloud)

### **Cloud Run Setup**

```yaml
# cloud-run-config.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: credit-card-backend
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: '1'
        autoscaling.knative.dev/maxScale: '10'
    spec:
      containers:
      - image: gcr.io/YOUR_PROJECT/credit-card-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: GOOGLE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: google-oauth
              key: client-id
        - name: GOOGLE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: google-oauth
              key: client-secret
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          limits:
            memory: 2Gi
            cpu: '2'
```

### **Pub/Sub Topic Setup**

```bash
# Create Pub/Sub topic for Gmail notifications
gcloud pubsub topics create gmail-notifications

# Create subscription
gcloud pubsub subscriptions create gmail-push-subscription \
  --topic=gmail-notifications \
  --push-endpoint=https://YOUR_BACKEND_URL/api/gmail/push \
  --ack-deadline=60
```

### **Cloud SQL Instance**

```bash
# Create PostgreSQL instance
gcloud sql instances create credit-card-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=asia-south1 \
  --root-password=YOUR_PASSWORD

# Create database
gcloud sql databases create credit_cards \
  --instance=credit-card-db
```

### **Environment Variables**

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@/credit_cards?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=7d

# Gmail API
GMAIL_PUBSUB_TOPIC=gmail-notifications
GMAIL_PUBSUB_SUBSCRIPTION=gmail-push-subscription

# Frontend URL
FRONTEND_URL=https://your-frontend-domain.com

# Redis (for Bull Queue)
REDIS_URL=redis://your-redis-instance:6379

# Google Cloud Storage (for statement PDFs)
GCS_BUCKET_NAME=credit-card-statements
```

---

## 🧪 Testing Strategy

### **Unit Tests**

```typescript
// email-parser.service.spec.ts
describe('EmailParserService', () => {
  let service: EmailParserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EmailParserService],
    }).compile();

    service = module.get<EmailParserService>(EmailParserService);
  });

  describe('parseTransaction', () => {
    it('should extract transaction from SBI email', async () => {
      const mockEmail = {
        from: 'alerts@sbicard.com',
        subject: 'Transaction Alert',
        body: `
          Your SBI Card XXXX7603 has been used for a transaction of INR 1,250.00
          at SWIGGY BANGALORE on 17-Oct-2024.
        `,
      };

      const result = await service.parseTransaction(mockEmail);

      expect(result).toMatchObject({
        cardLast4: '7603',
        amount: 1250.00,
        merchant: 'SWIGGY BANGALORE',
        category: 'Food & Dining',
        transactionType: 'DEBIT',
      });
    });

    it('should handle cashback transactions', async () => {
      const mockEmail = {
        from: 'alerts@sbicard.com',
        subject: 'Cashback Credit',
        body: `
          Your SBI Card XXXX7603 has been credited with cashback of INR 250.00
          on 08-Oct-2024.
        `,
      };

      const result = await service.parseTransaction(mockEmail);

      expect(result.transactionType).toBe('CREDIT');
      expect(result.category).toBe('cashback');
    });
  });
});
```

### **Integration Tests**

```typescript
// transactions.controller.spec.ts
describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test user and get JWT
    const response = await request(app.getHttpServer())
      .post('/api/auth/test-login')
      .send({ email: 'test@example.com' });
    
    authToken = response.body.access_token;
  });

  it('/api/transactions/current (GET)', async () => {
    return request(app.getHttpServer())
      .get('/api/transactions/current')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('transactions');
        expect(res.body).toHaveProperty('total');
        expect(Array.isArray(res.body.transactions)).toBe(true);
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## 📱 Responsive Design Breakpoints

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      screens: {
        'mobile': '320px',
        'tablet': '768px',
        'laptop': '1024px',
        'macbook-14': '1512px', // Primary focus
        'desktop': '1920px',
      },
      colors: {
        'cred-dark': '#0F0F0F',
        'cred-purple': '#9B6BFF',
        'cred-pink': '#FF6B9D',
      },
    },
  },
};
```

### **Responsive Card Grid**

```tsx
<div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 macbook-14:grid-cols-3 gap-6">
  {cards.map(card => (
    <CreditCard key={card.id} card={card} />
  ))}
</div>
```

---

## 🎨 Design System

### **Color Palette**

```scss
// Dark theme (primary)
$bg-primary: #0F0F0F;
$bg-secondary: #1A1A1A;
$bg-tertiary: #2A2A2A;

// Accent colors
$accent-purple: #9B6BFF;
$accent-pink: #FF6B9D;
$accent-blue: #4D9BFF;
$accent-green: #00D9A3;

// Text
$text-primary: #FFFFFF;
$text-secondary: #B0B0B0;
$text-tertiary: #707070;

// Status
$success: #00D9A3;
$error: #FF4D4D;
$warning: #FFB84D;
$info: #4D9BFF;
```

### **Typography**

```css
/* Font family */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Headings */
h1 { font-size: 2.5rem; font-weight: 700; line-height: 1.2; }
h2 { font-size: 2rem; font-weight: 600; line-height: 1.3; }
h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.4; }

/* Body text */
p { font-size: 1rem; line-height: 1.6; }
.text-small { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
```

### **Animation Presets**

```typescript
// framer-motion variants
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const cardHover = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

export const glassmorphism = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};
```

---

## 🔒 Security Best Practices

### **1. Input Validation**

```typescript
// DTOs with class-validator
import { IsEmail, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class CreateSpendingLimitDto {
  @IsNotEmpty()
  @IsIn(['GLOBAL', 'CATEGORY'])
  limit_type: string;

  @IsOptional()
  @IsString()
  category_name?: string;

  @IsNumber()
  @Min(1000)
  @Max(10000000)
  limit_amount: number;

  @IsNumber()
  @Min(50)
  @Max(100)
  alert_threshold_percent: number;
}
```

### **2. SQL Injection Prevention**

```typescript
// Always use parameterized queries with TypeORM
async findTransactionsByCard(cardId: string): Promise<Transaction[]> {
  return this.transactionRepository.find({
    where: { card: { id: cardId } },
    order: { transaction_date: 'DESC' },
  });
}

// NEVER do this:
// await this.db.query(`SELECT * FROM transactions WHERE card_id = '${cardId}'`);
```

### **3. Rate Limiting**

```typescript
// Apply rate limiting to API endpoints
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('api/transactions')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class TransactionsController {
  // Max 100 requests per minute
}
```

### **4. Gmail API Token Security**

```typescript
// Store refresh tokens encrypted
import { createCipher, createDecipher } from 'crypto';

function encryptToken(token: string): string {
  const cipher = createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptToken(encrypted: string): string {
  const decipher = createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

---

## 📊 Monitoring & Logging

### **Structured Logging**

```typescript
import { Logger } from '@nestjs/common';

export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  async parseEmail(email: GmailMessage) {
    this.logger.log(`Parsing email: ${email.id}`);
    
    try {
      const result = await this.parse(email);
      
      this.logger.log({
        message: 'Email parsed successfully',
        emailId: email.id,
        type: result.type,
        cardLast4: result.cardLast4,
      });
      
      return result;
    } catch (error) {
      this.logger.error({
        message: 'Failed to parse email',
        emailId: email.id,
        error: error.message,
        stack: error.stack,
      });
      
      throw error;
    }
  }
}
```

### **Performance Monitoring**

```typescript
// Add timing interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        console.log(`${method} ${url} - ${responseTime}ms`);
      }),
    );
  }
}
```

---

## 🎯 Error Handling

### **Custom Exception Filters**

```typescript
// backend/src/common/filters/http-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any).message;
      details = typeof exceptionResponse === 'object' ? exceptionResponse : null;
    } else if (exception instanceof Error) {
      message = exception.message;
      details = { stack: exception.stack };
    }

    // Log error
    console.error({
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      message,
      details,
    });

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(process.env.NODE_ENV === 'development' && { details }),
    });
  }
}
```

### **Retry Logic for Gmail API**

```typescript
// backend/src/gmail/gmail.service.ts
import { retry } from 'rxjs/operators';
import { from } from 'rxjs';

export class GmailService {
  async fetchEmailWithRetry(messageId: string, maxRetries = 3): Promise<GmailMessage> {
    let attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        return await this.gmailApi.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });
      } catch (error) {
        attempts++;
        
        if (attempts >= maxRetries) {
          this.logger.error(`Failed to fetch email ${messageId} after ${maxRetries} attempts`);
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempts) * 1000;
        this.logger.warn(`Retrying fetch for ${messageId} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
```

### **Frontend Error Boundary**

```typescript
// frontend/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-red-400 mb-4">
              Something went wrong
            </h2>
            <p className="text-gray-300 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 🔄 Data Sync & Consistency

### **Transaction to Statement Migration**

```typescript
// backend/src/statements/statements.service.ts
export class StatementsService {
  async processNewStatement(
    cardId: string,
    statementData: CreateStatementDto
  ): Promise<Statement> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create statement record
      const statement = await queryRunner.manager.save(Statement, {
        card_id: cardId,
        ...statementData,
      });

      // 2. Get all current transactions within billing cycle
      const transactions = await queryRunner.manager.find(CurrentTransaction, {
        where: {
          card_id: cardId,
          transaction_date: Between(
            statementData.billing_cycle_start,
            statementData.billing_cycle_end
          ),
        },
      });

      // 3. Move to statement_transactions
      for (const transaction of transactions) {
        await queryRunner.manager.save(StatementTransaction, {
          ...transaction,
          statement_id: statement.id,
        });
      }

      // 4. Delete from current_transactions
      await queryRunner.manager.delete(CurrentTransaction, {
        card_id: cardId,
        transaction_date: Between(
          statementData.billing_cycle_start,
          statementData.billing_cycle_end
        ),
      });

      // 5. Reset current spending for this card's categories
      await this.spendingLimitService.resetCardSpending(cardId);

      await queryRunner.commitTransaction();
      
      this.logger.log(`Statement ${statement.id} processed, moved ${transactions.length} transactions`);
      
      return statement;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to process statement', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

### **Spending Limit Calculation**

```typescript
// backend/src/spending-limits/spending-limits.service.ts
export class SpendingLimitsService {
  async checkAndUpdateLimits(
    userId: string,
    transaction: Transaction
  ): Promise<{ exceeded: boolean; limits: SpendingLimit[] }> {
    const limits = await this.repository.find({
      where: {
        user_id: userId,
        is_active: true,
      },
    });

    const exceededLimits: SpendingLimit[] = [];

    for (const limit of limits) {
      // Skip if not applicable
      if (limit.limit_type === 'CATEGORY' && limit.category_name !== transaction.category) {
        continue;
      }

      // Update current spending
      limit.current_spending += transaction.amount;
      await this.repository.save(limit);

      // Check if exceeded
      const percentUsed = (limit.current_spending / limit.limit_amount) * 100;
      
      if (percentUsed >= limit.alert_threshold_percent) {
        exceededLimits.push(limit);
        
        // Send alert
        const user = await this.usersService.findById(userId);
        await this.sendLimitAlert(user, limit, transaction);
      }
    }

    return {
      exceeded: exceededLimits.length > 0,
      limits: exceededLimits,
    };
  }

  private async sendLimitAlert(
    user: User,
    limit: SpendingLimit,
    transaction: Transaction
  ): Promise<void> {
    const percentUsed = Math.round((limit.current_spending / limit.limit_amount) * 100);
    
    const emailBody = `
      <h2>Spending Limit Alert</h2>
      <p>Hi ${user.full_name},</p>
      <p>You have used ${percentUsed}% of your ${limit.limit_type === 'GLOBAL' ? 'total' : limit.category_name} spending limit.</p>
      <ul>
        <li><strong>Current Spending:</strong> ₹${limit.current_spending.toLocaleString()}</li>
        <li><strong>Limit:</strong> ₹${limit.limit_amount.toLocaleString()}</li>
        <li><strong>Latest Transaction:</strong> ₹${transaction.amount} at ${transaction.merchant_name}</li>
      </ul>
      <p>Please review your credit card spending to stay within your budget.</p>
    `;

    await this.gmailService.sendEmail({
      to: user.email,
      subject: `⚠️ Spending Limit Alert - ${percentUsed}% Used`,
      html: emailBody,
    });
  }
}
```

---

## 📈 Analytics & Insights

### **Spending Analytics API**

```typescript
// backend/src/analytics/analytics.controller.ts
@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  
  @Get('spending-trends')
  async getSpendingTrends(
    @Request() req,
    @Query('period') period: 'week' | 'month' | 'year' = 'month'
  ) {
    const userId = req.user.userId;
    return this.analyticsService.getSpendingTrends(userId, period);
  }

  @Get('category-breakdown')
  async getCategoryBreakdown(@Request() req) {
    const userId = req.user.userId;
    return this.analyticsService.getCategoryBreakdown(userId);
  }

  @Get('card-usage-stats')
  async getCardUsageStats(@Request() req) {
    const userId = req.user.userId;
    return this.analyticsService.getCardUsageStats(userId);
  }

  @Get('merchant-analysis')
  async getMerchantAnalysis(
    @Request() req,
    @Query('limit') limit: number = 10
  ) {
    const userId = req.user.userId;
    return this.analyticsService.getTopMerchants(userId, limit);
  }
}
```

### **Spending Trends Service**

```typescript
// backend/src/analytics/analytics.service.ts
export class AnalyticsService {
  async getSpendingTrends(
    userId: string,
    period: 'week' | 'month' | 'year'
  ): Promise<SpendingTrend[]> {
    const cards = await this.cardsService.findByUser(userId);
    const cardIds = cards.map(c => c.id);

    const dateFormat = {
      week: 'YYYY-MM-DD',
      month: 'YYYY-MM',
      year: 'YYYY',
    }[period];

    const query = this.transactionRepository
      .createQueryBuilder('t')
      .select(`TO_CHAR(t.transaction_date, '${dateFormat}')`, 'period')
      .addSelect('SUM(t.amount)', 'total_spending')
      .addSelect('COUNT(t.id)', 'transaction_count')
      .where('t.card_id IN (:...cardIds)', { cardIds })
      .andWhere('t.transaction_type = :type', { type: 'DEBIT' })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .limit(period === 'week' ? 7 : period === 'month' ? 12 : 5);

    const results = await query.getRawMany();

    return results.map(r => ({
      period: r.period,
      totalSpending: parseFloat(r.total_spending),
      transactionCount: parseInt(r.transaction_count),
    }));
  }

  async getCategoryBreakdown(userId: string): Promise<CategoryBreakdown[]> {
    const cards = await this.cardsService.findByUser(userId);
    const cardIds = cards.map(c => c.id);

    const results = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.category', 'category')
      .addSelect('SUM(t.amount)', 'total_amount')
      .addSelect('COUNT(t.id)', 'transaction_count')
      .addSelect('AVG(t.amount)', 'average_amount')
      .where('t.card_id IN (:...cardIds)', { cardIds })
      .andWhere('t.transaction_type = :type', { type: 'DEBIT' })
      .groupBy('t.category')
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    const total = results.reduce((sum, r) => sum + parseFloat(r.total_amount), 0);

    return results.map(r => ({
      category: r.category,
      totalAmount: parseFloat(r.total_amount),
      transactionCount: parseInt(r.transaction_count),
      averageAmount: parseFloat(r.average_amount),
      percentage: (parseFloat(r.total_amount) / total) * 100,
    }));
  }
}
```

---

## 🎨 Advanced UI Components

### **Animated Spending Progress Bar**

```typescript
// frontend/src/components/SpendingProgress.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface SpendingProgressProps {
  current: number;
  limit: number;
  category?: string;
}

export const SpendingProgress: React.FC<SpendingProgressProps> = ({
  current,
  limit,
  category = 'Total',
}) => {
  const percentage = Math.min((current / limit) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isOverLimit = percentage >= 100;

  const getColor = () => {
    if (isOverLimit) return 'from-red-500 to-red-600';
    if (isNearLimit) return 'from-yellow-500 to-orange-500';
    return 'from-blue-500 to-purple-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-300">{category}</span>
        <span className={`font-medium ${isOverLimit ? 'text-red-400' : 'text-white'}`}>
          ₹{current.toLocaleString()} / ₹{limit.toLocaleString()}
        </span>
      </div>

      <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${getColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        
        {/* Animated shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {isNearLimit && !isOverLimit && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-yellow-400"
        >
          ⚠️ Approaching limit
        </motion.p>
      )}

      {isOverLimit && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400"
        >
          🚨 Limit exceeded
        </motion.p>
      )}
    </div>
  );
};
```

### **Transaction Timeline**

```typescript
// frontend/src/components/TransactionTimeline.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, CreditCard } from 'lucide-react';

interface Transaction {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  category: string;
  cardLast4: string;
}

interface TransactionTimelineProps {
  transactions: Transaction[];
}

export const TransactionTimeline: React.FC<TransactionTimelineProps> = ({ transactions }) => {
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
            <div className="absolute left-[23px] top-12 bottom-0 w-px bg-gradient-to-b from-purple-500/50 to-transparent" />
          )}

          {/* Icon */}
          <div className="relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl z-10 group-hover:scale-110 transition-transform">
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
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    •• {transaction.cardLast4}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xl font-bold text-white">
                  ₹{transaction.amount.toLocaleString()}
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

### **Card Perks Showcase**

```typescript
// frontend/src/components/CardPerks.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Gift, Percent, Star } from 'lucide-react';

interface Perk {
  id: string;
  type: string;
  description: string;
  value: string;
  category?: string;
}

interface CardPerksProps {
  perks: Perk[];
}

export const CardPerks: React.FC<CardPerksProps> = ({ perks }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPerkIcon = (type: string) => {
    switch (type) {
      case 'CASHBACK':
        return <Percent className="w-5 h-5" />;
      case 'REWARD_POINTS':
        return <Star className="w-5 h-5" />;
      default:
        return <Gift className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
      >
        <h3 className="text-lg font-semibold text-white">Card Perks & Benefits</h3>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4">
              {perks.map((perk, index) => (
                <motion.div
                  key={perk.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                    {getPerkIcon(perk.type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-white">{perk.description}</h4>
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                        {perk.value}
                      </span>
                    </div>
                    
                    {perk.category && (
                      <p className="text-sm text-gray-400">
                        Category: {perk.category}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

---

## 🚀 Performance Optimization

### **Database Indexing Strategy**

```sql
-- Optimize frequent queries
CREATE INDEX CONCURRENTLY idx_transactions_card_date 
ON current_transactions(card_id, transaction_date DESC);

CREATE INDEX CONCURRENTLY idx_transactions_category_amount 
ON current_transactions(category, amount DESC);

CREATE INDEX CONCURRENTLY idx_statements_card_due 
ON statements(card_id, due_date);

-- Full-text search for merchant names
CREATE INDEX idx_transactions_merchant_search 
ON current_transactions USING GIN(to_tsvector('english', merchant_name));

-- Partial index for active limits
CREATE INDEX idx_active_limits 
ON spending_limits(user_id) 
WHERE is_active = true;
```

### **API Response Caching**

```typescript
// backend/src/common/decorators/cache.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache';
export const CacheTTL = (ttl: number) => SetMetadata(CACHE_KEY, ttl);

// Usage
@Get('cards')
@CacheTTL(300) // 5 minutes
async getCards(@Request() req) {
  return this.cardsService.findByUser(req.user.userId);
}
```

### **Frontend Data Fetching**

```typescript
// frontend/src/hooks/useCards.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const useCards = () => {
  return useQuery({
    queryKey: ['cards'],
    queryFn: async () => {
      const response = await api.get('/api/cards');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCardTransactions = (cardId: string) => {
  return useQuery({
    queryKey: ['transactions', cardId],
    queryFn: async () => {
      const response = await api.get(`/api/transactions/current?cardId=${cardId}`);
      return response.data;
    },
    enabled: !!cardId,
  });
};
```

---

## 📦 Deployment Checklist

### **Pre-Deployment**

- [ ] All environment variables configured in Cloud Run
- [ ] Cloud SQL instance created and migrations run
- [ ] Gmail API credentials set up and Pub/Sub configured
- [ ] Redis instance for Bull Queue deployed
- [ ] Cloud Storage bucket created for statement PDFs
- [ ] SSL certificates configured
- [ ] Domain DNS records pointing to Cloud Run
- [ ] Monitoring and logging enabled
- [ ] Error tracking (Sentry) integrated
- [ ] Rate limiting configured
- [ ] CORS policies set

### **Deployment Commands**

```bash
# Build Docker image
docker build -t gcr.io/YOUR_PROJECT/credit-card-backend:latest .

# Push to Google Container Registry
docker push gcr.io/YOUR_PROJECT/credit-card-backend:latest

# Deploy to Cloud Run
gcloud run deploy credit-card-backend \
  --image gcr.io/YOUR_PROJECT/credit-card-backend:latest \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --add-cloudsql-instances YOUR_PROJECT:asia-south1:credit-card-db \
  --set-env-vars DATABASE_URL="..." \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10

# Deploy frontend to Cloud Storage + Cloud CDN
cd frontend
npm run build
gsutil -m rsync -r build gs://your-frontend-bucket
```

---

## 🎓 Development Guidelines

### **Code Style**

```typescript
// Use TypeScript strict mode
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}

// Naming conventions
// - PascalCase for classes, interfaces, types
// - camelCase for variables, functions
// - UPPER_SNAKE_CASE for constants
// - kebab-case for file names

// Example
interface UserProfile {
  userId: string;
  fullName: string;
}

const API_BASE_URL = 'https://api.example.com';

function calculateTotalSpending(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}
```

### **Git Workflow**

```bash
# Branch naming
feature/add-transaction-filtering
fix/email-parsing-bug
refactor/card-service
docs/update-readme

# Commit messages
git commit -m "feat: add category-based spending limits"
git commit -m "fix: resolve duplicate transaction issue"
git commit -m "refactor: optimize database queries"
git commit -m "docs: add API endpoint documentation"
```

### **Testing Commands**

```bash
# Backend
cd backend
npm run test              # Unit tests
npm run test:e2e          # Integration tests
npm run test:cov          # Coverage report

# Frontend
cd frontend
npm run test              # Jest tests
npm run test:watch        # Watch mode
npm run cypress:open      # E2E tests
```

---

## 📚 API Documentation Sample

### **GET /api/cards**

Retrieve all credit cards for the authenticated user, grouped by bank.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "cards": [
    {
      "id": "uuid",
      "bank_name": "SBI",
      "card_last_4_digits": "7603",
      "card_holder_name": "ADITYA RAWAL",
      "card_type": "VISA",
      "statement_generation_day": 9,
      "current_due": 12489.00,
      "due_date": "2024-10-29",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "grouped_by_bank": {
    "SBI": [{ /* card object */ }],
    "HDFC": [{ /* card object */ }],
    "Axis": [{ /* card object */ }]
  }
}
```

### **POST /api/spending-limits**

Create a new spending limit.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "limit_type": "CATEGORY",
  "category_name": "Food & Dining",
  "limit_amount": 10000,
  "alert_threshold_percent": 90
}
```

**Response:**
```json
{
  "id": "uuid",
  "limit_type": "CATEGORY",
  "category_name": "Food & Dining",
  "limit_amount": 10000,
  "current_spending": 0,
  "alert_threshold_percent": 90,
  "is_active": true,
  "created_at": "2024-10-18T12:00:00Z"
}
```

---

## 🎯 FINAL IMPLEMENTATION INSTRUCTIONS FOR COPILOT

### **Phase 1: Setup & Authentication (Week 1)**

1. **Initialize Projects**
   - Create NestJS backend with TypeORM
   - Create React frontend with TypeScript + Tailwind
   - Set up Google Cloud project
   - Configure Cloud SQL PostgreSQL instance

2. **Implement Authentication**
   - Google OAuth2 integration
   - JWT token generation and validation
   - Auth guards and decorators
   - Frontend login flow

### **Phase 2: Core Backend Services (Week 2-3)**

1. **Database Setup**
   - Run all 8 migrations in sequence
   - Seed email_patterns table with bank patterns
   - Set up database indexes for performance
   - Configure connection pooling

2. **Gmail Integration**
   - Implement Gmail API service
   - Set up Pub/Sub topic and subscription
   - Create webhook endpoint for push notifications
   - Implement email fetching with retry logic

3. **Email Parser Service**
   - Build pattern matching engine
   - Implement transaction extraction logic
   - Implement statement extraction logic
   - Add card details extraction
   - Build auto-categorization system

### **Phase 3: Background Workers (Week 3-4)**

1. **Process 1: Initial Email Sync**
   - Create Bull Queue worker
   - Implement historical email fetching (2 years)
   - Build progress tracking system
   - Add error handling with retries

2. **Process 2: Real-time Email Processing**
   - Set up Pub/Sub listener
   - Implement real-time transaction processing
   - Add duplicate detection logic
   - Build WebSocket notification system

3. **Process 3: Card Perks Scraper**
   - Build web scraping service (Puppeteer)
   - Implement AI fallback (OpenAI API)
   - Create perks storage system
   - Add scheduled perks refresh job

### **Phase 4: Transaction & Statement Management (Week 4-5)**

1. **Transaction Services**
   - CRUD operations for current transactions
   - Statement transaction migration logic
   - Category update functionality
   - Transaction search and filtering

2. **Statement Services**
   - Statement creation and parsing
   - PDF storage in Cloud Storage
   - Transaction-to-statement migration
   - Statement payment tracking

3. **Spending Limit Service**
   - Real-time limit checking
   - Global and category-based limits
   - Alert email generation
   - Spending reset on statement generation

### **Phase 5: Frontend Core (Week 5-6)**

1. **Authentication UI**
   - Google Sign-in button
   - OAuth callback handling
   - JWT storage and refresh
   - Protected route guards

2. **Loading Experience**
   - Multi-process progress tracker
   - Real-time status updates via WebSocket
   - Animated progress indicators
   - Error state handling

3. **Dashboard Layout**
   - Header with notifications and settings
   - Spending summary component
   - Card grid grouped by bank
   - Glassmorphism card components
   - Framer Motion animations

### **Phase 6: Advanced Features (Week 6-7)**

1. **Card Detail Page**
   - Card information display
   - Perks accordion
   - Transaction timeline
   - Statement history
   - Fees & charges section

2. **Real-time Notifications**
   - WebSocket connection management
   - Toast notifications for new transactions
   - Limit exceeded alerts
   - Statement generated notifications

3. **Spending Management**
   - Create/edit spending limits
   - Category breakdown visualization
   - Progress bars with animations
   - Alert threshold configuration

### **Phase 7: Analytics & Insights (Week 7-8)**

1. **Analytics APIs**
   - Spending trends endpoint
   - Category breakdown
   - Merchant analysis
   - Card usage statistics

2. **Visualization Components**
   - Charts using Recharts
   - Spending trends graphs
   - Category pie charts
   - Monthly comparison views

### **Phase 8: Testing & Optimization (Week 8-9)**

1. **Backend Testing**
   - Unit tests for all services
   - Integration tests for APIs
   - Email parser test cases
   - Mock Gmail API responses

2. **Frontend Testing**
   - Component unit tests (Jest)
   - Integration tests (React Testing Library)
   - E2E tests (Cypress)
   - Accessibility testing

3. **Performance Optimization**
   - Database query optimization
   - API response caching
   - Frontend code splitting
   - Image and asset optimization
   - Lazy loading implementation

### **Phase 9: Security & Compliance (Week 9)**

1. **Security Hardening**
   - Input validation on all endpoints
   - SQL injection prevention
   - XSS protection
   - CSRF tokens
   - Rate limiting
   - Encrypted token storage

2. **Privacy & Data Protection**
   - User data encryption at rest
   - Secure email token handling
   - GDPR compliance measures
   - Data deletion functionality

### **Phase 10: Deployment & Monitoring (Week 10)**

1. **Production Deployment**
   - Docker containerization
   - Cloud Run deployment
   - Database migration in production
   - DNS configuration
   - SSL certificate setup

2. **Monitoring Setup**
   - Google Cloud Logging
   - Error tracking (Sentry)
   - Performance monitoring (New Relic/Datadog)
   - Uptime monitoring
   - Alert configuration

3. **Documentation**
   - API documentation (Swagger)
   - User guide
   - Developer setup guide
   - Troubleshooting guide

---

## 🔧 Environment Setup Instructions

### **Backend (.env)**

```bash
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/credit_cards
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=credit_cards

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Gmail API
GMAIL_API_KEY=your-gmail-api-key
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT/topics/gmail-notifications
GMAIL_PUBSUB_SUBSCRIPTION=projects/YOUR_PROJECT/subscriptions/gmail-push-subscription

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=7d

# Redis (for Bull Queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Google Cloud Storage
GCS_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=credit-card-statements
GCS_KEYFILE_PATH=./gcp-credentials.json

# Email Sending (Gmail API)
GMAIL_SENDER_EMAIL=noreply@yourapp.com

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key

# OpenAI (for AI perks extraction)
OPENAI_API_KEY=sk-your-openai-api-key
```

### **Frontend (.env)**

```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_APP_NAME=Credit Card Dashboard
VITE_SENTRY_DSN=https://your-sentry-dsn
```

---

## 📋 Critical Implementation Notes

### **1. Gmail API Quota Management**

```typescript
// Implement exponential backoff for API calls
class GmailRateLimiter {
  private requestCount = 0;
  private resetTime = Date.now() + 60000; // 1 minute

  async checkLimit(): Promise<void> {
    if (Date.now() > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = Date.now() + 60000;
    }

    if (this.requestCount >= 250) { // Gmail API limit: 250 req/min
      const waitTime = this.resetTime - Date.now();
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.resetTime = Date.now() + 60000;
    }

    this.requestCount++;
  }
}
```

### **2. Transaction Deduplication**

```typescript
// Prevent duplicate transactions from multiple email notifications
async function checkDuplicateTransaction(
  cardId: string,
  amount: number,
  merchantName: string,
  transactionDate: Date
): Promise<boolean> {
  const existingTransaction = await transactionRepository.findOne({
    where: {
      card_id: cardId,
      amount,
      merchant_name: merchantName,
      transaction_date: Between(
        new Date(transactionDate.getTime() - 60000), // 1 min before
        new Date(transactionDate.getTime() + 60000)  // 1 min after
      ),
    },
  });

  return !!existingTransaction;
}
```

### **3. WebSocket Connection Management**

```typescript
// Track active user connections
class WebSocketManager {
  private connections = new Map<string, Socket>();

  addConnection(userId: string, socket: Socket): void {
    this.connections.set(userId, socket);
    
    socket.on('disconnect', () => {
      this.connections.delete(userId);
    });
  }

  isUserOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  sendToUser(userId: string, event: string, data: any): void {
    const socket = this.connections.get(userId);
    if (socket) {
      socket.emit(event, data);
    }
  }
}
```

### **4. Statement Cycle Handling**

```typescript
// Handle edge cases where transaction arrives after statement generation
async function handleLateTransaction(
  transaction: Transaction,
  card: CreditCard
): Promise<void> {
  // Check if there's a recent statement for this card
  const recentStatement = await statementRepository.findOne({
    where: {
      card_id: card.id,
      billing_cycle_end: LessThan(transaction.transaction_date),
    },
    order: { billing_cycle_end: 'DESC' },
  });

  if (recentStatement) {
    // Transaction is for current cycle
    await currentTransactionRepository.save(transaction);
  } else {
    // Transaction belongs to a previous statement (rare edge case)
    // Log for manual review
    logger.warn(`Late transaction detected: ${transaction.id}`);
    await currentTransactionRepository.save(transaction);
  }
}
```

### **5. Card Identification Logic**

```typescript
// Robust card matching when multiple cards have same last 4 digits
async function identifyCard(
  userId: string,
  last4: string,
  bankName: string,
  senderEmail: string
): Promise<CreditCard> {
  // First, try exact match with bank and last 4
  let card = await cardRepository.findOne({
    where: {
      user_id: userId,
      card_last_4_digits: last4,
      bank_name: bankName,
    },
  });

  if (!card) {
    // Try matching by sender email pattern
    card = await cardRepository.findOne({
      where: {
        user_id: userId,
        card_last_4_digits: last4,
        sender_email_pattern: Like(`%${senderEmail}%`),
      },
    });
  }

  if (!card) {
    // Create new card
    card = await cardRepository.save({
      user_id: userId,
      card_last_4_digits: last4,
      bank_name: bankName,
      sender_email_pattern: senderEmail,
    });

    // Trigger perks fetch
    await perksQueue.add('fetch-perks', { cardId: card.id });
  }

  return card;
}
```

---

## 🎨 UI/UX Best Practices

### **1. Skeleton Loading States**

```typescript
// Show skeleton while data loads
export const CardSkeleton: React.FC = () => {
  return (
    <div className="w-80 h-48 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse p-6">
      <div className="space-y-4">
        <div className="h-6 w-24 bg-gray-600 rounded" />
        <div className="h-4 w-16 bg-gray-600 rounded" />
        <div className="mt-8 space-y-2">
          <div className="h-8 w-32 bg-gray-600 rounded" />
          <div className="h-4 w-20 bg-gray-600 rounded" />
        </div>
      </div>
    </div>
  );
};
```

### **2. Empty States**

```typescript
export const EmptyTransactions: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
        <Receipt className="w-12 h-12 text-purple-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        No transactions yet
      </h3>
      <p className="text-gray-400 text-center max-w-sm">
        Your transactions will appear here once we sync your emails
      </p>
    </div>
  );
};
```

### **3. Error States**

```typescript
export const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <AlertCircle className="w-12 h-12 text-red-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">
        Something went wrong
      </h3>
      <p className="text-gray-400 text-center max-w-sm mb-6">
        We couldn't load your data. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
      >
        Try Again
      </button>
    </div>
  );
};
```

### **4. Toast Notifications**

```typescript
// Use react-hot-toast for notifications
import toast from 'react-hot-toast';

// Success
toast.success('Transaction categorized successfully');

// Error
toast.error('Failed to update spending limit');

// Custom
toast.custom((t) => (
  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-4 rounded-lg shadow-xl">
    <div className="flex items-center gap-3">
      <CreditCard className="w-6 h-6" />
      <div>
        <p className="font-semibold">New Transaction</p>
        <p className="text-sm opacity-90">₹1,250 at Swiggy</p>
      </div>
    </div>
  </div>
));
```

---

## 🔍 Debugging & Troubleshooting

### **Common Issues & Solutions**

#### **Issue 1: Gmail Pub/Sub not receiving notifications**

**Solution:**
```bash
# Verify Pub/Sub topic
gcloud pubsub topics describe gmail-notifications

# Check subscription
gcloud pubsub subscriptions describe gmail-push-subscription

# Test webhook endpoint
curl -X POST https://your-backend.com/api/gmail/push \
  -H "Content-Type: application/json" \
  -d '{"message":{"data":"test"}}'

# Re-watch Gmail mailbox
POST https://gmail.googleapis.com/gmail/v1/users/me/watch
{
  "topicName": "projects/YOUR_PROJECT/topics/gmail-notifications",
  "labelIds": ["INBOX"]
}
```

#### **Issue 2: Transactions not being categorized**

**Solution:**
```typescript
// Add debug logging
logger.debug('Attempting to categorize transaction', {
  merchantName: transaction.merchant_name,
  detectedCategory: category,
});

// Check merchant name normalization
const normalizedMerchant = merchantName.toLowerCase().trim();

// Add more keywords to MERCHANT_CATEGORIES
```

#### **Issue 3: High database query load**

**Solution:**
```typescript
// Add query result caching
@Cacheable('cards', 300) // 5 min cache
async findByUser(userId: string) {
  return this.cardRepository.find({ where: { user_id: userId } });
}

// Use database connection pooling
{
  type: 'postgres',
  extra: {
    max: 20, // maximum pool size
    min: 5,  // minimum pool size
  }
}

// Add indexes (see Database Indexing Strategy section)
```

#### **Issue 4: WebSocket disconnections**

**Solution:**
```typescript
// Implement reconnection logic
const socket = io('wss://your-backend.com', {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

socket.on('disconnect', () => {
  console.log('WebSocket disconnected, attempting reconnect...');
});

socket.on('reconnect', (attemptNumber) => {
  console.log('WebSocket reconnected after', attemptNumber, 'attempts');
});
```

---

## 📊 Sample Data for Testing

### **Seed Script**

```typescript
// backend/src/database/seeds/test-data.seed.ts
import { DataSource } from 'typeorm';

export async function seedTestData(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const cardRepo = dataSource.getRepository(CreditCard);
  const transactionRepo = dataSource.getRepository(CurrentTransaction);

  // Create test user
  const user = await userRepo.save({
    google_id: 'test-google-id',
    email: 'test@example.com',
    full_name: 'Test User',
    global_spending_limit: 50000,
  });

  // Create test cards
  const sbiCard = await cardRepo.save({
    user_id: user.id,
    bank_name: 'SBI',
    card_last_4_digits: '7603',
    card_holder_name: 'TEST USER',
    card_type: 'VISA',
    statement_generation_day: 9,
  });

  const hdfcCard = await cardRepo.save({
    user_id: user.id,
    bank_name: 'HDFC',
    card_last_4_digits: '0364',
    card_holder_name: 'TEST USER',
    card_type: 'MASTERCARD',
    statement_generation_day: 14,
  });

  // Create test transactions
  const transactions = [
    {
      card_id: sbiCard.id,
      transaction_date: new Date('2024-10-17'),
      merchant_name: 'Swiggy',
      amount: 450,
      category: 'Food & Dining',
      transaction_type: 'DEBIT',
    },
    {
      card_id: sbiCard.id,
      transaction_date: new Date('2024-10-16'),
      merchant_name: 'Uber',
      amount: 250,
      category: 'Travel',
      transaction_type: 'DEBIT',
    },
    {
      card_id: hdfcCard.id,
      transaction_date: new Date('2024-10-15'),
      merchant_name: 'Amazon',
      amount: 1500,
      category: 'Shopping',
      transaction_type: 'DEBIT',
    },
  ];

  await transactionRepo.save(transactions);

  console.log('Test data seeded successfully!');
}
```

---

## 🎯 SUCCESS CRITERIA

Your implementation will be considered successful when:

### **Functional Requirements ✅**
- [ ] User can sign in with Google OAuth
- [ ] System automatically syncs historical emails on first login
- [ ] Real-time email notifications trigger immediate transaction updates
- [ ] All credit cards are detected and displayed grouped by bank
- [ ] Transactions are automatically categorized
- [ ] Statement generation moves transactions from current to statement table
- [ ] Spending limits can be set and alerts are sent when exceeded
- [ ] Card perks are fetched and displayed for each card
- [ ] WebSocket notifications work for logged-in users
- [ ] Dashboard is responsive across mobile, tablet, and desktop

### **Performance Requirements ⚡**
- [ ] Initial page load < 2 seconds
- [ ] API response time < 500ms for 95% of requests
- [ ] Real-time notifications appear within 5 seconds of email receipt
- [ ] Database queries optimized with proper indexes
- [ ] Frontend bundle size < 500KB gzipped

### **Security Requirements 🔒**
- [ ] All API endpoints require JWT authentication
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS protection enabled
- [ ] Rate limiting implemented
- [ ] Gmail tokens stored encrypted
- [ ] HTTPS enforced in production

### **User Experience Requirements 🎨**
- [ ] Smooth animations and transitions (Framer Motion)
- [ ] Loading states for all async operations
- [ ] Empty states for no data scenarios
- [ ] Error states with retry options
- [ ] Toast notifications for user actions
- [ ] Glassmorphism design matching CRED aesthetic
- [ ] Dark theme throughout

### **Testing Requirements 🧪**
- [ ] Unit test coverage > 80%
- [ ] Integration tests for all API endpoints
- [ ] E2E tests for critical user flows
- [ ] Email parser tested with sample emails from major banks
- [ ] Load testing completed (1000+ concurrent users)

---

## 📞 SUPPORT & MAINTENANCE

### **Post-Launch Monitoring**

Monitor these metrics daily:
- API error rate (should be < 1%)
- Gmail API quota usage
- Database connection pool utilization
- WebSocket connection count
- Average response times
- User sign-up rate
- Email sync success rate

### **Monthly Maintenance Tasks**

- Review and update email parsing patterns
- Check for new bank email formats
- Update card perks database
- Review spending categorization accuracy
- Optimize slow database queries
- Update dependencies and security patches
- Review error logs and fix issues

---

## 🎉 CONCLUSION

This comprehensive specification provides everything needed to build a production-ready credit card management dashboard. The system is designed to be:

- **Scalable**: Can handle thousands of users with millions of transactions
- **Reliable**: Robust error handling and retry mechanisms
- **Secure**: Enterprise-grade security practices
- **User-Friendly**: Beautiful, intuitive interface with real-time updates
- **Maintainable**: Clean code architecture with comprehensive testing

**Key Differentiators:**
1. Automatic email parsing eliminates manual data entry
2. Real-time transaction notifications keep users informed
3. Intelligent spending limits prevent overspending
4. Card perks integration maximizes reward utilization
5. Beautiful, modern UI inspired by CRED

**Technology Stack Summary:**
- **Frontend**: React + TypeScript + Tailwind + Framer Motion
- **Backend**: NestJS + TypeORM + PostgreSQL
- **Cloud**: Google Cloud Run + Cloud SQL + Pub/Sub
- **Real-time**: WebSockets + Bull Queue
- **APIs**: Gmail API + Google OAuth2

**Estimated Timeline**: 10 weeks for complete implementation

**Team Size**: 2-3 full-stack developers

---

## 📝 FINAL NOTES FOR COPILOT

When implementing this project:

1. **Start with Phase 1** - Get authentication working first
2. **Test incrementally** - Don't wait until the end to test
3. **Use TypeScript strictly** - Leverage type safety
4. **Follow the database schema exactly** - It's optimized for this use case
5. **Implement error handling from day 1** - Don't add it later
6. **Focus on the email parser** - It's the most critical component
7. **Test with real bank emails** - Use sample emails from your own inbox
8. **Optimize database queries early** - Add indexes as you go
9. **Keep the UI simple initially** - Add polish in later phases
10. **Document as you code** - Future you will thank present you

**Remember**: This is a complex system with many moving parts. Take it one phase at a time, test thoroughly, and don't hesitate to refactor when needed.

Good luck! 🚀

---
