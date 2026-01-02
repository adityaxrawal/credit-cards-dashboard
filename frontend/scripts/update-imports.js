const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

// Function to walk directory
function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
}

const files = walkSync(SRC_ROOT);

const replacements = [
  // Shared Components
  { from: '@/components/ui/', to: '@/shared/components/ui/' },
  { from: '@/components/common/', to: '@/shared/components/common/' },
  { from: '@/components/layout/', to: '@/shared/components/layout/' },
  
  // Shared Utils & API
  { from: '@/lib/utils/', to: '@/shared/utils/' },
  { from: '@/lib/utils', to: '@/shared/utils' }, // Handle no slash
  { from: '@/lib/api/client', to: '@/shared/api/client' },
  { from: '@/lib/api/core/client', to: '@/shared/api/core-client' },
  { from: '@/lib/api/currency', to: '@/shared/utils/currency' },

  // Services
  { from: '@/lib/api/services/cards.service', to: '@/features/cards/api/service' },
  { from: '@/lib/api/services/transactions.service', to: '@/features/transactions/api/service' },

  // Shared Hooks
  { from: '@/lib/hooks/useDebounce', to: '@/shared/hooks/useDebounce' },
  { from: '@/lib/hooks/useForm', to: '@/shared/hooks/useForm' },
  { from: '@/lib/hooks/usePerformance', to: '@/shared/hooks/usePerformance' },
  { from: '@/lib/hooks/useStorage', to: '@/shared/hooks/useStorage' },
  { from: '@/lib/hooks/useApi', to: '@/shared/hooks/useApi' },
  { from: '@/lib/hooks/useApiLoader', to: '@/shared/hooks/useApiLoader' },
  { from: '@/lib/hooks/useCursorPagination', to: '@/shared/hooks/useCursorPagination' },
  { from: '@/lib/hooks/usePushNotifications', to: '@/shared/hooks/usePushNotifications' },

  // Handle old Aliases
  { from: '@/hooks/useDashboardData', to: '@/features/dashboard/hooks/useDashboardData' },
  { from: '@/hooks/useDashboardHooks', to: '@/features/dashboard/hooks/useDashboardHooks' },
  { from: '@/hooks/useTransactions', to: '@/features/transactions/hooks/useTransactions' },
  { from: '@/hooks/useCards', to: '@/features/cards/hooks/useCards' },
  { from: '@/hooks/', to: '@/shared/hooks/' }, // Fallback for generic hooks

  // Shared Components (Handle no slash)
  { from: '@/components/ui', to: '@/shared/components/ui' },
  { from: '@/components/common', to: '@/shared/components/common' },
  { from: '@/components/layout', to: '@/shared/components/layout' },
  
  // Fix relative imports in moved API files
  // They often imported '../api-client' or './client'
  { from: '../api-client', to: '@/lib/api-client' }, 
  { from: '../client', to: '@/shared/api/client' },
  { from: './client', to: '@/shared/api/client' }, // Add this
  { from: './core/client', to: '@/shared/api/core-client' },

  // Fix deep relative imports (brittle, but helpful for common patterns)
  { from: '../../../components/ui', to: '@/shared/components/ui' },
  { from: '../../../components/features', to: '@/features' },

  // Barrel File Specific Mappings (Manual based on old index.ts)
  { from: '@/components/features/gmail/GmailSyncButton', to: '@/features/gmail/components/GmailSyncButton' },
  { from: '@/components/features/gmail/ManualReviewQueue', to: '@/features/gmail/components/ManualReviewQueue' },
  { from: '@/components/features/dashboard/SpendingTrendChart', to: '@/features/dashboard/components/SpendingTrendChart' },
  { from: '@/components/features/dashboard/TransactionsPreview', to: '@/features/dashboard/components/TransactionsPreview' },
  { from: '@/components/features/dashboard/CardsPreview', to: '@/features/dashboard/components/CardsPreview' },
  { from: '@/components/features/dashboard/RemindersWidget', to: '@/features/dashboard/components/RemindersWidget' },
  { from: '@/components/features/dashboard/InventoryDetailsCard', to: '@/features/dashboard/components/InventoryDetailsCard' },
  { from: '@/components/features/transactions/TransactionFilters', to: '@/features/transactions/components/TransactionFilters' },
  { from: '@/components/features/transactions/BulkImportModal', to: '@/features/transactions/components/BulkImportModal' },
  { from: '@/components/features/transactions/RecurringTransactionsList', to: '@/features/transactions/components/RecurringTransactionsList' },
  { from: '@/components/features/analytics/Charts', to: '@/features/analytics/components/Charts' },
  { from: '@/components/features/rewards/RedemptionModal', to: '@/features/rewards/components/RedemptionModal' },
  { from: '@/components/features/settings/GmailIntegrationCard', to: '@/features/settings/components/GmailIntegrationCard' },
  { from: '@/components/features/statements/FileUpload', to: '@/features/statements/components/FileUpload' },
  { from: '@/components/features/statements/StatementList', to: '@/features/statements/components/StatementList' },

  // Features Components Generic
  // Pattern: @/components/features/XYZ -> @/features/XYZ/components
];

// Feature List for Components/APIs
const features = [
  'accounts', 'analytics', 'auth', 'budget', 'cards', 'dashboard',
  'gmail', 'goals', 'ingestion', 'loans', 'onboarding', 'reports',
  'review', 'rewards', 'rules', 'settings', 'statements', 'transactions',
  'alerts', 'bills', 'recurring', 'shared-expenses', 'transfers'
];

features.forEach(feature => {
    // Components
    replacements.push({ 
        from: `@/components/features/${feature}/`, 
        to: `@/features/${feature}/components/` 
    });
    // Also handle non-slash suffix for index files potentially (less common but good safe)
    replacements.push({ 
        from: `@/components/features/${feature}`, 
        to: `@/features/${feature}/components` 
    });

    // API
    // Need to handle old api paths: @/lib/api/<feature>
    // Note: API files were usually named like features (e.g. transactions.ts)
    // imports were like import ... from '@/lib/api/transactions'
    
    // Special handling for 'import' -> 'ingestion'
    if (feature === 'ingestion') {
         replacements.push({ from: '@/lib/api/import', to: '@/features/ingestion/api' });
    } else {
         replacements.push({ from: `@/lib/api/${feature}`, to: `@/features/${feature}/api` });
    }
});

// Specific API/Hook moves
replacements.push({ from: '@/lib/hooks/useCards', to: '@/features/cards/hooks/useCards' });
replacements.push({ from: '@/lib/hooks/useTransactions', to: '@/features/transactions/hooks/useTransactions' });
replacements.push({ from: '@/lib/hooks/useDashboardData', to: '@/features/dashboard/hooks/useDashboardData' });
replacements.push({ from: '@/lib/hooks/useDashboardHooks', to: '@/features/dashboard/hooks/useDashboardHooks' });

console.log(`Processing ${files.length} files...`);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    
    replacements.forEach(({ from, to }) => {
        // Simple string replacement for imports
        // We look for: from 'OLD' or from "OLD"
        
        // Regex escaping
        const escapedFrom = from.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        
        // Replace in 'import ... from "..."'
        // We want to replace the PREFIX of the module path
        // e.g. import X from '@/components/ui/button' -> import X from '@/shared/components/ui/button'
        
        const regex = new RegExp(`(from\\s+['"])${escapedFrom}`, 'g');
        content = content.replace(regex, `$1${to}`);
    });

    if (content !== originalContent) {
        console.log(`Updated: ${path.relative(PROJECT_ROOT, file)}`);
        fs.writeFileSync(file, content);
    }
});

console.log('Import updates completed.');
