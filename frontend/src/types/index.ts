/**
 * Type Definitions Index
 * 
 * Central re-export point for all type definitions.
 * This file maintains backward compatibility while types are organized by domain.
 * 
 * Organized by domain:
 * - common: Shared API types and utilities
 * - user: User and authentication types
 * - card: Credit card types
 * - transaction: Transaction types
 * - budget: Budget and spending limit types
 * - alert: Alert and notification types
 * - analytics: Analytics and KPI types
 * - gmail: Gmail integration types
 * - ui: UI component types
 */

// Common types - API responses, pagination, errors
export type {
  ApiResponse,
  PaginatedResponse,
  ApiError,
} from './common';

// User and authentication types
export type {
  User,
  AuthResponse,
  EmailPreferences,
} from './user';

// Credit card types
export type {
  CreditCard,
  CardFormData,
  CreateCardRequest,
  CardInsights,
} from './card';

// Transaction types
export type {
  Transaction,
  TransactionFilters,
  TransactionFormData,
  CreateTransactionRequest,
  TransactionStats,
} from './transaction';

// Budget and spending limit types
export type {
  BudgetTracking,
  SpendingLimit,
  SpendingLimitFormData,
  UpdateBudgetRequest,
} from './budget';

// Alert types
export type {
  AlertHistory,
} from './alert';

// Analytics and KPI types
export type {
  KPIData,
  SpendingByCategory,
  MonthlySpending,
  DashboardStats,
} from './analytics';

// Gmail integration types
export type {
  GmailIntegration,
} from './gmail';

// UI component types
export type {
  ModalSize,
  ButtonVariant,
  BadgeVariant,
  ToastType,
  Toast,
} from './ui';
