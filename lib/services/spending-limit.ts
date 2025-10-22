import { createClient } from '@/lib/supabase/client';

export interface LimitExceeded {
  type: 'GLOBAL' | 'CATEGORY';
  limitAmount: number;
  currentSpending: number;
  category?: string;
  threshold: number;
  isApproachingLimit: boolean;
  exceedsLimit: boolean;
}

export interface SpendingLimit {
  id: string;
  user_id: string;
  card_id?: string;
  category?: string;
  limit_amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  current_spent: number;
  is_active: boolean;
  alert_threshold: number;
  alert_enabled: boolean;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  card_id: string;
  amount: number;
  category: string;
  date: string;
  type: 'debit' | 'credit' | 'reversal';
}

export class SpendingLimitService {
  /**
   * Check if any spending limits are exceeded or approaching threshold
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