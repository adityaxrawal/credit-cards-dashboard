import { createClient } from '@/lib/supabase/client';

/**
 * Represents a spending limit that has been exceeded or is approaching its threshold
 * @interface LimitExceeded
 */
export interface LimitExceeded {
  /** Type of limit exceeded - either global or category-specific */
  type: 'GLOBAL' | 'CATEGORY';
  /** The maximum amount allowed for this limit */
  limitAmount: number;
  /** Current amount spent against this limit */
  currentSpending: number;
  /** Category name if this is a category-specific limit */
  category?: string;
  /** Threshold percentage (0-100) at which alerts are triggered */
  threshold: number;
  /** Whether the spending is approaching the limit threshold */
  isApproachingLimit: boolean;
  /** Whether the spending has exceeded the limit */
  exceedsLimit: boolean;
}

/**
 * Represents a spending limit configuration
 * @interface SpendingLimit
 */
export interface SpendingLimit {
  /** Unique identifier for the spending limit */
  id: string;
  /** ID of the user who owns this limit */
  user_id: string;
  /** Optional card ID if limit applies to specific card */
  card_id?: string;
  /** Optional category if limit applies to specific category */
  category?: string;
  /** Maximum amount allowed for this limit */
  limit_amount: number;
  /** Time period for the limit (daily, weekly, monthly, yearly) */
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Current amount spent against this limit */
  current_spent: number;
  /** Whether this limit is currently active */
  is_active: boolean;
  /** Threshold percentage (0-100) at which alerts are triggered */
  alert_threshold: number;
  /** Whether alerts are enabled for this limit */
  alert_enabled: boolean;
  /** ISO date string of when the limit was last reset */
  last_reset_date: string;
  /** ISO date string of when the limit was created */
  created_at: string;
  /** ISO date string of when the limit was last updated */
  updated_at: string;
}

/**
 * Represents a transaction for spending limit calculations
 * @interface Transaction
 */
export interface Transaction {
  /** Unique identifier for the transaction */
  id: string;
  /** ID of the card used for this transaction */
  card_id: string;
  /** Transaction amount (positive for debits, negative for credits) */
  amount: number;
  /** Transaction category */
  category: string;
  /** ISO date string of when the transaction occurred */
  date: string;
  /** Type of transaction */
  type: 'debit' | 'credit' | 'reversal';
}

/**
 * Service class for managing spending limits and monitoring spending patterns
 * @class SpendingLimitService
 */
export class SpendingLimitService {
  /**
   * Check if any spending limits are exceeded or approaching threshold for a given transaction
   * @param {string} userId - The ID of the user to check limits for
   * @param {Transaction} transaction - The transaction to check against limits
   * @returns {Promise<LimitExceeded | null>} Information about exceeded limit or null if no limits exceeded
   * @throws {Error} When database operations fail
   * @example
   * ```typescript
   * const service = new SpendingLimitService();
   * const transaction = { id: '123', card_id: 'card1', amount: 500, category: 'groceries', date: '2024-01-01', type: 'debit' };
   * const exceeded = await service.checkLimits('user123', transaction);
   * if (exceeded) {
   *   console.log(`Limit exceeded: ${exceeded.type}`);
   * }
   * ```
   */
  async checkLimits(userId: string, transaction: Transaction): Promise<LimitExceeded | null> {
    try {
      const supabase = await createClient();
      
      // Fetch active spending limits for user
      const { data: limits, error: limitsError } = await supabase
        .from('spending_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (limitsError) {
        throw new Error(`Failed to fetch spending limits: ${limitsError.message}`);
      }

      if (!limits || limits.length === 0) {
        return null;
      }

      // Calculate current spending for each limit
      for (const limit of limits) {
        const currentSpending = await this.calculateCurrentSpending(userId, limit);
        const newSpending = currentSpending + transaction.amount;
        
        // Check if limit is exceeded or approaching threshold
        const limitExceeded = this.checkLimitThreshold(limit, newSpending);
        
        if (limitExceeded) {
          return limitExceeded;
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking spending limits:', error);
      throw error;
    }
  }

  /**
   * Update current spending for all active limits for a user
   * @param {string} userId - The ID of the user to update spending for
   * @returns {Promise<void>} Promise that resolves when all limits are updated
   * @throws {Error} When database operations fail
   * @example
   * ```typescript
   * const service = new SpendingLimitService();
   * await service.updateSpending('user123');
   * ```
   */
  async updateSpending(userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      
      // Fetch all active spending limits for user
      const { data: limits, error: limitsError } = await supabase
        .from('spending_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (limitsError) {
        throw new Error(`Failed to fetch spending limits: ${limitsError.message}`);
      }

      if (!limits || limits.length === 0) {
        return;
      }

      // Update current spending for each limit
      for (const limit of limits) {
        const currentSpending = await this.calculateCurrentSpending(userId, limit);
        
        // Update the spending_limits table
        const { error: updateError } = await supabase
          .from('spending_limits')
          .update({ 
            current_spent: currentSpending,
            updated_at: new Date().toISOString()
          })
          .eq('id', limit.id);

        if (updateError) {
          console.error(`Failed to update spending limit ${limit.id}:`, updateError);
        }
      }
    } catch (error) {
      console.error('Error updating spending limits:', error);
      throw error;
    }
  }

  /**
   * Calculate current spending based on limit type and period
   * @private
   * @param {string} userId - The ID of the user
   * @param {SpendingLimit} limit - The spending limit configuration
   * @returns {Promise<number>} The current spending amount for the limit period
   * @throws {Error} When database operations fail
   * @example
   * ```typescript
   * const spending = await this.calculateCurrentSpending('user123', limit);
   * console.log(`Current spending: $${spending}`);
   * ```
   */
  private async calculateCurrentSpending(userId: string, limit: SpendingLimit): Promise<number> {
    try {
      const supabase = await createClient();
      const dateRange = this.getDateRangeForPeriod(limit.period, limit.last_reset_date);
      
      let query = supabase
        .from('current_transactions')
        .select('amount')
        .eq('card_id', limit.card_id || '')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .eq('type', 'debit'); // Only count debit transactions

      // If it's a category-specific limit, filter by category
      if (limit.category) {
        query = query.eq('category', limit.category);
      }

      // If no card_id specified, get all cards for the user
      if (!limit.card_id) {
        const { data: userCards } = await supabase
          .from('credit_cards')
          .select('id')
          .eq('user_id', userId);

        if (userCards && userCards.length > 0) {
          const cardIds = userCards.map((card: { id: string }) => card.id);
          query = query.in('card_id', cardIds);
        }
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to calculate spending: ${error.message}`);
      }

      return transactions?.reduce((total: number, transaction: { amount: number }) => total + transaction.amount, 0) || 0;
    } catch (error) {
      console.error('Error calculating current spending:', error);
      return 0;
    }
  }

  /**
   * Check if spending exceeds or approaches the limit threshold
   * @private
   * @param {SpendingLimit} limit - The spending limit configuration
   * @param {number} currentSpending - The current spending amount
   * @returns {LimitExceeded | null} Information about exceeded limit or null if within limits
   * @example
   * ```typescript
   * const exceeded = this.checkLimitThreshold(limit, 850);
   * if (exceeded?.exceedsLimit) {
   *   console.log('Spending limit exceeded!');
   * }
   * ```
   */
  private checkLimitThreshold(limit: SpendingLimit, currentSpending: number): LimitExceeded | null {
    const percentage = (currentSpending / limit.limit_amount) * 100;
    const isApproachingLimit = percentage >= limit.alert_threshold;
    const exceedsLimit = percentage >= 100;

    if (isApproachingLimit || exceedsLimit) {
      return {
        type: limit.category ? 'CATEGORY' : 'GLOBAL',
        limitAmount: limit.limit_amount,
        currentSpending,
        category: limit.category,
        threshold: limit.alert_threshold,
        isApproachingLimit,
        exceedsLimit
      };
    }

    return null;
  }

  /**
   * Get date range based on period and last reset date
   * @private
   * @param {string} period - The time period (daily, weekly, monthly, yearly)
   * @param {string} lastResetDate - ISO date string of when the limit was last reset
   * @returns {{ start: string; end: string }} Object with start and end ISO date strings
   * @example
   * ```typescript
   * const range = this.getDateRangeForPeriod('monthly', '2024-01-01T00:00:00Z');
   * console.log(`Period: ${range.start} to ${range.end}`);
   * ```
   */
  private getDateRangeForPeriod(period: string, lastResetDate: string): { start: string; end: string } {
    const now = new Date();
    
    switch (period) {
      case 'daily':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
        };
      
      case 'weekly':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        return {
          start: startOfWeek.toISOString(),
          end: endOfWeek.toISOString()
        };
      
      case 'monthly':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        };
      
      case 'yearly':
        return {
          start: new Date(now.getFullYear(), 0, 1).toISOString(),
          end: new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString()
        };
      
      default:
        // Default to monthly if period is not recognized
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        };
    }
  }

  /**
   * Get all active spending limits for a user
   * @param {string} userId - The ID of the user to fetch limits for
   * @returns {Promise<SpendingLimit[]>} Array of active spending limits
   * @throws {Error} When database operations fail
   * @example
   * ```typescript
   * const service = new SpendingLimitService();
   * const limits = await service.getActiveSpendingLimits('user123');
   * console.log(`User has ${limits.length} active limits`);
   * ```
   */
  async getActiveSpendingLimits(userId: string): Promise<SpendingLimit[]> {
    try {
      const supabase = await createClient();
      const { data: limits, error } = await supabase
        .from('spending_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch spending limits: ${error.message}`);
      }

      return limits || [];
    } catch (error) {
      console.error('Error fetching active spending limits:', error);
      throw error;
    }
  }

  /**
   * Create a new spending limit
   * @param {string} userId - The ID of the user creating the limit
   * @param {Object} limitData - The spending limit configuration
   * @param {string} [limitData.card_id] - Optional card ID if limit applies to specific card
   * @param {string} [limitData.category] - Optional category if limit applies to specific category
   * @param {number} limitData.limit_amount - Maximum amount allowed for this limit
   * @param {'daily' | 'weekly' | 'monthly' | 'yearly'} limitData.period - Time period for the limit
   * @param {number} [limitData.alert_threshold=80] - Threshold percentage (0-100) at which alerts are triggered
   * @returns {Promise<SpendingLimit>} The created spending limit
   * @throws {Error} When database operations fail
   * @example
   * ```typescript
   * const service = new SpendingLimitService();
   * const limit = await service.createSpendingLimit('user123', {
   *   category: 'groceries',
   *   limit_amount: 500,
   *   period: 'monthly',
   *   alert_threshold: 90
   * });
   * ```
   */
  async createSpendingLimit(userId: string, limitData: {
    card_id?: string;
    category?: string;
    limit_amount: number;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    alert_threshold?: number;
  }): Promise<SpendingLimit> {
    try {
      const supabase = await createClient();
      const { data: newLimit, error } = await supabase
        .from('spending_limits')
        .insert({
          user_id: userId,
          card_id: limitData.card_id,
          category: limitData.category,
          limit_amount: limitData.limit_amount,
          period: limitData.period,
          current_spent: 0,
          is_active: true,
          alert_threshold: limitData.alert_threshold || 80,
          alert_enabled: true,
          last_reset_date: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create spending limit: ${error.message}`);
      }

      return newLimit;
    } catch (error) {
      console.error('Error creating spending limit:', error);
      throw error;
    }
  }

  /**
   * Update an existing spending limit
   * @param {string} limitId - The ID of the spending limit to update
   * @param {string} userId - The ID of the user who owns the limit
   * @param {Partial<SpendingLimit>} updates - Partial spending limit object with fields to update
   * @returns {Promise<SpendingLimit>} The updated spending limit
   * @throws {Error} When database operations fail or limit not found
   * @example
   * ```typescript
   * const service = new SpendingLimitService();
   * const updated = await service.updateSpendingLimit('limit123', 'user123', {
   *   limit_amount: 600,
   *   alert_threshold: 85
   * });
   * ```
   */
  async updateSpendingLimit(limitId: string, userId: string, updates: Partial<SpendingLimit>): Promise<SpendingLimit> {
    try {
      const supabase = await createClient();
      const { data: updatedLimit, error } = await supabase
        .from('spending_limits')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', limitId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update spending limit: ${error.message}`);
      }

      return updatedLimit;
    } catch (error) {
      console.error('Error updating spending limit:', error);
      throw error;
    }
  }

  /**
   * Delete a spending limit
   * @param {string} limitId - The ID of the spending limit to delete
   * @param {string} userId - The ID of the user who owns the limit
   * @returns {Promise<void>} Promise that resolves when limit is deleted
   * @throws {Error} When database operations fail or limit not found
   * @example
   * ```typescript
   * const service = new SpendingLimitService();
   * await service.deleteSpendingLimit('limit123', 'user123');
   * console.log('Spending limit deleted successfully');
   * ```
   */
  async deleteSpendingLimit(limitId: string, userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from('spending_limits')
        .delete()
        .eq('id', limitId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete spending limit: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting spending limit:', error);
      throw error;
    }
  }
}