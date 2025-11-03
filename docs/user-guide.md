# Credit Card Dashboard - User Guide

**Welcome to the Credit Card Dashboard!** 🎉  
Your personal financial command center for managing all your credit cards in one place.

---

## 📚 Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Credit Cards](#managing-credit-cards)
4. [Tracking Transactions](#tracking-transactions)
5. [Gmail Integration](#gmail-integration)
6. [Budget Management](#budget-management)
7. [Analytics & Reports](#analytics--reports)
8. [Alerts & Notifications](#alerts--notifications)
9. [Recurring Transactions](#recurring-transactions)
10. [Export & Reports](#export--reports)
11. [Tips & Best Practices](#tips--best-practices)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## 🚀 Getting Started

### First Time Setup

#### Step 1: Sign In with Google

1. Click **"Sign in with Google"** on the login page
2. Select your Google account
3. Grant necessary permissions:
   - Gmail read access (for transaction extraction)
   - Basic profile information
4. You'll be redirected to your dashboard

#### Step 2: Add Your First Credit Card

1. Click **"Add Card"** button in the dashboard
2. Fill in card details:
   - **Card Name:** e.g., "HDFC Regalia"
   - **Bank Name:** e.g., "HDFC Bank"
   - **Last 4 Digits:** For identification
   - **Bill Date:** Day of month when bill is generated
   - **Due Date:** Payment due date
   - **Credit Limit:** Your card's credit limit
3. Click **"Save"**

#### Step 3: Set Your Monthly Budget (Optional)

1. Go to **Settings** → **Budget**
2. Set your monthly spending limit
3. Configure alert thresholds (50%, 75%, 90%)
4. Save your preferences

#### Step 4: Connect Gmail (Optional but Recommended)

1. Click **"Connect Gmail"** in Settings
2. Authorize Gmail access
3. The system will start monitoring your inbox for transaction emails
4. Existing transactions will be scanned automatically

---

## 📊 Dashboard Overview

### Main Dashboard Components

#### 1. **Summary Cards** (Top Section)

- **Total Cards:** Number of active credit cards
- **Current Month Spending:** Total spent this month
- **Budget Status:** Percentage of budget used
- **Upcoming Bills:** Number of bills due soon

#### 2. **Spending Chart** (Center)

- Visual representation of daily/weekly/monthly spending
- Toggle between different time periods
- Color-coded by category

#### 3. **Recent Transactions** (Left Panel)

- Last 10 transactions across all cards
- Shows merchant, amount, date, and card
- Click any transaction for details

#### 4. **Quick Actions** (Right Panel)

- Add Transaction
- Add Card
- View All Transactions
- View Analytics
- Connect Gmail

---

## 💳 Managing Credit Cards

### Adding a New Card

**Method 1: Manual Entry**

1. Navigate to **Cards** page
2. Click **"Add New Card"** button
3. Fill in the form:
   ```
   Card Name: HDFC Regalia
   Bank Name: HDFC Bank
   Card Type: Credit
   Last 4 Digits: 1234
   Bill Date: 15
   Due Date: 5
   Credit Limit: 500000
   Activation Date: 01/01/2024
   ```
4. Click **"Save Card"**

**Method 2: Import from Statement**

1. Go to **Cards** → **Import**
2. Upload credit card statement (PDF)
3. System extracts card details automatically
4. Review and confirm

### Editing Card Information

1. Go to **Cards** page
2. Click on the card you want to edit
3. Click **"Edit"** button
4. Update any field
5. Click **"Save Changes"**

### Deactivating vs. Deleting Cards

**Deactivate:**

- Keeps all transaction history
- Hides from active card list
- Can be reactivated later
- Use when you close a card but want history

**Delete:**

- Permanently removes card
- Removes associated transactions
- Cannot be undone
- Use only if added by mistake

### Card Color Coding

Each card automatically gets a unique color for easy identification in charts and lists. You can customize this in card settings.

---

## 💰 Tracking Transactions

### Adding Transactions Manually

1. Click **"Add Transaction"** button
2. Select **Card** from dropdown
3. Enter transaction details:
   - **Merchant Name:** e.g., "Starbucks"
   - **Amount:** e.g., 450
   - **Date:** Transaction date
   - **Category:** Select from list
   - **Description:** (Optional) Additional notes
4. Click **"Add Transaction"**

### Editing Transactions

1. Go to **Transactions** page
2. Click on transaction to edit
3. Modify any field
4. Click **"Save"**

### Bulk Import Transactions

**From CSV File:**

1. Go to **Transactions** → **Import**
2. Download CSV template
3. Fill in your transactions following the format:
   ```csv
   Date,Merchant,Amount,Category,Card Name,Description
   2024-11-01,Amazon,2500,Shopping,HDFC Regalia,Online purchase
   2024-11-02,Swiggy,450,Food & Dining,HDFC Regalia,Dinner
   ```
4. Upload filled CSV
5. Review imported transactions
6. Click **"Confirm Import"**

**From Bank Statement:**

1. Go to **Transactions** → **Import from Statement**
2. Upload PDF statement
3. System extracts transactions using OCR
4. Review and correct any errors
5. Click **"Import"**

### Transaction Categories

Available categories:

- 🛒 **Shopping**
- 🍔 **Food & Dining**
- ⛽ **Transportation**
- 💊 **Healthcare**
- 🎬 **Entertainment**
- 📱 **Utilities**
- ✈️ **Travel**
- 📚 **Education**
- 🏠 **Home**
- 💼 **Business**
- 🎁 **Gifts**
- 🔧 **Services**
- 💸 **Others**

### Filtering & Searching

**Filter by:**

- Date range
- Card
- Category
- Amount range
- Merchant name

**Search:**

- Type merchant name in search box
- Results update in real-time

**Sort by:**

- Date (newest first/oldest first)
- Amount (high to low/low to high)
- Merchant (A-Z)

---

## 📧 Gmail Integration

### Setting Up Gmail Integration

#### Step 1: Connect Gmail

1. Go to **Settings** → **Gmail Integration**
2. Click **"Connect Gmail"**
3. Sign in with your Google account
4. Grant read-only Gmail access
5. Wait for confirmation

#### Step 2: Historical Scan (First Time)

1. After connecting, you'll see **"Scan Email History"**
2. Select date range (e.g., last 6 months)
3. Click **"Start Scan"**
4. Monitor progress in real-time
5. Review extracted transactions

### How It Works

The system monitors your Gmail inbox for transaction emails from:

- Credit card banks (HDFC, ICICI, Axis, SBI, etc.)
- Payment gateways (PayTM, PhonePe, GPay, etc.)
- Merchants (Amazon, Flipkart, Swiggy, etc.)

**Real-time Processing:**

- New emails are detected within seconds
- Transactions are extracted automatically
- Duplicates are prevented
- Confidence scoring ensures accuracy

### Managing Extracted Transactions

**Review Queue:**

1. Go to **Transactions** → **Review**
2. See all auto-extracted transactions
3. Each transaction shows:
   - Confidence score (0-100%)
   - Source email
   - Extracted details
4. Actions:
   - **Approve:** Add to transactions
   - **Edit & Approve:** Correct details then add
   - **Reject:** Skip this transaction

### Email Classification

Emails are classified as:

- ✅ **Transaction Confirmed:** High confidence, auto-added
- ⚠️ **Needs Review:** Medium confidence, manual review required
- ❌ **Not Transaction:** Promotional/informational emails
- 🔍 **Uncertain:** Couldn't extract details

### Troubleshooting Gmail Integration

**Issue: Transactions not being extracted**

- Check Gmail connection status
- Verify emails are not in Spam
- Ensure emails are from known banks/merchants
- Try manual extraction for that email

**Issue: Duplicate transactions**

- System has built-in duplicate detection
- If duplicates occur, delete extras manually
- Report the issue for pattern improvement

**Issue: Incorrect amounts or details**

- Edit transaction in Review Queue
- Report extraction error for pattern improvement
- Consider manual entry for complex statements

---

## 💵 Budget Management

### Setting Up Monthly Budget

1. Go to **Budget** page
2. Click **"Set Budget"**
3. Enter monthly limit (e.g., ₹50,000)
4. Click **"Save"**

### Category-Wise Budgets

1. In Budget page, click **"Category Budgets"**
2. Set limits for each category:
   ```
   Shopping: ₹20,000
   Food & Dining: ₹10,000
   Transportation: ₹5,000
   Entertainment: ₹5,000
   Others: ₹10,000
   ```
3. System tracks spending against each category

### Budget Alerts

You'll receive alerts at:

- **50%** - Halfway through budget
- **75%** - Three-quarters used
- **90%** - Near limit
- **100%** - Budget exceeded

**Alert Channels:**

- In-app notifications
- Email (if enabled)
- Browser push notifications (if enabled)

### Budget History

View past months' budget performance:

1. Go to **Budget** → **History**
2. See monthly comparison
3. Identify spending patterns
4. Adjust future budgets accordingly

---

## 📈 Analytics & Reports

### Spending Analytics

#### Monthly Overview

- Total spending
- Category breakdown
- Top merchants
- Spending trends
- Comparison with last month

#### Visual Charts

- **Pie Chart:** Category-wise distribution
- **Bar Chart:** Daily/weekly spending
- **Line Chart:** Spending trends over time
- **Heatmap:** Spending by day of week

### Spending Trends

1. Go to **Analytics** → **Trends**
2. Select time period (week/month/quarter/year)
3. See:
   - Spending patterns
   - Peak spending days
   - Category trends
   - Forecast for next month

### Card-Wise Analysis

Compare spending across cards:

1. Go to **Analytics** → **Cards**
2. See usage distribution
3. Identify most-used card
4. Optimize card usage for rewards

### Merchant Analysis

1. Go to **Analytics** → **Merchants**
2. See:
   - Top 10 merchants
   - Spending by merchant
   - Frequency of visits
   - Average transaction value

---

## 🔔 Alerts & Notifications

### Types of Alerts

1. **Budget Alerts**

   - Budget threshold crossed
   - Category budget exceeded
   - Unusual spending detected

2. **Bill Reminders**

   - Bill generation date approaching
   - Payment due date approaching
   - Overdue payment warning

3. **Transaction Alerts**

   - Large transaction detected (> ₹10,000)
   - International transaction
   - Multiple transactions in short time

4. **System Alerts**
   - Gmail scan complete
   - Export ready for download
   - Card expiry approaching

### Managing Alerts

**View Alerts:**

1. Click bell icon 🔔 in header
2. See all unread alerts
3. Click alert to see details

**Mark as Read:**

- Click on alert
- Or click "Mark all as read"

**Alert Settings:**

1. Go to **Settings** → **Notifications**
2. Toggle alert types on/off
3. Choose notification channels:
   - In-app
   - Email
   - Push notifications

---

## 🔄 Recurring Transactions

### Setting Up Subscriptions

Perfect for Netflix, Spotify, gym memberships, etc.

1. Go to **Recurring** → **Add New**
2. Fill in details:
   ```
   Merchant: Netflix
   Amount: 649
   Category: Entertainment
   Card: HDFC Regalia
   Frequency: Monthly
   Start Date: 01/12/2024
   Day of Month: 1
   ```
3. Click **"Create"**

### Managing Recurring Transactions

**View All Recurring:**

- See list of all subscriptions
- Status (Active/Paused/Canceled)
- Next execution date
- Execution history

**Actions:**

- **Pause:** Temporarily stop execution
- **Resume:** Restart paused subscription
- **Edit:** Change amount or frequency
- **Cancel:** Stop permanently

### Execution & History

- Automatic execution on scheduled dates
- Weekend/holiday skip options
- Execution confirmation alerts
- Full history with dates and amounts
- Failed execution notifications

---

## 📤 Export & Reports

### Exporting Transactions

**CSV Export:**

1. Go to **Transactions**
2. Click **"Export"** button
3. Select date range
4. Choose cards (or all)
5. Click **"Download CSV"**

**Excel Export:**

- Same as CSV but Excel-compatible
- Includes UTF-8 BOM for proper encoding
- Opens correctly in Excel

### Generating Reports

**Monthly Summary Report (PDF):**

1. Go to **Reports** → **Generate**
2. Select month and year
3. Choose report type:
   - Summary
   - Detailed
   - Category Analysis
   - Card Comparison
4. Click **"Generate PDF"**
5. Download when ready

**Report Contents:**

- Summary statistics
- Spending charts
- Category breakdown
- Top merchants
- Budget vs. actual
- Recommendations

---

## 💡 Tips & Best Practices

### Daily Habits

✅ Review transactions daily (takes 2 minutes)  
✅ Categorize transactions immediately  
✅ Check email integration status  
✅ Update any missing transactions

### Weekly Tasks

✅ Review spending vs. budget  
✅ Check upcoming bills  
✅ Review and approve extracted transactions  
✅ Update recurring transactions if needed

### Monthly Rituals

✅ Generate monthly report  
✅ Review spending patterns  
✅ Adjust category budgets  
✅ Export data for records  
✅ Clear old notifications

### Pro Tips

**Tip 1: Use Categories Consistently**

- Always use the same category for similar transactions
- This makes analytics more meaningful
- Create custom categories if needed

**Tip 2: Add Notes to Transactions**

- Helps remember context later
- Useful for returns/refunds
- Makes reconciliation easier

**Tip 3: Set Realistic Budgets**

- Start with tracking for a month
- Then set budgets based on actual spending
- Adjust gradually, don't cut too aggressively

**Tip 4: Enable Gmail Integration**

- Saves 90% of manual entry time
- Real-time updates
- Never miss a transaction

**Tip 5: Review Weekly, Not Daily**

- Daily reviews can be stressful
- Weekly reviews are sufficient
- Monthly deep-dive for planning

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Issue: Transactions not showing up

**Solution:**

1. Check if card is active
2. Verify date filters aren't hiding transactions
3. Try clearing browser cache
4. Check if transaction date is within selected range

#### Issue: Gmail integration not working

**Solution:**

1. Go to Settings → Gmail Integration
2. Check connection status
3. If disconnected, reconnect Gmail
4. Verify Gmail permissions are granted
5. Try re-authorizing access

#### Issue: Budget not updating

**Solution:**

1. Ensure transactions are properly categorized
2. Check if transactions are in current month
3. Clear cache and refresh page
4. Wait a few minutes for calculation (uses caching)

#### Issue: Charts not loading

**Solution:**

1. Check internet connection
2. Clear browser cache
3. Try different browser
4. Disable browser extensions temporarily

#### Issue: Duplicate transactions

**Solution:**

1. Manual: Delete duplicates from Transactions page
2. System should prevent duplicates automatically
3. If persistent, report the issue

#### Issue: Login problems

**Solution:**

1. Clear browser cookies
2. Try incognito/private mode
3. Ensure Google account is active
4. Check if pop-ups are blocked
5. Try different browser

---

## ❓ FAQ

### General Questions

**Q: Is my data secure?**  
A: Yes! We use:

- Bank-grade encryption (AES-256)
- Secure HTTPS connections
- Google OAuth for authentication
- Read-only Gmail access
- Data stored in secure cloud (Supabase)
- Regular security audits

**Q: Can I use this on mobile?**  
A: Yes! The dashboard is fully responsive and works on:

- Mobile browsers (iOS Safari, Chrome)
- Tablets
- Desktop computers

**Q: How much does it cost?**  
A: Currently free! Future premium features may be added.

**Q: Can I track debit cards too?**  
A: Yes! Add them as cards with appropriate bill/due dates.

### Transaction Questions

**Q: How do I delete a transaction?**  
A: Go to transaction details → Click delete → Confirm

**Q: Can I edit past transactions?**  
A: Yes, click on any transaction to edit it.

**Q: What if I make a mistake?**  
A: All actions can be undone or edited. Just update the transaction.

**Q: How to handle refunds?**  
A: Add as a transaction with negative amount or "credit" type.

### Gmail Integration Questions

**Q: Which banks are supported?**  
A: We support 50+ Indian banks including:

- HDFC, ICICI, SBI, Axis, Kotak
- American Express, Citibank
- Regional banks
- _Pattern matching is continuously improved_

**Q: Is Gmail access safe?**  
A: Yes! We only request:

- Read-only access
- Never send emails
- Never modify/delete emails
- Google OAuth security standards

**Q: Can I disconnect Gmail?**  
A: Yes! Go to Settings → Gmail → Disconnect.  
Past extracted transactions remain.

**Q: What about privacy?**  
A: We only:

- Read transaction-related emails
- Don't access personal emails
- Don't store email content
- Only extract transaction data

### Budget & Analytics Questions

**Q: Can I have different budgets for different months?**  
A: Yes! Update budget at the start of each month.

**Q: How are categories determined?**  
A: You assign categories manually or use auto-suggestions.

**Q: Can I export my data?**  
A: Yes! Export anytime in CSV, Excel, or PDF format.

---

## 📞 Support & Feedback

### Need Help?

- **Email:** support@creditcard-dashboard.com
- **Documentation:** [docs.creditcard-dashboard.com](https://docs.creditcard-dashboard.com)
- **Video Tutorials:** [youtube.com/@creditcard-dashboard](https://youtube.com)

### Report a Bug

1. Go to Settings → Help & Support
2. Click "Report Issue"
3. Describe the problem with screenshots
4. We'll respond within 24 hours

### Feature Requests

We love hearing from users!

- Email: features@creditcard-dashboard.com
- Include: Feature description + use case

### Community

- Discord: [discord.gg/creditcard-dashboard](https://discord.gg)
- Twitter: [@CCDashboard](https://twitter.com)

---

## 🎓 Video Tutorials

Coming soon! Subscribe to our YouTube channel for:

- Getting started guide
- Gmail integration setup
- Budget management tips
- Advanced analytics
- Power user features

---

**Last Updated:** November 4, 2025  
**Version:** 1.0.0  
**Need help?** Contact support@creditcard-dashboard.com

---

_Happy tracking! 🎉_
