const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');

const features = [
  'accounts', 'analytics', 'auth', 'budget', 'cards', 'dashboard',
  'gmail', 'goals', 'ingestion', 'loans', 'onboarding', 'reports',
  'review', 'rewards', 'rules', 'settings', 'statements', 'transactions',
  // Standalone API features
  'alerts', 'bills', 'recurring', 'shared-expenses', 'transfers'
];

function move(src, dest) {
  const srcPath = path.join(PROJECT_ROOT, src);
  const destPath = path.join(PROJECT_ROOT, dest);

  if (!fs.existsSync(srcPath)) {
    console.log(`Skipping: ${src} (not found)`);
    return;
  }

  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // If destination is a directory (ends with / or is existing dir), move into it
  // But here we specify full dest path for file, or dest dir for dir
  
  try {
    if (fs.lstatSync(srcPath).isDirectory()) {
       // Moving a directory content to another directory
       // If dest exists, we might need to merge. simpler to just move contents?
       // For this migration, we are moving component folders.
       
       if (!fs.existsSync(destPath)) {
          fs.renameSync(srcPath, destPath);
          console.log(`Moved DIR: ${src} -> ${dest}`);
       } else {
          // Move items individually if dest dir exists
          const items = fs.readdirSync(srcPath);
          items.forEach(item => {
             move(path.join(src, item), path.join(dest, item));
          });
          // Remove empty src dir
          try { fs.rmdirSync(srcPath); } catch (e) {}
       }
    } else {
       fs.renameSync(srcPath, destPath);
       console.log(`Moved FILE: ${src} -> ${dest}`);
    }
  } catch (err) {
    console.error(`Error moving ${src} to ${dest}:`, err.message);
  }
}

// 1. Move Components
features.forEach(feature => {
    // Some features might be new and have no components yet (e.g. alerts), verify source path
    move(`src/components/features/${feature}`, `src/features/${feature}/components`);
});

// 2. Move APIs
// Mapping naming conventions can vary.
const apiMapping = {
    'analytics.ts': 'features/analytics/api/index.ts',
    'budget.ts': 'features/budget/api/index.ts',
    'cards.ts': 'features/cards/api/index.ts',
    'gmail.ts': 'features/gmail/api/index.ts',
    'goals.ts': 'features/goals/api/index.ts',
    'import.ts': 'features/ingestion/api/index.ts', // Note name change
    'loans.ts': 'features/loans/api/index.ts',
    'rewards.ts': 'features/rewards/api/index.ts',
    'rules.ts': 'features/rules/api/index.ts',
    'settings.ts': 'features/settings/api/index.ts',
    'statements.ts': 'features/statements/api/index.ts',
    
    'alerts.ts': 'features/alerts/api/index.ts',
    'bills.ts': 'features/bills/api/index.ts',
    'recurring.ts': 'features/recurring/api/index.ts',
    'shared-expenses.ts': 'features/shared-expenses/api/index.ts',
    'transfers.ts': 'features/transfers/api/index.ts',
    
    // Auth, Dashboard, Transactions, Accounts were attempted earlier, add robust retry
    'auth.ts': 'features/auth/api/index.ts',
    'dashboard.ts': 'features/dashboard/api/index.ts',
    'transactions.ts': 'features/transactions/api/index.ts',
    'accounts.ts': 'features/accounts/api/index.ts',

    'currency.ts': 'shared/utils/currency.ts'
};

Object.entries(apiMapping).forEach(([file, dest]) => {
    move(`src/lib/api/${file}`, `src/${dest}`);
});

// 3. Move Hooks
const hookMapping = {
    'useCards.ts': 'features/cards/hooks/useCards.ts',
    'useTransactions.ts': 'features/transactions/hooks/useTransactions.ts',
    // Check for dashboard hooks
    'useDashboardData.ts': 'features/dashboard/hooks/useDashboardData.ts',
    'useDashboardHooks.ts': 'features/dashboard/hooks/useDashboardHooks.ts',
};

Object.entries(hookMapping).forEach(([file, dest]) => {
    move(`src/lib/hooks/${file}`, `src/${dest}`);
});

console.log("Migration structure steps completed.");
