/**
 * Feature Components Index
 * Central export for all feature components
 */

// Gmail Features
export { GmailSyncButton, GmailSyncModal } from './gmail/GmailSyncButton';
export { default as HistoricalScanProgress } from './gmail/HistoricalScanProgress';
export { default as ManualReviewQueue } from './gmail/ManualReviewQueue';

// Dashboard Features

export { SpendingTrendChart } from './dashboard/SpendingTrendChart';
export { TransactionsPreview } from './dashboard/TransactionsPreview';
export { CardsPreview } from './dashboard/CardsPreview';
export { RemindersWidget } from './dashboard/RemindersWidget';
export { InventoryDetailsCard } from './dashboard/InventoryDetailsCard';

// Transaction Features
export * from './transactions/TransactionFilters';
export * from './transactions/BulkImportModal';
export { default as RecurringTransactionsList } from './transactions/RecurringTransactionsList';

// Analytics Features
export * from './analytics/Charts';

// Rewards Features
export * from './rewards/RedemptionModal';

// Settings Features
export { default as GmailIntegrationCard } from './settings/GmailIntegrationCard';

// Statements Features
export * from './statements/FileUpload';
export * from './statements/StatementList';
