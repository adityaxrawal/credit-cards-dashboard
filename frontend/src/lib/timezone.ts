/**
 * Timezone Utility
 * 
 * Frontend utilities for detecting and managing user timezone.
 */

/**
 * Detect the user's browser timezone
 * @returns IANA timezone string (e.g., 'Asia/Kolkata')
 */
export function detectBrowserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        // Fallback to IST if detection fails
        return 'Asia/Kolkata';
    }
}

/**
 * Get timezone offset in hours (e.g., +5.5 for IST)
 */
export function getTimezoneOffset(): number {
    return -(new Date().getTimezoneOffset() / 60);
}

/**
 * Format a date in the user's local timezone
 * @param date - Date string or Date object (assumed UTC if string)
 * @param format - Format options
 */
export function formatLocalDate(
    date: string | Date,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }
): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString(undefined, options);
}

/**
 * Format just the date portion
 */
export function formatLocalDateOnly(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Format just the time portion
 */
export function formatLocalTimeOnly(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Check if we need to send timezone to backend
 * (e.g., if it's different from what's stored)
 */
export function shouldUpdateTimezone(storedTimezone: string | null): boolean {
    const browserTimezone = detectBrowserTimezone();
    return !storedTimezone || storedTimezone !== browserTimezone;
}

/**
 * Common timezone options for settings UI
 */
export const COMMON_TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore Time (SGT)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

/**
 * Get current date in YYYY-MM-DD format based on user's local time
 */
export function getLocalDateISOString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get a past date in YYYY-MM-DD format based on user's local time
 * @param monthsAgo - Number of months to subtract
 */
export function getRelativeLocalDateISOString(monthsAgo: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
