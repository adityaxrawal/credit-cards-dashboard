/**
 * Timezone Service
 * 
 * Centralized utility for timezone conversions.
 * All dates are stored in UTC in the database.
 * This service converts UTC dates to user's local timezone for display.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { UserRepository } from '@modules/user/user.repository';

// Extend dayjs with timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

// Default timezone for the application (IST)
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Common timezone options for settings UI
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

export class TimezoneService {
    /**
     * Get user's timezone preference
     * Falls back to DEFAULT_TIMEZONE if not set
     */
    static async getUserTimezone(userId: string): Promise<string> {
        try {
            const timezone = await UserRepository.getUserTimezone(userId);
            return timezone || DEFAULT_TIMEZONE;
        } catch (error) {
            console.warn(`[TimezoneService] Failed to get timezone for user ${userId}, using default`, error);
            return DEFAULT_TIMEZONE;
        }
    }

    /**
     * Convert a UTC date to user's local timezone
     * @param utcDate - Date in UTC (can be Date object, string, or timestamp)
     * @param timezone - IANA timezone string (e.g., 'Asia/Kolkata')
     * @returns dayjs object in the specified timezone
     */
    static convertToTimezone(utcDate: Date | string | number, timezone: string): dayjs.Dayjs {
        return dayjs.utc(utcDate).tz(timezone);
    }

    /**
     * Format a UTC date in user's local timezone
     * @param utcDate - Date in UTC
     * @param timezone - IANA timezone string
     * @param format - Optional dayjs format string (default: ISO format)
     */
    static formatInTimezone(
        utcDate: Date | string | number,
        timezone: string,
        format?: string
    ): string {
        const localDate = this.convertToTimezone(utcDate, timezone);
        return format ? localDate.format(format) : localDate.toISOString();
    }

    /**
     * Convert transaction date fields to user's timezone
     * Adds `local_*` prefixed fields for display
     */
    static convertTransactionDates<T extends Record<string, any>>(
        transaction: T,
        timezone: string
    ): T & { local_transaction_date?: string; local_created_at?: string } {
        const result = { ...transaction } as T & { local_transaction_date?: string; local_created_at?: string };

        if (transaction.transaction_date) {
            result.local_transaction_date = this.formatInTimezone(
                transaction.transaction_date,
                timezone,
                'YYYY-MM-DD HH:mm:ss'
            );
        }

        if (transaction.created_at) {
            result.local_created_at = this.formatInTimezone(
                transaction.created_at,
                timezone,
                'YYYY-MM-DD HH:mm:ss'
            );
        }

        return result;
    }

    /**
     * Batch convert transactions with timezone
     */
    static convertTransactionsBatch<T extends Record<string, any>>(
        transactions: T[],
        timezone: string
    ): Array<T & { local_transaction_date?: string; local_created_at?: string }> {
        return transactions.map(txn => this.convertTransactionDates(txn, timezone));
    }

    /**
     * Validate if a timezone string is valid
     */
    static isValidTimezone(tz: string): boolean {
        try {
            // Try to create a date in the timezone
            dayjs().tz(tz);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get timezone offset in hours (e.g., +5.5 for IST)
     */
    static getTimezoneOffset(timezone: string): number {
        const now = dayjs().tz(timezone);
        return now.utcOffset() / 60;
    }

    /**
     * Get formatted timezone offset string (e.g., "+05:30")
     */
    static getTimezoneOffsetString(timezone: string): string {
        const now = dayjs().tz(timezone);
        return now.format('Z');
    }

    /**
     * Convert a date string (presumed in User Timezone) to a UTC Date object
     * for database querying.
     * @param dateStr - Date string (e.g., "2024-01-01" or ISO)
     * @param timezone - User's timezone
     * @param endOfDay - If true, sets time to end of day (23:59:59.999)
     */
    static userDateToUTC(dateStr: string, timezone: string, endOfDay: boolean = false): Date {
        // Parse the date as if it is in the user's timezone
        let date = dayjs.tz(dateStr, timezone);

        if (endOfDay) {
            date = date.endOf('day');
        } else {
            // If just date string provided without time, dayjs.tz defaults to start of day
            // But if it's start of day, we ensure it.
            date = date.startOf('day');
        }

        return date.utc().toDate();
    }

    /**
     * Get a relative date from "now" (in User Timezone), returned as UTC Date.
     * Useful for defaults like "Last 3 Months".
     * @param value - Amount to subtract (e.g., 3)
     * @param unit - Unit (e.g., 'month')
     * @param timezone - User's timezone
     */
    static getRelativeDateInUTC(value: number, unit: dayjs.ManipulateType, timezone: string): Date {
        // Get "now" in user timezone
        const now = dayjs().tz(timezone);
        // Subtract duration
        const past = now.subtract(value, unit);
        // Return as UTC Date
        return past.utc().toDate();
    }

    /**
     * Get "now" in User Timezone, returned as UTC Date.
     */
    static getNowInUTC(timezone: string): Date {
        return dayjs().tz(timezone).utc().toDate();
    }
}
