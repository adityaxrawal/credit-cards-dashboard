# 🧪 Phase 2 Testing Guide

## Quick Start Testing Commands

### Backend Tests

```bash
# Test Gmail Sync Service
cd backend/services/gmail-service
npm test

# Test API Gateway Services
cd backend/services/api-gateway
npm test

# Test specific route
npm test -- sync.routes.test.ts
```

### Frontend Tests

```bash
cd frontend
npm test

# Test specific component
npm test -- GmailSyncButton.test.tsx
```

---

## Manual Testing with Postman

### 1. Test Manual Sync Endpoint

**Request:**
```
POST http://localhost:3004/gmail/sync
Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json
```

**Expected Response:**
```json
{
  "success": true,
  "summary": {
    "emailsScanned": 50,
    "transactionEmailsFound": 12,
    "newTransactions": 10,
    "duplicatesSkipped": 2,
    "processingTime": "8.42s"
  },
  "lastSync": "2025-11-04T10:30:00Z",
  "nextSyncRecommended": "2025-11-04T11:00:00Z"
}
```

### 2. Test Last Sync Endpoint

**Request:**
```
GET http://localhost:3004/gmail/last-sync/<USER_ID>
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Expected Response:**
```json
{
  "success": true,
  "lastSync": "2025-11-04T10:30:00Z",
  "gmailConnected": true
}
```

### 3. Test Budget Update Service

**Request:**
```
POST http://localhost:3001/services/update-budget
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Expected Response:**
```json
{
  "success": true,
  "budget": {
    "limit": 30000,
    "spent": 25000,
    "remaining": 5000,
    "percentage": "83.33",
    "status": "warning"
  }
}
```

### 4. Test Alert Check Service

**Request:**
```
POST http://localhost:3001/services/check-alerts
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Expected Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "budget_warning",
      "priority": "medium",
      "title": "Budget Warning",
      "message": "You've used 83.3% of your monthly budget"
    }
  ]
}
```

---

## Browser Testing

### Test Auto-Sync on Dashboard Load

1. Open browser developer console (F12)
2. Navigate to dashboard
3. Look for console logs:
   - "Auto-syncing Gmail (>30 min since last sync)"
4. Wait 30-60 seconds
5. Dashboard should refresh automatically

### Test Manual Sync Button

1. Click "Sync Gmail" button
2. Verify:
   - Button shows "Syncing Gmail..." with spinning icon
   - Button is disabled during sync
   - "This may take 10-30 seconds..." message appears
3. After sync:
   - Success toast appears
   - "Last synced: X:XX PM" displays
   - Button re-enables
4. Check:
   - New transactions in list
   - Budget percentage updated
   - Alerts/reminders shown

---

## Database Verification

### Check Transactions Table

```sql
-- Check for new transactions
SELECT * FROM transactions 
WHERE user_id = '<USER_ID>' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for duplicates
SELECT email_message_id, COUNT(*) 
FROM transactions 
WHERE user_id = '<USER_ID>' 
GROUP BY email_message_id 
HAVING COUNT(*) > 1;
```

### Check Budget Tracking

```sql
-- Check current month budget
SELECT * FROM budget_tracking 
WHERE user_id = '<USER_ID>' 
  AND month = EXTRACT(MONTH FROM CURRENT_DATE)
  AND year = EXTRACT(YEAR FROM CURRENT_DATE);
```

### Check Last Sync Time

```sql
-- Check user's last Gmail sync
SELECT last_gmail_sync, gmail_connected 
FROM users 
WHERE id = '<USER_ID>';
```

---

## Error Scenarios to Test

### 1. No Gmail Connection

**Setup:** Disconnect Gmail in settings

**Expected:**
- Button shows error: "Gmail not connected"
- 403 response from API

### 2. Rate Limiting

**Setup:** Click sync button 11 times quickly

**Expected:**
- First 10 succeed
- 11th returns 429 error
- Error toast: "Too many requests. Please try again later."

### 3. Invalid Token

**Setup:** Use expired or invalid JWT token

**Expected:**
- 401 Unauthorized response
- Redirect to login page

### 4. Cold Start (Render)

**Setup:** Wait 15 minutes, then sync

**Expected:**
- First request takes 30-45 seconds
- "This may take 10-30 seconds..." message shows
- Second request is fast (<5 seconds)

---

## Performance Testing

### Measure Sync Time

```javascript
// In browser console
console.time('sync');
// Click sync button
// After completion:
console.timeEnd('sync');
```

**Expected Times:**
- Warm server: 5-15 seconds
- Cold start: 30-45 seconds

### Monitor API Calls

1. Open Network tab in DevTools
2. Click "Sync Gmail"
3. Verify sequence:
   - POST /gmail/sync (1 call)
   - POST /services/update-budget (1 call)
   - POST /services/check-alerts (1 call)
   - POST /services/check-reminders (1 call)
   - POST /services/refresh-analytics (1 call)
4. All 4 service calls should happen in parallel

---

## Environment-Specific Tests

### Local Development
```bash
# Start services
cd backend/services/gmail-service
npm run dev

cd backend/services/api-gateway
npm run dev

cd frontend
npm run dev
```

### Production (Render + Vercel)
- Test with production URLs
- Verify CORS settings
- Check environment variables
- Monitor Render logs

---

## Debugging Tips

### Backend Logs
```bash
# Gmail Service logs
cd backend/services/gmail-service
npm run dev | grep "sync"

# API Gateway logs
cd backend/services/api-gateway
npm run dev | grep "services"
```

### Frontend Console
```javascript
// Listen for sync events
window.addEventListener('transactions-updated', () => {
  console.log('Transactions updated!');
});

window.addEventListener('refresh-dashboard', () => {
  console.log('Dashboard refreshed!');
});

// Listen for toast events
window.addEventListener('show-toast', (e) => {
  console.log('Toast:', e.detail);
});
```

---

## Checklist Before Deployment

- [ ] All unit tests passing
- [ ] Manual sync works in local environment
- [ ] Auto-sync works on dashboard load
- [ ] Deduplication prevents duplicates
- [ ] Rate limiting blocks after 10 requests
- [ ] All 4 downstream services trigger correctly
- [ ] Budget updates reflect in UI
- [ ] Alerts appear for budget thresholds
- [ ] Reminders show for upcoming bills
- [ ] Analytics cache refreshes
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] Database queries optimized
- [ ] Environment variables set in production

---

**Ready to Deploy!** 🚀
