/**
 * UI Components Index
 * Central export for all UI components
 */

// Primitives (from subdirectory)
export * from './primitives/Button';
export * from './primitives/Input';
export * from './primitives/Modal';
export * from './primitives/Dropdown';
export * from './primitives/Badge';
export * from './primitives/card';
export * from './primitives/label';

// Feedback components (from subdirectory)
export * from './feedback/Toast';
export * from './feedback/LoadingOverlay';
export * from './feedback/GlobalLoadingSpinner';
export * from './feedback/Skeleton';
export * from './feedback/ProgressBar';

// Data display components (from subdirectory)
export * from './data-display/DataTable';
export * from './data-display/StatCard';
export * from './data-display/CardVisual';

// Form components (from subdirectory)
export { default as DatePicker } from './forms/DatePicker';

// Legacy exports from root (backward compatibility)
export * from './select';
export * from './switch';
export * from './tabs';
export * from './progress';
