"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.calculateBillingCycle = calculateBillingCycle;
exports.daysUntilDayOfMonth = daysUntilDayOfMonth;
exports.generateRandomString = generateRandomString;
exports.sleep = sleep;
exports.retryWithBackoff = retryWithBackoff;
/**
 * Format currency in INR
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
}
/**
 * Calculate billing cycle month and year based on card's bill date
 */
function calculateBillingCycle(transactionDate, billDate) {
    const txDate = new Date(transactionDate);
    const txDay = txDate.getDate();
    let month = txDate.getMonth() + 1; // 1-12
    let year = txDate.getFullYear();
    // If transaction is before bill date, it belongs to previous billing cycle
    if (txDay < billDate) {
        month -= 1;
        if (month === 0) {
            month = 12;
            year -= 1;
        }
    }
    return { month, year };
}
/**
 * Calculate days until a specific day of month
 */
function daysUntilDayOfMonth(dayOfMonth) {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    if (targetDate < today) {
        targetDate.setMonth(targetDate.getMonth() + 1);
    }
    const diffInMs = targetDate.getTime() - today.getTime();
    return Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
}
/**
 * Generate a random alphanumeric string
 */
function generateRandomString(length = 32) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Retry async function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=helpers.js.map