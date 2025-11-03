# Frontend Features & UI/UX Specification

## Table of Contents

1. [Design System & Theme](#design-system--theme)
2. [Layout Components](#layout-components)
3. [Dashboard Page (Overview)](#dashboard-page-overview)
4. [Cards View Page](#cards-view-page)
5. [Card Detail View Page](#card-detail-view-page)
6. [Transactions View Page](#transactions-view-page)
7. [Settings Page](#settings-page)
8. [Authentication Pages](#authentication-pages)
9. [Reusable Components](#reusable-components)
10. [User Flows & Navigation](#user-flows--navigation)
11. [Responsive Design](#responsive-design)
12. [Accessibility Guidelines](#accessibility-guidelines)

---

## Design System & Theme

### Color Palette

Based on the dark-themed dashboard reference:

**Background Colors:**

- **Primary Background**: `#1A1D21` or `#1E2126` (dark charcoal gray)
- **Card Background**: `#25282E` or `#2C3038` (slightly lighter dark gray)
- **Hover State**: `#2F3339` (subtle lightening on hover)

**Text Colors:**

- **Primary Text**: `#E0E0E0` or `#FFFFFF` (light gray/white)
- **Secondary Text**: `#A0A0A0` (medium gray for labels)
- **Muted Text**: `#6B7280` (darker gray for inactive elements)

**Accent Colors:**

- **Primary Green**: `#6ECB8E` or `#7ED99F` (balance, primary actions, progress bars)
- **Purple**: `#9B59B6` or `#A870C7` (card accent - Shipping Card)
- **Orange**: `#F39C12` or `#F7B731` (card accent - Transfer Card)
- **Blue/Teal**: `#3498DB` or `#5DADE2` (icons, analytics)
- **Light Orange**: `#E67E22` or `#F5B041` (spending indicators)
- **Light Green**: `#2ECC71` or `#58D68D` (positive indicators, goals)

**Status Colors:**

- **Success**: `#6ECB8E`
- **Warning**: `#F39C12`
- **Error**: `#E74C3C`
- **Info**: `#3498DB`

### Typography

**Font Family:**

- Primary: `Inter` or `Poppins` (modern sans-serif)
- Fallback: `system-ui, -apple-system, sans-serif`

**Font Sizes & Weights:**

- **H1 (Page Titles)**: `28-32px`, `font-weight: 700` (bold)
- **H2 (Section Titles)**: `18-20px`, `font-weight: 600` (semi-bold)
- **H3 (Subsection Titles)**: `16px`, `font-weight: 600`
- **Body Text**: `14-16px`, `font-weight: 400` (regular)
- **Small Text**: `12-14px`, `font-weight: 400`
- **Large Numbers**: `36-48px`, `font-weight: 700` (for key metrics)

### Spacing & Layout

- **Border Radius**: `12px` (cards), `8px` (buttons), `6px` (inputs)
- **Card Padding**: `24px` (large cards), `16px` (small cards)
- **Section Gap**: `24px` (between major sections)
- **Card Gap**: `16px` (between cards in grid)
- **Shadow**: `0 4px 6px rgba(0, 0, 0, 0.3)` (subtle depth)

### Component Styles

- **Buttons**: Rounded corners, padding `12px 24px`, transition effects
- **Inputs**: Dark background (`#25282E`), rounded corners, focus states
- **Cards**: Rounded corners (`12px`), subtle shadows, hover effects
- **Progress Bars**: Green fill (`#6ECB8E`), rounded edges, percentage labels

---

## Layout Components

### Main Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│                    App Shell                             │
│  ┌──────┐  ┌──────────────────────┐  ┌─────────────────┐ │
│  │      │  │                     │  │                 │ │
│  │ Side │  │   Main Content      │  │  Right Sidebar │ │
│  │ bar  │  │   Area              │  │  (Details)     │ │
│  │      │  │                     │  │                 │ │
│  └──────┘  └──────────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 1. Sidebar Navigation (`<Sidebar />`)

**Purpose**: Primary navigation between main sections

**Layout**: Vertical column on the left, fixed width `64-80px`

**Components**:

- Circular profile icon at top (green dot)
- Vertical stack of navigation icons:
  - Home (active state: white circular background)
  - Bar chart (Analytics)
  - Credit card (Cards)
  - Wallet (Transactions)
  - Folder (Documents/Statements)
  - Settings (gear icon)

**Styling**:

- Background: `#1A1D21`
- Icon size: `24px`
- Active state: White circular background (`#FFFFFF`), icon color dark
- Inactive state: Icon color `#A0A0A0`
- Hover: Slight background highlight
- Padding: `16px` between icons

**Responsive**: Collapses to bottom navigation on mobile

### 2. Header Bar (`<Header />`)

**Purpose**: Display page title, search, and user actions

**Layout**: Horizontal bar at top of main content area

**Components**:

- **Left**: Page title (e.g., "Welcome Dashboard")
- **Center**: Search bar with magnifying glass icon
- **Right**: Action icons (Mail, Chat, Wallet, Bell with notification badge "2", Profile avatar)

**Styling**:

- Background: Transparent (inherits from main background)
- Search bar: Dark gray background (`#25282E`), rounded (`8px`), placeholder text `#6B7280`
- Icons: `20px`, color `#A0A0A0`, hover: `#E0E0E0`
- Notification badge: Red circle with white text, positioned top-right of bell icon

**API Integration**: None (UI only, notifications fetched separately)

### 3. Right Sidebar (`<RightSidebar />`)

**Purpose**: Display detailed card information and spending limits

**Layout**: Fixed width `320-400px` on right side, scrollable

**Components**:

- Card details section
- Spending limits section
- Quick actions

**Styling**:

- Background: `#25282E`
- Padding: `24px`
- Section spacing: `32px`

**Responsive**: Hidden on mobile, accessible via modal/drawer

---

## Dashboard Page (Overview)

**Route**: `/`

**Purpose**: Display key metrics, spending overview, and quick insights for users

**Layout**: 3-column responsive grid (main content area)

### Main Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Welcome Dashboard"                                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Inventory Details Card (Large, Prominent)           │   │
│  │  ┌──────────────┐  ┌─────────────────────────────┐ │   │
│  │  │ Dark Section │  │ Green Section (with pattern)  │ │   │
│  │  │ Balance Info │  │ "Details →" Button           │ │   │
│  │  └──────────────┘  └─────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Total        │  │ Total        │  │ Spending     │     │
│  │ Earnings     │  │ Spendings    │  │ Goal         │     │
│  │ $20,894.30   │  │ $7,346.50    │  │ $8,548.20    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Cards Section                                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Shipping │  │ Transfer │  │ Add Card  │          │   │
│  │  │ Card     │  │ Card     │  │ (dashed) │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Transactions Section                                 │   │
│  │  [All] [Revenues] [Expense]  [📅] [📊] [🔍]        │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ Transaction Table                               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Inventory Details Card (`<InventoryDetailsCard />`)

**Purpose**: Display total balance and card count

**Layout**: Large horizontal card, split into two sections

**Left Section (Dark)**:

- Text: "Your balance"
- Large amount: `$35,200` (48px, bold, white)
- Subtext: "3 CARD" (smaller, gray)

**Right Section (Green Background)**:

- Background: `#6ECB8E` with subtle abstract line patterns
- Button: "Details →" (white text, green background, arrow icon)
- Click action: Navigate to `/cards` or expand card details

**Styling**:

- Background: `#25282E` (left), `#6ECB8E` (right)
- Border radius: `12px`
- Padding: `32px`
- Shadow: Subtle elevation

**API Integration**:

- `GET /api/kpis` - Fetch total balance and card count
- Response mapping:
  ```typescript
  {
    totalBalance: number;
    cardCount: number;
  }
  ```

#### 2. KPI Summary Cards (`<KPICard />`)

**Purpose**: Display key performance indicators

**Layout**: 3 cards in horizontal row, equal width

**Card 1: Total Earnings**

- Icon: Circular blue background (`#3498DB`)
- Title: "Total earnings"
- Amount: `$20,894.30` (large, bold)
- Trend indicator: Optional up/down arrow

**Card 2: Total Spendings**

- Icon: Circular orange background (`#F39C12`)
- Title: "Total Spendings"
- Amount: `$7,346.50` (large, bold)

**Card 3: Spending Goal**

- Icon: Circular green background (`#2ECC71`)
- Title: "Spending Goal"
- Amount: `$8,548.20` (large, bold)

**Styling**:

- Background: `#25282E`
- Icon circle: `48px` diameter
- Padding: `24px`
- Border radius: `12px`
- Hover: Slight scale effect (`scale(1.02)`)

**API Integration**:

- `GET /api/kpis` - Fetch all KPIs
- Response mapping:
  ```typescript
  {
    totalEarnings: number;
    totalSpendings: number;
    spendingGoal: number;
  }
  ```

#### 3. Cards Preview Section (`<CardsPreview />`)

**Purpose**: Quick preview of credit cards

**Layout**: Horizontal scrollable row or grid

**Components**:

- **Card Items**: `<CardPreviewItem />` for each card
  - Background color (purple `#9B59B6` or orange `#F39C12`)
  - Card visual with chip, masked number, expiry, VISA logo
  - Card name
- **Add Card Button**: Dashed border, "+" icon, "Add Card" text

**Styling**:

- Card dimensions: `280px width × 160px height`
- Border radius: `12px`
- Gap: `16px`
- Add button: Dashed border (`2px dashed #6B7280`), hover: solid border

**API Integration**:

- `GET /api/cards` - Fetch all cards
- Response: Array of `CreditCard` objects

**Interactions**:

- Click card: Navigate to `/cards/[cardId]`
- Click "Add Card": Open add card modal or navigate to `/cards?add=true`

#### 4. Transactions Preview (`<TransactionsPreview />`)

**Purpose**: Display recent transactions with filter tabs

**Layout**: Vertical section with tabs and table

**Header**:

- Title: "Transactions"
- Tabs: `[All]` (active), `[Revenues]`, `[Expense]`
- Action icons: Calendar, Bar chart, Filter

**Table**:

- Columns: Date, Merchant, Amount, Card, Category
- Rows: Up to 5-10 recent transactions
- Hover: Row highlight

**Styling**:

- Tab active: Dark gray background (`#25282E`), white text
- Tab inactive: Transparent, gray text (`#A0A0A0`)
- Table: Dark background, alternating row colors
- Border radius: `8px` for tabs

**API Integration**:

- `GET /api/transactions?limit=10` - Fetch recent transactions
- Filter by tab: `?type=revenue` or `?type=expense`

**Interactions**:

- Tab click: Filter transactions
- Row click: Navigate to transaction detail or expand
- Icon click: Open respective modal (calendar picker, chart view, filter panel)

### Right Sidebar Content (Dashboard)

**Components**:

#### 1. Details Card Section (`<CardDetailsSidebar />`)

**Purpose**: Display selected card details

**Layout**: Vertical card display with details

**Components**:

- Header: "Details card" with "+" and "..." icons
- Card visual: Vertical orientation, green background (`#6ECB8E`)
  - Card name, expiry, masked number, VISA logo, chip
- Details grid:
  - Card Number: Full number (8465 3481 4985 4080)
  - Expire Date: 08/28
  - CVV: 848
  - Level: 02

**Styling**:

- Card visual: `200px height`, rounded corners
- Details: 3-column grid, label-value pairs
- Background: `#25282E`

**API Integration**:

- `GET /api/cards/:id` - Fetch card details (when card selected)

#### 2. Spending Limits Section (`<SpendingLimitsSidebar />`)

**Purpose**: Display daily/monthly spending limits with progress

**Layout**: Vertical section with progress bars

**Components**:

- Title: "Spending limits"
- Daily Transaction Limit:
  - Label: "DAILY TRANSACTION LIMIT"
  - Progress bar: Green fill showing 20%
  - Text: "$400.00 spent of $2,000.00"
  - Percentage: "20%"

**Styling**:

- Progress bar: Background `#1A1D21`, fill `#6ECB8E`, rounded edges
- Height: `8px`
- Label: `#A0A0A0`, value: `#E0E0E0`

**API Integration**:

- `GET /api/settings/spending-limit` - Fetch spending limits
- `GET /api/transactions/stats` - Fetch current spending

**Interactions**:

- Click to edit: Open spending limit modal

### API Integrations Summary

**On Page Load**:

```typescript
// Parallel requests
GET /api/kpis                    // All KPIs
GET /api/cards                   // Card list
GET /api/transactions?limit=10   // Recent transactions
GET /api/settings/spending-limit // Spending limits
```

**Response Format** (from architecture.md):

```json
{
  "success": true,
  "data": {
    /* response data */
  },
  "error": null,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### User Flows

1. **Landing on Dashboard**:

   - User authenticated → Redirect to `/`
   - Load all dashboard data in parallel
   - Display loading skeletons
   - Render cards when data ready

2. **View Card Details**:

   - Click card preview → Update right sidebar with card details
   - Or click "Details →" button → Navigate to `/cards/[cardId]`

3. **Add New Card**:

   - Click "Add Card" → Open modal or navigate to `/cards?add=true`
   - Fill form → Submit → Refresh card list

4. **Filter Transactions**:
   - Click tab (All/Revenues/Expense) → Update transaction list
   - Click filter icon → Open filter panel → Apply filters

---

## Cards View Page

**Route**: `/cards`

**Purpose**: Display all credit cards with details, bill dates, due dates, and quick actions

**Layout**: Grid layout with card items and filters

### Main Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Cards"                                            │
│  [Search] [Filter] [Sort] [+ Add Card]                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Card 1   │  │ Card 2   │  │ Card 3   │  │ Add Card │  │
│  │ Details  │  │ Details  │  │ Details  │  │ Button   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Card 4   │  │ Card 5   │  │ Card 6   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Card Grid (`<CardGrid />`)

**Purpose**: Display all cards in responsive grid

**Layout**: 3-4 columns on desktop, 2 on tablet, 1 on mobile

**Card Item** (`<CardItem />`):

- **Card Visual**: Horizontal card with gradient background
  - Color: Based on card type or assigned color (purple, orange, etc.)
  - Elements: Chip icon, card name, masked number (\***\* \*\*** 3040), expiry date, bank logo
- **Card Info Section**:
  - Card name (bold)
  - Bank name
  - Current balance: `$X,XXX.XX`
  - Bill date: "Bill Date: 15th"
  - Due date: "Due Date: 5th"
- **Quick Actions**:
  - "View Transactions" button
  - "View Insights" button
  - "Edit" icon
  - "Delete" icon (with confirmation)

**Styling**:

- Card dimensions: `320px × 200px` (desktop)
- Background: Gradient based on card color
- Border radius: `12px`
- Hover: Lift effect (`translateY(-4px)`)
- Shadow: Enhanced on hover

**API Integration**:

- `GET /api/cards` - Fetch all cards
- Response: Array of `CreditCard` objects
  ```typescript
  {
    id: string;
    card_name: string;
    bank_name: string;
    card_number_last4: string;
    bill_date: number;
    due_date: number;
    credit_limit: number;
    current_balance: number;
    is_active: boolean;
  }
  ```

**Interactions**:

- Click card: Navigate to `/cards/[cardId]`
- Click "View Transactions": Navigate to `/transactions?card_id=[cardId]`
- Click "View Insights": Navigate to `/cards/[cardId]?tab=insights`
- Click "Edit": Open edit card modal
- Click "Delete": Show confirmation dialog → `DELETE /api/cards/:id`

#### 2. Add Card Button (`<AddCardButton />`)

**Purpose**: Trigger add card flow

**Layout**: Card-sized button with dashed border

**Styling**:

- Border: `2px dashed #6B7280`
- Background: Transparent
- Content: "+" icon (large, `48px`), "Add Card" text
- Hover: Solid border, slight background fill

**Interactions**:

- Click: Open `<AddCardModal />` or navigate to add card form

#### 3. Add/Edit Card Modal (`<CardModal />`)

**Purpose**: Form to add or edit card details

**Layout**: Centered modal overlay

**Form Fields**:

- Card Name\* (text input)
- Bank Name (text input)
- Card Number Last 4 Digits\* (4-digit input)
- Bill Date\* (number input, 1-31)
- Due Date\* (number input, 1-31)
- Credit Limit (number input, optional)
- Card Color (color picker or preset colors)

**Actions**:

- "Cancel" button (gray)
- "Save" button (green `#6ECB8E`)

**API Integration**:

- `POST /api/cards` - Create new card
- `PUT /api/cards/:id` - Update card
- Request body:
  ```typescript
  {
    card_name: string;
    bank_name?: string;
    card_number_last4: string;
    bill_date: number;
    due_date: number;
    credit_limit?: number;
  }
  ```

**Validation**:

- Required fields marked with \*
- Bill date and due date: 1-31 range
- Card number: Exactly 4 digits
- Show error messages below fields

#### 4. Search and Filter Bar (`<CardFilters />`)

**Purpose**: Filter and search cards

**Components**:

- Search input: Filter by card name or bank
- Filter dropdown: Filter by bank, active/inactive
- Sort dropdown: Sort by name, balance, bill date
- View toggle: Grid/List view

**Styling**:

- Background: `#25282E`
- Input: Dark background, rounded
- Icons: `#A0A0A0`

**Interactions**:

- Real-time search filtering
- Filter changes update card grid
- Persist filters in URL query params

### Right Sidebar Content (Cards Page)

**Components**:

- Selected card details (if card selected)
- Upcoming bill dates list
- Quick stats: Total cards, total credit limit, total balance

### API Integrations Summary

**On Page Load**:

```typescript
GET / api / cards; // Fetch all cards
```

**On Actions**:

```typescript
POST /api/cards              // Add card
PUT /api/cards/:id           // Update card
DELETE /api/cards/:id        // Delete card
GET /api/cards/:id/insights  // Get card insights (if needed)
```

### User Flows

1. **View All Cards**:

   - Navigate to `/cards` → Load cards → Display grid

2. **Add New Card**:

   - Click "Add Card" → Open modal → Fill form → Submit → Refresh list

3. **Edit Card**:

   - Click edit icon → Open modal with pre-filled data → Update → Submit → Refresh

4. **Delete Card**:

   - Click delete icon → Confirm dialog → Delete → Refresh list

5. **View Card Details**:
   - Click card → Navigate to `/cards/[cardId]`

---

## Card Detail View Page

**Route**: `/cards/[cardId]`

**Purpose**: Display detailed information for a specific card, including transactions, insights, and spending trends

**Layout**: Main content with tabs, right sidebar with card details

### Main Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: [← Back] "Card Name" [Edit] [Delete]               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Card Visual (Large, Prominent)                     │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ Card Details: Balance, Limit, Utilization   │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [Transactions] [Insights] [Statement]               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tab Content Area                                    │   │
│  │  - Transactions: Table with filters                  │   │
│  │  - Insights: Charts and analytics                   │   │
│  │  - Statement: Download and view                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Card Header (`<CardHeader />`)

**Purpose**: Display card visual and key metrics

**Layout**: Large card visual with details below

**Card Visual**:

- Full-width card display (similar to right sidebar but larger)
- Gradient background based on card color
- Card details: Name, number, expiry, logo

**Metrics Section**:

- Current Balance: `$X,XXX.XX` (large, bold)
- Credit Limit: `$X,XXX.XX`
- Utilization: Progress bar showing percentage
- Available Credit: `$X,XXX.XX`

**Styling**:

- Card visual: `100% width × 240px height`
- Metrics: Grid layout, `4 columns`
- Background: `#25282E`

**API Integration**:

- `GET /api/cards/:id` - Fetch card details
- Calculate utilization: `(current_balance / credit_limit) * 100`

#### 2. Tab Navigation (`<CardTabs />`)

**Purpose**: Switch between different views

**Tabs**:

- Transactions (default)
- Insights
- Statement

**Styling**:

- Active tab: Dark background (`#25282E`), white text, underline
- Inactive tab: Transparent, gray text
- Border radius: `8px` top corners

**Interactions**:

- Click tab: Update URL query param `?tab=insights`
- Load respective content

#### 3. Transactions Tab (`<CardTransactionsTab />`)

**Purpose**: Display card-specific transactions

**Layout**: Table with filters and pagination

**Filters**:

- Month selector (dropdown)
- Year selector (dropdown)
- Bill period selector
- Search input

**Table Columns**:

- Date
- Merchant
- Amount
- Category
- Bill Period
- Status (Settled/Pending)

**Actions**:

- "Add Transaction" button
- Export button (CSV/PDF)
- Bulk actions (select multiple)

**Styling**:

- Table: Dark background, alternating rows
- Hover: Row highlight
- Selected: Checkbox with highlight

**API Integration**:

- `GET /api/cards/:id/transactions?month=X&year=Y` - Fetch transactions
- `POST /api/transactions` - Add manual transaction
- Response:
  ```typescript
  {
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
  }
  ```

#### 4. Insights Tab (`<CardInsightsTab />`)

**Purpose**: Display analytics and trends for the card

**Layout**: Grid of charts and metrics

**Components**:

- **Spending Trend Chart**: Line chart showing spending over time
- **Category Breakdown**: Pie or bar chart
- **Monthly Comparison**: Bar chart comparing months
- **Key Metrics Cards**:
  - Average transaction amount
  - Most used category
  - Peak spending day
  - Bill payment trends

**Styling**:

- Charts: Dark theme, green accent color
- Cards: `#25282E` background
- Grid: 2 columns on desktop

**API Integration**:

- `GET /api/cards/:id/insights` - Fetch card insights
- `GET /api/analytics/spending-trends?card_id=:id` - Spending trends
- `GET /api/analytics/category-analysis?card_id=:id` - Category analysis

**Chart Library**: Recharts or Chart.js with dark theme

#### 5. Statement Tab (`<CardStatementTab />`)

**Purpose**: View and download statements

**Layout**: List of statements with download options

**Components**:

- Statement list (by month/year)
- Download button (PDF)
- View button (opens PDF viewer)
- Upload statement button (if manual upload supported)

**Styling**:

- List items: Card-style, `#25282E` background
- Download icon: Green

**API Integration**:

- `GET /api/cards/:id/statements` - List statements (if implemented)
- Statement generation: Backend endpoint or client-side PDF generation

### Right Sidebar Content (Card Detail)

**Components**:

- Card details (same as dashboard)
- Upcoming bill date reminder
- Quick actions (pay bill, set reminder)

### API Integrations Summary

**On Page Load**:

```typescript
GET /api/cards/:id                    // Card details
GET /api/cards/:id/transactions       // Recent transactions
GET /api/cards/:id/insights           // Card insights
```

**On Tab Switch**:

```typescript
// Load respective data based on active tab
GET /api/cards/:id/transactions?filters
GET /api/analytics/spending-trends?card_id=:id
```

### User Flows

1. **View Card Details**:

   - Navigate from cards list → Load card data → Display header and default tab

2. **Switch Tabs**:

   - Click tab → Load tab-specific data → Display content

3. **Add Transaction**:

   - Click "Add Transaction" → Open modal → Fill form → Submit → Refresh list

4. **View Insights**:

   - Click Insights tab → Load analytics data → Render charts

5. **Download Statement**:
   - Click download → Generate/retrieve PDF → Download file

---

## Transactions View Page

**Route**: `/transactions`

**Purpose**: Display all transactions from all cards with advanced filtering, search, and analytics

**Layout**: Main content with filters, table, and analytics sidebar

### Main Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Transactions"                                     │
│  [Search] [Filters] [Export] [+ Add Transaction]            │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [All] [Revenues] [Expense]                           │
│  Filters: [Month ▼] [Year ▼] [Card ▼] [Category ▼]        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Transactions Table                                  │   │
│  │  ┌──────┬──────────┬────────┬──────────┬─────────┐ │   │
│  │  │ Date │ Merchant │ Amount │ Card     │ Category│ │   │
│  │  ├──────┼──────────┼────────┼──────────┼─────────┤ │   │
│  │  │ ...  │ ...      │ ...    │ ...      │ ...     │ │   │
│  │  └──────┴──────────┴────────┴──────────┴─────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│  [< Previous] [1] [2] [3] [Next >]                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Analytics Summary                                    │   │
│  │  Total: $X,XXX | This Month: $X,XXX | Avg: $XXX     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Filter Bar (`<TransactionFilters />`)

**Purpose**: Filter transactions by various criteria

**Layout**: Horizontal bar with multiple filter controls

**Filters**:

- **Type Tabs**: All, Revenues, Expense (same as dashboard)
- **Month Selector**: Dropdown (January-December)
- **Year Selector**: Dropdown (current year ± 2 years)
- **Card Selector**: Multi-select dropdown (all cards)
- **Category Selector**: Multi-select dropdown (all categories)
- **Date Range**: Optional date picker (from-to)
- **Amount Range**: Min-max inputs
- **Search**: Text input (search merchant, description)

**Styling**:

- Background: `#25282E`
- Inputs: Dark background, rounded
- Dropdowns: Custom styled, dark theme
- Active filters: Badge showing active count

**Interactions**:

- Real-time filtering (debounced)
- URL query params for shareable filters
- "Clear All" button
- Save filter presets (optional)

**API Integration**:

- Filters sent as query params:
  ```
  GET /api/transactions?month=1&year=2024&card_id=xxx&category=xxx&type=expense&search=xxx
  ```

#### 2. Transactions Table (`<TransactionsTable />`)

**Purpose**: Display filtered transactions in sortable table

**Layout**: Full-width table with pagination

**Columns**:

- **Date**: Formatted date (e.g., "Jan 15, 2024")
- **Merchant**: Merchant name with icon (if available)
- **Amount**: Formatted currency, color-coded (green for revenue, red for expense)
- **Card**: Card name with colored badge
- **Category**: Category badge with icon
- **Bill Period**: "Jan 2024" format
- **Status**: Badge (Settled/Pending)
- **Actions**: Edit, Delete icons

**Styling**:

- Table: Dark background (`#25282E`)
- Header: Bold, `#A0A0A0` text
- Rows: Alternating subtle background colors
- Hover: Row highlight (`#2F3339`)
- Selected: Checkbox selection with highlight
- Amount: Green (`#6ECB8E`) for positive, red for negative
- Border: Subtle borders between rows

**Sorting**:

- Click column header to sort
- Sort indicator (arrow up/down)
- Multi-column sort (optional)

**Pagination**:

- Page size selector (10, 25, 50, 100)
- Page numbers with ellipsis
- Previous/Next buttons
- Total count display

**API Integration**:

- `GET /api/transactions?page=1&limit=25&sort=date:desc&filters...`
- Response:
  ```typescript
  {
    transactions: Transaction[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  ```

**Interactions**:

- Row click: Expand transaction details (optional)
- Edit icon: Open edit modal
- Delete icon: Confirm and delete
- Bulk select: Select multiple → Bulk actions (delete, export, categorize)

#### 3. Add/Edit Transaction Modal (`<TransactionModal />`)

**Purpose**: Form to add or edit transaction

**Layout**: Centered modal overlay

**Form Fields**:

- Amount\* (number input, currency format)
- Date\* (date picker)
- Merchant\* (text input, autocomplete from history)
- Category (dropdown with icons)
- Card\* (dropdown)
- Description (textarea)
- Bill Period (auto-calculated, editable)
- Tags (optional, multi-select)

**Actions**:

- Cancel button
- Save button (green)

**Validation**:

- Required fields marked
- Amount: Positive number
- Date: Not future date (for expenses)
- Show field-level errors

**API Integration**:

- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- Request body:
  ```typescript
  {
    amount: number;
    transaction_date: string; // ISO date
    merchant: string;
    category?: string;
    card_id: string;
    description?: string;
    bill_month: number;
    bill_year: number;
  }
  ```

#### 4. Analytics Summary (`<TransactionAnalytics />`)

**Purpose**: Display summary statistics

**Layout**: Horizontal bar below table

**Metrics**:

- Total Transactions: Count
- Total Amount: Sum of all transactions
- This Month: Current month total
- Average Transaction: Average amount
- Largest Transaction: Max amount with merchant
- Most Used Category: Top category

**Styling**:

- Background: `#25282E`
- Grid layout: 6 columns
- Icons: Small colored circles
- Values: Bold, large numbers

**API Integration**:

- `GET /api/transactions/stats` - Fetch statistics
- Response:
  ```typescript
  {
    total: number;
    totalAmount: number;
    thisMonthTotal: number;
    averageAmount: number;
    largestTransaction: Transaction;
    topCategory: string;
  }
  ```

#### 5. Export Functionality (`<ExportButton />`)

**Purpose**: Export transactions to CSV/PDF

**Options**:

- Export Current View (filtered results)
- Export All Transactions
- Format: CSV, PDF, Excel

**API Integration**:

- `GET /api/transactions/export?format=csv&filters...` - Export endpoint
- Or client-side export using filtered data

### Right Sidebar Content (Transactions Page)

**Components**:

- Category breakdown chart (pie chart)
- Monthly spending trend (mini line chart)
- Top merchants list
- Quick filters (preset filter buttons)

### API Integrations Summary

**On Page Load**:

```typescript
GET /api/transactions?limit=25&page=1
GET /api/cards                    // For card filter
GET /api/transactions/stats       // For analytics summary
```

**On Filter Change**:

```typescript
GET /api/transactions?filters...  // With updated filters
```

**On Actions**:

```typescript
POST /api/transactions            // Add transaction
PUT /api/transactions/:id         // Update transaction
DELETE /api/transactions/:id      // Delete transaction
POST /api/transactions/bulk       // Bulk operations
```

### User Flows

1. **View All Transactions**:

   - Navigate to `/transactions` → Load transactions → Display table

2. **Filter Transactions**:

   - Select filters → Update URL → Reload data → Update table

3. **Search Transactions**:

   - Type in search → Debounce → Filter results → Update table

4. **Add Transaction**:

   - Click "Add Transaction" → Open modal → Fill form → Submit → Refresh table

5. **Edit Transaction**:

   - Click edit icon → Open modal with data → Update → Submit → Refresh

6. **Export Transactions**:
   - Click export → Select format → Download file

---

## Settings Page

**Route**: `/settings`

**Purpose**: Configure spending limits, email preferences, card management, and Gmail integration

**Layout**: Multi-section form with tabs or accordion

### Main Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header: "Settings"                                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Tabs: [Spending Limits] [Email] [Cards] [Gmail]     │ │
│  └──────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Active Tab Content                                  │ │
│  │  - Form sections                                     │ │
│  │  - Toggle switches                                   │ │
│  │  - Action buttons                                    │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Tab Navigation (`<SettingsTabs />`)

**Purpose**: Switch between settings sections

**Tabs**:

- Spending Limits
- Email Preferences
- Card Management
- Gmail Integration

**Styling**:

- Similar to card detail tabs
- Active: Dark background, white text
- Inactive: Transparent, gray text

#### 2. Spending Limits Section (`<SpendingLimitsSettings />`)

**Purpose**: Configure monthly spending limits and alert thresholds

**Layout**: Form with inputs and toggle switches

**Components**:

- **Monthly Limit**:

  - Input: Currency input for monthly limit
  - Label: "Monthly Spending Limit"
  - Helper text: "Set your monthly spending budget"

- **Alert Thresholds**:

  - Toggle: Enable/disable alerts
  - Threshold 1: 80% alert (toggle + input)
  - Threshold 2: 90% alert (toggle + input)
  - Threshold 3: 100% alert (always enabled)

- **Daily Transaction Limit** (optional):

  - Input: Daily limit amount
  - Toggle: Enable/disable daily limit

- **Save Button**: Green button to save settings

**Styling**:

- Form: `#25282E` background
- Inputs: Dark background, rounded
- Toggle switches: Green when enabled
- Section spacing: `32px`

**API Integration**:

- `GET /api/settings/spending-limit` - Fetch current limits
- `PUT /api/settings/spending-limit` - Update limits
- Request body:
  ```typescript
  {
    monthly_limit: number;
    alert_threshold: number; // Percentage
    is_active: boolean;
    daily_limit?: number;
  }
  ```

**Validation**:

- Monthly limit: Positive number
- Thresholds: 0-100 percentage
- Show success message on save

#### 3. Email Preferences Section (`<EmailPreferencesSettings />`)

**Purpose**: Configure email notification preferences

**Layout**: List of toggle switches with descriptions

**Components**:

- **Email Notifications**: Master toggle
- **Spending Limit Alerts**: Toggle
  - Sub-options: 80%, 90%, 100% thresholds
- **Bill Due Date Reminders**: Toggle
  - Days before: Input (e.g., 3 days before)
- **Unusual Transaction Alerts**: Toggle
- **Weekly Summary**: Toggle
- **Monthly Report**: Toggle

**Styling**:

- Toggle switches: Green accent
- Descriptions: Gray text below toggles
- Section dividers: Subtle borders

**API Integration**:

- `GET /api/settings/preferences` - Fetch preferences
- `PUT /api/settings/preferences` - Update preferences
- Request body:
  ```typescript
  {
    email_notifications_enabled: boolean;
    spending_limit_alerts: boolean;
    bill_reminders: boolean;
    bill_reminder_days: number;
    unusual_transaction_alerts: boolean;
    weekly_summary: boolean;
    monthly_report: boolean;
  }
  ```

#### 4. Card Management Section (`<CardManagementSettings />`)

**Purpose**: Manage cards (add, edit, delete, reorder)

**Layout**: List of cards with actions

**Components**:

- Card list (similar to cards page but simplified)
- "Add Card" button
- For each card:
  - Card preview
  - Edit button
  - Delete button
  - Toggle active/inactive
  - Drag handle (for reordering, optional)

**Styling**:

- Cards: Smaller preview, `#25282E` background
- Actions: Icon buttons
- Spacing: `16px` between cards

**API Integration**:

- Same as Cards View Page
- `PUT /api/cards/:id` - Update card (including is_active)
- Reordering: `PUT /api/cards/reorder` (if implemented)

#### 5. Gmail Integration Section (`<GmailIntegrationSettings />`)

**Purpose**: Connect/disconnect Gmail and manage integration

**Layout**: Card with connection status and actions

**Components**:

- **Connection Status**:

  - Status badge: Connected/Disconnected
  - Last sync time: "Last synced: 2 hours ago"
  - Email address: Connected Gmail account

- **Actions**:

  - "Connect Gmail" button (if disconnected)
  - "Disconnect" button (if connected)
  - "Sync Now" button (if connected)
  - "Scan Historical Emails" button (if connected)

- **Settings**:
  - Auto-sync toggle
  - Sync frequency: Dropdown (Real-time, Hourly, Daily)

**Styling**:

- Status badge: Green for connected, gray for disconnected
- Buttons: Green primary, gray secondary
- Card: `#25282E` background

**API Integration**:

- `GET /gmail/status` - Check connection status
- `POST /gmail/connect` - Initiate OAuth flow
- `POST /gmail/disconnect` - Disconnect account
- `POST /gmail/scan-historical` - Trigger historical scan
- Response format:
  ```typescript
  {
    connected: boolean;
    email?: string;
    last_sync?: string;
    auto_sync: boolean;
    sync_frequency: string;
  }
  ```

**OAuth Flow**:

1. Click "Connect Gmail" → Redirect to Google OAuth
2. User authorizes → Redirect back with code
3. Frontend sends code to backend → Backend completes OAuth
4. Update UI to show connected status

#### 6. Alert History Section (`<AlertHistorySettings />`)

**Purpose**: View alert history and notification logs

**Layout**: Table or list of alerts

**Components**:

- Alert list with:
  - Date/time
  - Alert type (badge)
  - Message
  - Status (read/unread)
- Mark as read action
- Clear all button

**Styling**:

- List: Dark background
- Unread: Bold text
- Read: Grayed out

**API Integration**:

- `GET /alerts/history` - Fetch alert history
- `PUT /alerts/history/:id/read` - Mark as read

### API Integrations Summary

**On Page Load**:

```typescript
GET / api / settings / spending - limit;
GET / api / settings / preferences;
GET / gmail / status;
GET / alerts / history;
```

**On Save**:

```typescript
PUT / api / settings / spending - limit;
PUT / api / settings / preferences;
PUT / alerts / preferences;
```

### User Flows

1. **Configure Spending Limits**:

   - Navigate to Settings → Spending Limits tab → Update values → Save → Success message

2. **Connect Gmail**:

   - Navigate to Settings → Gmail Integration → Click "Connect" → OAuth flow → Connected status

3. **Update Email Preferences**:

   - Navigate to Settings → Email Preferences → Toggle options → Save

4. **Manage Cards**:
   - Navigate to Settings → Card Management → Edit/Delete cards → Refresh list

---

## Authentication Pages

### Login Page

**Route**: `/login`

**Purpose**: Authenticate users via Google OAuth

**Layout**: Centered card on dark background

### Key Components

#### 1. Login Card (`<LoginCard />`)

**Purpose**: Display login form and Google OAuth button

**Layout**: Centered card, `400px width`

**Components**:

- Logo/App name: "Credit Card Tracker" (large, bold)
- Welcome message: "Sign in with your Google account to get started"
- Google Sign-In button: Large button with Google logo and text
- Footer: Privacy policy, terms of service links (optional)

**Styling**:

- Background: `#25282E` (card), `#1A1D21` (page)
- Card: Rounded corners (`12px`), padding `32px`
- Button: White background, Google colors, rounded
- Shadow: Subtle card shadow

**API Integration**:

- `POST /auth/google` - Initiate OAuth flow
- Redirects to Google OAuth consent screen
- Callback handled at `/auth/callback`

**User Flow**:

1. User clicks "Sign in with Google"
2. Redirect to Google OAuth
3. User authorizes
4. Redirect to `/auth/callback?code=xxx`
5. Frontend sends code to backend
6. Backend exchanges code → Creates/updates user → Returns JWT
7. Frontend stores JWT → Redirects to `/`

#### 2. Callback Handler (`/auth/callback`)

**Purpose**: Handle OAuth callback and store token

**Layout**: Loading state, then redirect

**Flow**:

- Extract `code` from URL
- Send to backend: `POST /auth/callback?code=xxx`
- Receive JWT token
- Store in httpOnly cookie
- Redirect to `/` or return URL

### Error States

**Components**:

- Error message display
- Retry button
- Support link

**Styling**:

- Error text: Red (`#E74C3C`)
- Retry button: Secondary style

---

## Reusable Components

### 1. Card Visual Component (`<CardVisual />`)

**Purpose**: Display credit card visual representation

**Props**:

```typescript
{
  cardName: string;
  cardNumber: string; // Masked or full
  expiryDate: string; // MM/YY format
  bankLogo?: string; // URL or component
  gradient?: string; // Color gradient
  orientation?: 'horizontal' | 'vertical';
  showChip?: boolean;
}
```

**Styling**:

- Gradient background based on card color
- Chip icon (SVG)
- Card number: Spaced format (\***\* \*\*** 4080)
- Expiry: MM/YY format
- Bank logo: Bottom right
- Shadow: Card-like depth

### 2. Progress Bar (`<ProgressBar />`)

**Purpose**: Display progress with percentage

**Props**:

```typescript
{
  value: number; // Current value
  max: number; // Maximum value
  label?: string;
  showPercentage?: boolean;
  color?: string; // Default: green
  size?: 'sm' | 'md' | 'lg';
}
```

**Styling**:

- Background: `#1A1D21`
- Fill: `#6ECB8E` (or custom color)
- Height: `8px` (md), `4px` (sm), `12px` (lg)
- Rounded edges
- Label above, percentage below or inside

### 3. Stat Card (`<StatCard />`)

**Purpose**: Display a statistic with icon and value

**Props**:

```typescript
{
  title: string;
  value: string | number;
  icon?: ReactNode;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  onClick?: () => void;
}
```

**Styling**:

- Background: `#25282E`
- Icon circle: Colored background, `48px`
- Value: Large, bold
- Title: Smaller, gray
- Hover: Scale effect

### 4. Data Table (`<DataTable />`)

**Purpose**: Reusable table component

**Props**:

```typescript
{
  columns: Column[];
  data: any[];
  loading?: boolean;
  pagination?: boolean;
  sortable?: boolean;
  selectable?: boolean;
  onRowClick?: (row: any) => void;
}
```

**Features**:

- Sortable columns
- Pagination
- Row selection
- Loading state
- Empty state
- Responsive (horizontal scroll on mobile)

### 5. Modal (`<Modal />`)

**Purpose**: Reusable modal component

**Props**:

```typescript
{
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}
```

**Styling**:

- Overlay: Dark background with opacity
- Modal: Centered, `#25282E` background
- Border radius: `12px`
- Shadow: Large elevation
- Animation: Fade in/out

### 6. Loading Skeleton (`<Skeleton />`)

**Purpose**: Display loading placeholders

**Props**:

```typescript
{
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave';
}
```

**Styling**:

- Background: `#2F3339`
- Animation: Pulse or wave effect
- Matches content shape

### 7. Badge (`<Badge />`)

**Purpose**: Display status badges or labels

**Props**:

```typescript
{
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md' | 'lg';
}
```

**Styling**:

- Rounded: `6px`
- Colors based on variant
- Padding: `4px 8px` (sm), `6px 12px` (md)

### 8. Dropdown (`<Dropdown />`)

**Purpose**: Custom styled dropdown/select

**Props**:

```typescript
{
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiSelect?: boolean;
}
```

**Styling**:

- Dark background
- Custom arrow icon
- Hover states
- Selected state highlight

### 9. Toggle Switch (`<Toggle />`)

**Purpose**: Toggle switch component

**Props**:

```typescript
{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}
```

**Styling**:

- Background: Gray when off, green when on
- Smooth transition
- Size: `44px × 24px`

### 10. Date Picker (`<DatePicker />`)

**Purpose**: Date selection component

**Props**:

```typescript
{
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
}
```

**Styling**:

- Dark theme calendar
- Green accent for selected date
- Month/year navigation

---

## User Flows & Navigation

### Main Navigation Flow

```
Login → Dashboard
  ├── Cards → Card Detail
  ├── Transactions → Transaction Detail (if implemented)
  └── Settings
```

### Key User Journeys

#### 1. First-Time User

1. Land on `/login`
2. Click "Sign in with Google"
3. Authorize → Redirect to `/`
4. See empty dashboard (or onboarding)
5. Add first card → Navigate to `/cards?add=true`
6. Complete setup → Return to dashboard

#### 2. Viewing Transactions

1. Dashboard → Click "View Transactions" or navigate to `/transactions`
2. See all transactions
3. Apply filters (month, card, category)
4. Click transaction → View details (if implemented)
5. Add transaction → Open modal → Submit → Refresh

#### 3. Managing Cards

1. Navigate to `/cards`
2. View all cards
3. Click card → View details at `/cards/[cardId]`
4. Edit card → Open modal → Update → Save
5. Add transaction → Select card → Fill form → Submit

#### 4. Setting Up Gmail Integration

1. Navigate to `/settings`
2. Go to "Gmail Integration" tab
3. Click "Connect Gmail"
4. Complete OAuth flow
5. Return to settings → See "Connected" status
6. Optionally click "Scan Historical Emails"
7. Wait for sync → See transactions appear

#### 5. Monitoring Spending Limits

1. Dashboard → View spending limit progress bar
2. Navigate to `/settings` → "Spending Limits"
3. Update monthly limit
4. Set alert thresholds
5. Save → Return to dashboard
6. Receive alerts when thresholds crossed

### Navigation Patterns

- **Breadcrumbs**: Show on detail pages (Dashboard > Cards > Card Name)
- **Back Button**: On detail pages, return to previous page
- **Active State**: Highlight current page in sidebar
- **Quick Actions**: Floating action button (FAB) for common actions (optional)

---

## Responsive Design

### Breakpoints

```css
/* Tailwind CSS breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Layout Adaptations

#### Mobile (< 768px)

**Sidebar**:

- Hidden by default
- Accessible via hamburger menu
- Overlay when open
- Bottom navigation as alternative

**Dashboard**:

- Single column layout
- Cards stack vertically
- KPI cards: 1 per row
- Right sidebar: Hidden, accessible via modal/drawer

**Tables**:

- Horizontal scroll
- Or card-based layout
- Stack columns vertically

**Modals**:

- Full-screen on mobile
- Swipe to dismiss

#### Tablet (768px - 1024px)

**Layout**:

- 2-column grid for cards
- Sidebar: Collapsible
- Right sidebar: Optional, can be hidden

#### Desktop (> 1024px)

**Layout**:

- Full 3-column layout (sidebar, main, right sidebar)
- Cards: 3-4 per row
- Tables: Full width with all columns

### Touch Interactions

- **Tap Targets**: Minimum `44px × 44px`
- **Swipe Gestures**: Swipe to dismiss modals, swipe between tabs
- **Pull to Refresh**: On list pages (optional)

---

## Accessibility Guidelines

### WCAG 2.1 AA Compliance

#### Color Contrast

- Text on dark background: Minimum 4.5:1 ratio
- Large text: Minimum 3:1 ratio
- Interactive elements: Clear focus states

#### Keyboard Navigation

- All interactive elements: Keyboard accessible
- Tab order: Logical flow
- Focus indicators: Visible (green outline, `2px solid #6ECB8E`)
- Skip links: Skip to main content

#### Screen Readers

- Semantic HTML: Use proper headings (`h1-h6`)
- ARIA labels: For icons and buttons
- Alt text: For images
- Form labels: Associated with inputs
- Error messages: Linked to form fields

#### Focus Management

- Modal focus trap: Focus stays within modal
- Focus restoration: Return focus after modal close
- Auto-focus: On form inputs when modal opens

### Component Accessibility

#### Buttons

- `role="button"` for custom buttons
- `aria-label` for icon-only buttons
- Keyboard: Enter/Space to activate

#### Forms

- `label` elements for all inputs
- `aria-describedby` for helper text
- `aria-invalid` for error states
- `aria-required` for required fields

#### Tables

- `thead` and `tbody` for structure
- `scope` attributes for headers
- `aria-sort` for sortable columns

#### Modals

- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` for title
- `aria-describedby` for content

### Testing

- **Keyboard Testing**: Navigate entire app with keyboard only
- **Screen Reader Testing**: Test with NVDA/JAWS/VoiceOver
- **Color Contrast**: Use tools to verify contrast ratios
- **Focus Indicators**: Ensure all focusable elements have visible focus

---

## Implementation Notes

### State Management

- **React Query**: For server state (API data)
- **Context API**: For global UI state (theme, user)
- **Local State**: For component-specific state (forms, modals)

### API Client Setup

```typescript
// lib/api.ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = Cookies.get("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Error Handling

- **Error Boundaries**: Catch React errors
- **API Errors**: Display user-friendly messages
- **Network Errors**: Show retry option
- **404/500**: Custom error pages

### Performance Optimization

- **Code Splitting**: Lazy load routes
- **Image Optimization**: Next.js Image component
- **Memoization**: Use `React.memo`, `useMemo`, `useCallback`
- **Virtualization**: For long lists (react-window)
- **Debouncing**: For search inputs

### Testing Strategy

- **Unit Tests**: Component tests with React Testing Library
- **Integration Tests**: Test user flows
- **E2E Tests**: Critical paths with Playwright/Cypress

---

## Conclusion

This document provides a comprehensive guide for implementing the frontend of the Credit Card Tracking Dashboard. All components, pages, and interactions are detailed with:

- Clear component specifications
- API integration points
- Styling guidelines based on the dark theme
- User flows and navigation patterns
- Responsive design considerations
- Accessibility requirements

Use this document as a reference when building the frontend components in React/Next.js with TailwindCSS, ensuring consistency with the design system and architecture requirements.



Major Missing Features
Critical Missing Pages & Components:
Card Detail View Page (/cards/[cardId]) - This is a major missing page with tabs for Transactions, Insights, and Statement views
OAuth Callback Handler (/auth/callback) - Missing authentication callback page
Analytics/Insights Components - Chart components for spending trends, category breakdowns, monthly comparisons

Missing UI Components:
Dropdown Component - Custom styled dropdown/select component specified in reusable components
DatePicker Component - Date selection component needed for filtering and forms

Missing Infrastructure:
Custom React Hooks - The hooks directory is empty but hooks are mentioned for data fetching, forms, state management
Error Handling Components - No error boundaries, 404/500 pages, or error handling components exist
Comprehensive Test Suite - Only one test file exists, missing unit/integration/E2E tests

Missing User Experience Features:
Responsive Design Optimization - Need to ensure proper mobile/tablet/desktop behavior
Accessibility Features - WCAG 2.1 AA compliance (ARIA labels, keyboard navigation, screen readers)
Advanced Filtering & Search - Date ranges, multi-select, saved presets, debounced search
Form Validation Enhancement - Field-level validation, better error messages
Export Functionality - CSV/PDF/Excel export for transactions and reports
Notification System - Toast notifications, alerts, notification center
Missing Advanced Features:
Performance Optimizations - Code splitting, lazy loading, memoization, virtualization
Real-time Features - Live updates, WebSocket connections, sync progress
Enhanced Gmail Integration UI - Better status indicators, sync progress, connection management
Bulk Operations - Bulk select/delete/categorize for transactions and cards
User Onboarding Flow - First-time user experience and setup guidance
Offline Capability - Service worker, data caching, offline sync