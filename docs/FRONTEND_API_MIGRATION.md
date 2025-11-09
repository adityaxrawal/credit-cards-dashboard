# Frontend API Migration Guide

## Progress: Migrating 55 fetch() calls to apiClient

### Files to Migrate:

1. ✅ `/lib/api-client.ts` - Already uses apiClient (core utility)
2. ⏳ `/lib/api/client.ts` - 2 fetch calls
3. ⏳ `/lib/api/settings.ts` - 4 fetch calls
4. ⏳ `/lib/auth/token-refresh.ts` - 3 fetch calls
5. ⏳ `/lib/auth/AuthContext.tsx` - 3 fetch calls
6. ⏳ `/lib/hooks/useCards.ts` - 5 fetch calls
7. ⏳ `/lib/hooks/useTransactions.ts` - 7 fetch calls
8. ⏳ `/components/gmail/HistoricalScanProgress.tsx` - 3 fetch calls
9. ⏳ `/components/gmail/ManualReviewQueue.tsx` - 3 fetch calls
10. ⏳ `/components/transactions/RecurringTransactionsList.tsx` - 4 fetch calls
11. ⏳ `/components/layout/NotificationBell.tsx` - 4 fetch calls
12. ⏳ `/components/settings/GmailIntegrationCard.tsx` - 3 fetch calls
13. ⏳ `/components/dashboard/RemindersWidget.tsx` - 1 fetch call
14. ⏳ `/components/feedback/FeedbackWidget.tsx` - 1 fetch call
15. ⏳ `/app/(dashboard)/reports/page.tsx` - 2 fetch calls
16. ⏳ `/app/(dashboard)/layout.tsx` - 1 fetch call
17. ⏳ `/app/(auth)/login/page.tsx` - 1 fetch call
18. ⏳ `/app/(dashboard)/dashboard/page.tsx` - 2 fetch calls
19. ⏳ `/app/(dashboard)/rewards/page.tsx` - 1 fetch call
20. ⏳ `/app/(dashboard)/admin/health/page.tsx` - 2 fetch calls
21. ⏳ `/middleware.ts` - 1 fetch call

### Migration Pattern:

**Old:**

```ts
const response = await fetch(`${API_URL}/api/endpoint`, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  credentials: "include",
});
const data = await response.json();
```

**New:**

```ts
import apiClient from "@/lib/api-client";
import { toastService } from "@/lib/utils/toast";

try {
  const response = await apiClient.get("/api/endpoint");
  const data = response.data;
} catch (error) {
  toastService.handleApiError(error);
}
```

### Benefits:

- ✅ Automatic token injection
- ✅ 45s timeout for cold starts
- ✅ Centralized error handling
- ✅ Automatic 401 redirect
- ✅ Type-safe responses
- ✅ Consistent retry logic
- ✅ Toast notifications on error

### Status:

- Total Files: 21
- Files Migrated: 0
- Remaining: 21
- Progress: 0%
