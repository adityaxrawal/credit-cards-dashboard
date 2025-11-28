/**
 * API Services Index
 * Central export point for all API services
 * 
 * Re-exports both new service pattern and legacy API pattern for backward compatibility
 */

// Core utilities
export * from './core/client';

// Services (new pattern)
export { cardService, cardApi } from './services/cards.service';
export { transactionService, transactionApi } from './services/transactions.service';

// Legacy exports from existing files (maintain backward compatibility)
export * from './auth';
export * from './analytics';
export * from './budget';
export * from './gmail';
export * from './alerts';
export * from './bills';
export * from './rewards';
export * from './statements';
export * from './settings';
