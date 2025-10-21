# Copilot Implementation Prompt: Credit Card Management Dashboard

## Project Overview
Build a complete Next.js 14+ credit card management dashboard with CRED-inspired design, featuring glassmorphism, real-time updates, and comprehensive transaction management.

## Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + Glassmorphism effects
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Authentication**: Google OAuth (NextAuth.js)
- **State Management**: React hooks + Context API
- **Icons**: Lucide React
- **Notifications**: react-hot-toast

## Design System
```typescript
// Theme Colors (CRED-inspired)
const theme = {
  background: '#0A0E27',
  cardBg: 'rgba(255, 255, 255, 0.05)',
  primary: '#00D4FF',
  secondary: '#7B61FF',
  success: '#00E676',
  warning: '#FFC107',
  danger: '#FF5252',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    muted: 'rgba(255, 255, 255, 0.5)'
  }
}
```

## Sample Data Structure

### User Data
```typescript
const sampleUser = {
  id: 'user_001',
  name: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  globalSpendingLimit: 50000,
  currentSpending: 32450,
  joinedDate: '2024-01-15'
}
```

### Credit Cards Data
```typescript
const sampleCards = [
  {
    id: 'card_001',
    name: 'Platinum Rewards',
    last4: '4532',
    type: 'Visa',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    limit: 100000,
    available: 67550,
    currentBalance: 32450,
    dueDate: '2024-11-05',
    minimumDue: 3245,
    status: 'active'
  },
  {
    id: 'card_002',
    name: 'Travel Elite',
    last4: '8923',
    type: 'Mastercard',
    color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    limit: 75000,
    available: 58200,
    currentBalance: 16800,
    dueDate: '2024-11-10',
    minimumDue: 1680,
    status: 'active'
  },
  {
    id: 'card_003',
    name: 'Cashback Pro',
    last4: '3421',
    type: 'Amex',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    limit: 50000,
    available: 42350,
    currentBalance: 7650,
    dueDate: '2024-11-15',
    minimumDue: 765,
    status: 'active'
  }
]
```

### Transactions Data
```typescript
const sampleTransactions = [
  {
    id: 'txn_001',
    cardId: 'card_001',
    merchant: 'Amazon India',
    category: 'Shopping',
    amount: -2499,
    date: '2024-10-20T14:30:00Z',
    status: 'completed',
    emoji: '🛒'
  },
  {
    id: 'txn_002',
    cardId: 'card_001',
    merchant: 'Uber',
    category: 'Transportation',
    amount: -385,
    date: '2024-10-19T09:15:00Z',
    status: 'completed',
    emoji: '🚗'
  },
  {
    id: 'txn_003',
    cardId: 'card_002',
    merchant: 'Zomato',
    category: 'Food & Dining',
    amount: -1250,
    date: '2024-10-19T20:45:00Z',
    status: 'completed',
    emoji: '🍔'
  },
  {
    id: 'txn_004',
    cardId: 'card_001',
    merchant: 'Netflix',
    category: 'Entertainment',
    amount: -649,
    date: '2024-10-18T00:00:00Z',
    status: 'completed',
    emoji: '🎬'
  },
  {
    id: 'txn_005',
    cardId: 'card_003',
    merchant: 'Cashback Reward',
    category: 'Rewards',
    amount: 450,
    date: '2024-10-17T12:00:00Z',
    status: 'completed',
    emoji: '🎁'
  }
]
```

### Card Perks Data
```typescript
const samplePerks = [
  {
    id: 'perk_001',
    cardId: 'card_001',
    title: 'Airport Lounge Access',
    description: 'Complimentary access to 1000+ lounges worldwide',
    type: 'travel',
    icon: '✈️',
    validUntil: '2025-12-31',
    categories: ['Travel', 'Lifestyle']
  },
  {
    id: 'perk_002',
    cardId: 'card_001',
    title: '5X Reward Points',
    description: 'Earn 5X points on dining and entertainment',
    type: 'rewards',
    icon: '⭐',
    validUntil: '2025-12-31',
    categories: ['Dining', 'Entertainment']
  },
  {
    id: 'perk_003',
    cardId: 'card_002',
    title: 'Travel Insurance',
    description: 'Complimentary travel insurance up to ₹50 lakhs',
    type: 'insurance',
    icon: '🛡️',
    validUntil: '2025-12-31',
    categories: ['Travel', 'Insurance']
  },
  {
    id: 'perk_004',
    cardId: 'card_003',
    title: '10% Cashback',
    description: 'Get 10% cashback on grocery and fuel purchases',
    type: 'cashback',
    icon: '💰',
    validUntil: '2025-12-31',
    categories: ['Grocery', 'Fuel']
  }
]
```

### Statements Data
```typescript
const sampleStatements = [
  {
    id: 'stmt_001',
    cardId: 'card_001',
    month: 'September 2024',
    totalAmount: 28450,
    dueDate: '2024-10-05',
    paidAmount: 28450,
    status: 'paid',
    transactionCount: 45,
    downloadUrl: '#'
  },
  {
    id: 'stmt_002',
    cardId: 'card_001',
    month: 'October 2024',
    totalAmount: 32450,
    dueDate: '2024-11-05',
    paidAmount: 0,
    status: 'unpaid',
    transactionCount: 38,
    downloadUrl: '#'
  },
  {
    id: 'stmt_003',
    cardId: 'card_002',
    month: 'September 2024',
    totalAmount: 15200,
    dueDate: '2024-10-10',
    paidAmount: 15200,
    status: 'paid',
    transactionCount: 32,
    downloadUrl: '#'
  }
]
```

### Category Spending Data
```typescript
const categorySpending = [
  { category: 'Shopping', amount: 12450, emoji: '🛒', color: '#667eea' },
  { category: 'Food & Dining', amount: 8920, emoji: '🍔', color: '#f093fb' },
  { category: 'Transportation', amount: 5680, emoji: '🚗', color: '#4facfe' },
  { category: 'Entertainment', amount: 3400, emoji: '🎬', color: '#7B61FF' },
  { category: 'Bills & Utilities', amount: 2000, emoji: '📱', color: '#FFC107' }
]
```

---

## Implementation Instructions

### 1. Setup & Configuration

**File: `app/layout.tsx`**
```typescript
// Implement root layout with:
// - ErrorBoundary wrapper for entire app
// - Toast notification provider (react-hot-toast)
// - Global styles and font configuration
// - Metadata configuration
// - Dark theme by default
```

**File: `lib/sample-data.ts`**
```typescript
// Export all sample data objects defined above
// Add helper functions to fetch data by ID
// Include data generation utilities for demos
```

---

### 2. Core UI Components

#### Priority 1: ErrorBoundary Component
**File: `components/ErrorBoundary.tsx`**
- Implement React Error Boundary class component
- Catch and log component tree errors
- Display fallback UI with glassmorphism styling
- Include "Try Again" and "Go to Dashboard" buttons
- Use Framer Motion for error UI entrance animation

#### Priority 2: EmptyState Component
**File: `components/ui/EmptyState.tsx`**
- Accept props: icon (Lucide icon), title, description, actionLabel, onAction
- Glassmorphism card container
- Center-aligned content with icon, text, and optional button
- Used across: Dashboard (no cards), Transactions, Perks, Statements

#### Priority 3: LoadingSkeleton Component
**File: `components/ui/LoadingSkeleton.tsx`**
- Shimmer animation effect
- Multiple variants: card, list, chart, text
- Configurable dimensions and count
- CRED-themed gradient animation

---

### 3. Dashboard Components

#### Priority 1: Header Component
**File: `components/dashboard/Header.tsx`**
```typescript
// Features:
// - Logo with app name "CardHub"
// - Navigation links: Dashboard, Cards, Transactions, Settings
// - User profile dropdown (avatar, name, email, logout)
// - Mobile hamburger menu with slide-in animation
// - Framer Motion animations for dropdown and mobile menu
// - Glass morphism background with backdrop blur
// - Sticky positioning
```

#### Priority 2: SpendingSummary Component
**File: `components/dashboard/SpendingSummary.tsx`**
```typescript
// Features:
// - Display global spending limit vs current spending
// - Animated progress bar with gradient (green → yellow → red)
// - Alert indicators: "On Track" / "Approaching Limit" / "Limit Exceeded"
// - Top 4 spending categories with emoji icons
// - Category breakdown with amounts and percentages
// - Glassmorphism card styling
// - Shimmer effects on hover
// - Framer Motion entrance animations
```

#### Priority 3: SpendingChart Component
**File: `components/dashboard/SpendingChart.tsx`**
```typescript
// Features:
// - Toggle between Bar Chart and Pie Chart views
// - Recharts integration with categorySpending data
// - CRED theme colors for chart elements
// - Responsive container (adjust to parent width)
// - Custom tooltips with glassmorphism styling
// - Animated entrance with Framer Motion
// - Legend with category names and amounts
```

---

### 4. Page Components

#### Priority 1: Login Page
**File: `app/login/page.tsx`**
```typescript
// Features:
// - Large gradient hero section with app name
// - "Sign in with Google" button (glassmorphism)
// - Feature highlights grid: Secure, Real-time, Smart Limits
// - Each feature: icon, title, description
// - Animated entrance with stagger effect
// - Full-screen centered layout
// - Redirect to /loading after successful login simulation
```

#### Priority 2: Loading Page
**File: `app/loading/page.tsx`**
```typescript
// Features:
// - First-time user setup indicators (3 steps)
// - Step 1: "Fetching your cards" with progress (0-33%)
// - Step 2: "Analyzing transactions" with progress (34-66%)
// - Step 3: "Setting up dashboard" with progress (67-100%)
// - Animated progress bars with completion checkmarks
// - Auto-advance simulation (2 seconds per step)
// - Redirect to /dashboard after completion
// - Use Framer Motion for step transitions
```

#### Priority 3: Card Detail Page
**File: `app/cards/[cardId]/page.tsx`**
```typescript
// Features:
// - Large credit card display at top (3D tilt effect on hover)
// - Tabbed interface: Overview, Transactions, Statements, Perks
// - Overview tab: Balance, Available credit, Due date, Minimum due
// - Transactions tab: TransactionTimeline component (filtered by cardId)
// - Statements tab: StatementTimeline component (filtered by cardId)
// - Perks tab: CardPerks component (filtered by cardId)
// - Tab animations with Framer Motion
// - Responsive layout (stack on mobile)
// - Back button to dashboard
```

#### Priority 4: Settings Page
**File: `app/settings/page.tsx`**
```typescript
// Features:
// - User profile section: avatar, name, email (read-only for demo)
// - Global spending limit configuration with slider
// - Notification preferences: Email, Push, SMS toggles
// - Category-wise spending alerts toggle
// - Theme selection (Dark/Light - default Dark)
// - "Save Settings" button with success toast
// - Glassmorphism cards for each section
// - Framer Motion animations
```

---

### 5. Transaction Components

#### TransactionTimeline Component
**File: `components/transactions/TransactionTimeline.tsx`**
```typescript
// Features:
// - Vertical timeline with connecting lines
// - Each transaction: emoji icon, merchant, category, amount, date
// - Color-coded amounts: green for credits, white for debits
// - Hover effects: scale and glow
// - Date grouping headers (e.g., "Today", "Yesterday", "Oct 18")
// - Smooth entrance animations (stagger by 50ms per item)
// - EmptyState when no transactions
// - Filter by cardId prop (optional)
```

---

### 6. Card Components

#### CardPerks Component
**File: `components/cards/CardPerks.tsx`**
```typescript
// Features:
// - Grid layout (2 columns on desktop, 1 on mobile)
// - Each perk card: emoji icon, title, description, valid until
// - Category badges with pill styling
// - Hover effects: lift and glow
// - EmptyState when no perks available
// - Framer Motion stagger animations
// - Filter by cardId prop (optional)
```

#### StatementTimeline Component
**File: `components/cards/StatementTimeline.tsx`**
```typescript
// Features:
// - Vertical timeline of monthly statements
// - Status color coding:
//   - Paid: Green indicator
//   - Unpaid: Yellow indicator  
//   - Overdue: Red indicator
// - Each statement: month, total amount, due date, status badge
// - "Download PDF" and "View Transactions" buttons
// - Connecting timeline line between statements
// - Hover effects on statement cards
// - EmptyState when no statements
// - Filter by cardId prop (optional)
```

---

### 7. Dashboard Page Enhancement
**File: `app/dashboard/page.tsx`**
```typescript
// Features:
// - Import and use Header component
// - SpendingSummary component at top
// - Grid of credit cards (CreditCard component for each)
// - SpendingChart component below cards
// - Recent transactions section (last 5 transactions)
// - EmptyState when user has no cards
// - Responsive grid layout
// - Framer Motion page entrance animation
```

---

## Styling Guidelines

### Glassmorphism Utility Classes
```css
.glass-card {
  @apply bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl;
}

.glass-button {
  @apply bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 
         transition-all duration-300;
}

.shimmer {
  @apply relative overflow-hidden;
}

.shimmer::after {
  @apply absolute inset-0 -translate-x-full animate-shimmer;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  content: '';
}
```

### Animation Variants (Framer Motion)
```typescript
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
}
```

---

## Navigation & Routing

### Route Structure
```
/login → Login page (public)
/loading → Setup loading page (protected)
/dashboard → Main dashboard (protected)
/cards/[cardId] → Individual card details (protected)
/transactions → All transactions page (protected)
/settings → User settings (protected)
```

### Protected Route Middleware
```typescript
// middleware.ts
// Check authentication status
// Redirect to /login if not authenticated
// Allow public routes: /login
```

---

## Testing Checklist

- [ ] All pages render without errors
- [ ] Navigation works between all routes
- [ ] Sample data displays correctly
- [ ] Responsive design on mobile (320px+), tablet (768px+), desktop (1024px+)
- [ ] Animations play smoothly (60fps)
- [ ] Error boundary catches component errors
- [ ] Empty states show when data is missing
- [ ] Loading skeletons appear during data fetch simulation
- [ ] Toast notifications work for actions
- [ ] Glassmorphism effects visible with backdrop blur
- [ ] Charts render with correct data and colors
- [ ] Transaction timeline groups by date correctly
- [ ] Card perks and statements filter by cardId

---

## Execution Command

**Generate the complete project structure with all components, pages, and sample data integration. Ensure every component is fully functional, styled with glassmorphism, and animated with Framer Motion. Use the sample data provided for demonstration purposes.**

---

## Priority Order
1. ✅ Error handling (ErrorBoundary, EmptyState)
2. ✅ Core UI components (LoadingSkeleton)
3. ✅ Header component (navigation)
4. ✅ Login & Loading pages (entry flow)
5. ✅ SpendingSummary & SpendingChart (dashboard features)
6. ✅ Card detail page with tabs
7. ✅ Transaction & Card components (timelines, perks)
8. ✅ Settings page
9. ✅ Mobile responsiveness
10. ✅ Final polish and animations