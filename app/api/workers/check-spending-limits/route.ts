import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jobQueue } from '@/lib/queue/worker';
import { sseManager } from '@/lib/sse/manager';
import { SpendingLimitService } from '@/lib/services/spending-limit';
import { verifyQstashRequest } from '@/lib/qstash/verify';

interface CheckSpendingLimitsRequest {
  jobId: string;
  userId: string;
  data: {
    cardId?: string;
    transactionAmount?: number;
    category?: string;
    transactionId?: string;
  };
}

export async function POST(request: NextRequest) {
  let body: CheckSpendingLimitsRequest | null = null;
  try {
    const verification = await verifyQstashRequest<CheckSpendingLimitsRequest>(request);
    if (!verification.valid || !verification.body) {
      return NextResponse.json({ error: verification.error ?? 'Unauthorized' }, { status: 401 });
    }
    body = verification.body;
    const { jobId, userId, data } = body;

    if (!jobId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Update job status to processing
    await jobQueue.updateJob(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0,
      message: 'Starting spending limits check...',
    });

    const supabase = await createClient();
    const spendingLimitService = new SpendingLimitService();

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 20,
      message: 'Fetching active spending limits...',
    });

    // Fetch active spending limits for the user
    let query = supabase
      .from('spending_limits')
      .select(`
        id,
        card_id,
        category,
        limit_amount,
        period,
        current_spent,
        alert_threshold,
        alert_enabled,
        is_active,
        last_reset_date
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    // Filter by card if provided
    if (data.cardId) {
      query = query.eq('card_id', data.cardId);
    }

    const { data: spendingLimits, error: limitsError } = await query;

    if (limitsError) {
      await jobQueue.updateJob(jobId, {
        status: 'failed',
        error: `Failed to fetch spending limits: ${limitsError.message}`,
        completedAt: new Date(),
      });

      return NextResponse.json({
        success: false,
        error: 'Failed to fetch spending limits',
      }, { status: 500 });
    }

    if (!spendingLimits || spendingLimits.length === 0) {
      await jobQueue.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        message: 'No active spending limits found',
      });

      return NextResponse.json({
        success: true,
        message: 'No active spending limits to check',
        limitsChecked: 0,
      });
    }

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 40,
      message: `Checking ${spendingLimits.length} spending limits...`,
    });

    const alerts: Array<{
      limitId: string;
      category?: string;
      limitAmount: number;
      currentSpent: number;
      utilizationPercentage: number;
      isOverLimit: boolean;
      isNearLimit: boolean;
    }> = [];

    let checkedCount = 0;

    // Check each spending limit
    for (const limit of spendingLimits) {
      try {
        // Convert database result to SpendingLimit interface
        const spendingLimit = {
          ...limit,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // If we have a transaction, create a mock transaction object for checking
        if (data.transactionAmount && data.transactionAmount > 0) {
          const mockTransaction = {
            id: data.transactionId || 'temp-transaction',
            card_id: data.cardId || '',
            amount: data.transactionAmount,
            category: data.category || 'Other',
            date: new Date().toISOString(),
            type: 'debit' as const,
          };

          // Use the service's checkLimits method
          const limitExceeded = await spendingLimitService.checkLimits(userId, mockTransaction);
          
          if (limitExceeded) {
            const isOverLimit = limitExceeded.exceedsLimit;
            const isNearLimit = limitExceeded.isApproachingLimit;
            
            alerts.push({
              limitId: limit.id,
              category: limit.category,
              limitAmount: limit.limit_amount,
              currentSpent: limitExceeded.currentSpending,
              utilizationPercentage: Math.round((limitExceeded.currentSpending / limit.limit_amount * 100) * 100) / 100,
              isOverLimit,
              isNearLimit,
            });

            // Send real-time notification via SSE
            if (limit.alert_enabled) {
              await sseManager.sendToUser(userId, 'spending-alert', {
                type: isOverLimit ? 'limit-exceeded' : 'approaching-limit',
                limitId: limit.id,
                category: limit.category || 'All Categories',
                limitAmount: limit.limit_amount,
                currentSpent: limitExceeded.currentSpending,
                utilizationPercentage: Math.round((limitExceeded.currentSpending / limit.limit_amount * 100) * 100) / 100,
                message: isOverLimit 
                  ? `Spending limit exceeded for ${limit.category || 'all categories'}!`
                  : `Approaching spending limit for ${limit.category || 'all categories'}`,
              });
            }
          }
        } else {
          // Just check current spending without adding a transaction
          const currentSpent = limit.current_spent;
          const utilizationPercentage = limit.limit_amount > 0 
            ? (currentSpent / limit.limit_amount * 100) 
            : 0;
          
          const isOverLimit = currentSpent > limit.limit_amount;
          const isNearLimit = utilizationPercentage >= (limit.alert_threshold || 80);

          if ((isOverLimit || isNearLimit) && limit.alert_enabled) {
            alerts.push({
              limitId: limit.id,
              category: limit.category,
              limitAmount: limit.limit_amount,
              currentSpent: currentSpent,
              utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
              isOverLimit,
              isNearLimit,
            });

            // Send real-time notification via SSE
            await sseManager.sendToUser(userId, 'spending-alert', {
              type: isOverLimit ? 'limit-exceeded' : 'approaching-limit',
              limitId: limit.id,
              category: limit.category || 'All Categories',
              limitAmount: limit.limit_amount,
              currentSpent: currentSpent,
              utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
              message: isOverLimit 
                ? `Spending limit exceeded for ${limit.category || 'all categories'}!`
                : `Approaching spending limit for ${limit.category || 'all categories'}`,
            });
          }
        }

        checkedCount++;

        // Update progress
        const progress = 40 + Math.floor((checkedCount / spendingLimits.length) * 50);
        await jobQueue.updateJob(jobId, {
          progress,
          message: `Checked ${checkedCount}/${spendingLimits.length} limits...`,
        });

      } catch (error) {
        console.error(`Error checking spending limit ${limit.id}:`, error);
        // Continue with other limits even if one fails
      }
    }

    // Complete the job
    await jobQueue.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      message: `Spending limits check completed. ${alerts.length} alerts generated.`,
    });

    return NextResponse.json({
      success: true,
      message: 'Spending limits check completed',
      limitsChecked: checkedCount,
      alertsGenerated: alerts.length,
      alerts: alerts,
    });

  } catch (error) {
    console.error('Check spending limits worker error:', error);
    const jobId = body?.jobId;
    if (jobId) {
      await jobQueue.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}