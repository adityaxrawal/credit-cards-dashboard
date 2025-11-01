/**
 * Format currency in INR
 */
export declare function formatCurrency(amount: number): string;
/**
 * Calculate billing cycle month and year based on card's bill date
 */
export declare function calculateBillingCycle(transactionDate: Date, billDate: number): {
    month: number;
    year: number;
};
/**
 * Calculate days until a specific day of month
 */
export declare function daysUntilDayOfMonth(dayOfMonth: number): number;
/**
 * Generate a random alphanumeric string
 */
export declare function generateRandomString(length?: number): string;
/**
 * Sleep for specified milliseconds
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry async function with exponential backoff
 */
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, initialDelay?: number): Promise<T>;
