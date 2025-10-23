import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jobQueue } from '@/lib/queue/worker';
import { sseManager } from '@/lib/sse/manager';
import { verifyQstashRequest } from '@/lib/qstash/verify';

// Sample perks data for different card types
const CARD_PERKS_DATA = {
  'visa': [
    {
      perk_type: 'cashback',
      category: 'Dining',
      reward_rate: 5.0,
      description: '5% cashback on dining transactions',
      max_monthly_benefit: 1000.00,
    },
    {
      perk_type: 'points',
      category: 'Shopping',
      reward_rate: 2.0,
      description: '2 reward points per ₹100 spent on shopping',
      max_monthly_benefit: null,
    },
    {
      perk_type: 'miles',
      category: 'Travel',
      reward_rate: 3.0,
      description: '3 miles per ₹100 spent on travel bookings',
      max_monthly_benefit: 2000.00,
    }
  ],
  'mastercard': [
    {
      perk_type: 'cashback',
      category: 'Fuel',
      reward_rate: 4.0,
      description: '4% cashback on fuel transactions',
      max_monthly_benefit: 500.00,
    },
    {
      perk_type: 'points',
      category: 'Entertainment',
      reward_rate: 3.0,
      description: '3 reward points per ₹100 spent on entertainment',
      max_monthly_benefit: 750.00,
    },
    {
      perk_type: 'discount',
      category: 'Groceries',
      reward_rate: 10.0,
      description: '10% discount on grocery purchases',
      max_monthly_benefit: 300.00,
    }
  ],
  'amex': [
    {
      perk_type: 'points',
      category: 'Dining',
      reward_rate: 4.0,
      description: '4 membership rewards points per ₹100 on dining',
      max_monthly_benefit: null,
    },
    {
      perk_type: 'access',
      category: 'Travel',
      reward_rate: 1.0,
      description: 'Airport lounge access and travel benefits',
      max_monthly_benefit: null,
    },
    {
      perk_type: 'protection',
      category: 'Insurance',
      reward_rate: 1.0,
      description: 'Purchase protection and extended warranty',
      max_monthly_benefit: null,
    }
  ],
  'rupay': [
    {
      perk_type: 'cashback',
      category: 'UPI',
      reward_rate: 1.0,
      description: '1% cashback on UPI transactions',
      max_monthly_benefit: 200.00,
    },
    {
      perk_type: 'points',
      category: 'General',
      reward_rate: 1.0,
      description: '1 reward point per ₹100 spent',
      max_monthly_benefit: null,
    }
  ],
  'default': [
    {
      perk_type: 'points',
      category: 'General',
      reward_rate: 1.0,
      description: '1 reward point per ₹100 spent on all purchases',
      max_monthly_benefit: null,
    },
    {
      perk_type: 'cashback',
      category: 'Online',
      reward_rate: 2.0,
      description: '2% cashback on online transactions',
      max_monthly_benefit: 500.00,
    }
  ]
};

interface FetchPerksRequest {
  jobId: string;
  userId: string;
  cardId: string;
  cardType?: string;
}

export async function POST(request: NextRequest) {
  let body: FetchPerksRequest | null = null;
  try {
    const verification = await verifyQstashRequest<FetchPerksRequest>(request);
    if (!verification.valid || !verification.body) {
      return NextResponse.json({ error: verification.error ?? 'Unauthorized' }, { status: 401 });
    }
    body = verification.body;
    const { jobId, userId, cardId, cardType } = body;

    if (!jobId || !userId || !cardId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Update job status to processing
    await jobQueue.updateJob(jobId, {
      status: 'processing',
      progress: 0,
      message: 'Starting perks fetch...',
    });

    // Send initial SSE progress update
    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-3',
      progress: 0,
      message: 'Starting perks fetch...'
    });

    const supabase = await createClient();

    // Simulate fetching perks (in real implementation, this would scrape or call APIs)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 20,
      message: 'Analyzing card type...',
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-3',
      progress: 20,
      message: 'Analyzing card type...'
    });

    // Determine card type and get appropriate perks
    const normalizedCardType = cardType?.toLowerCase() || 'default';
    let perksToAdd = CARD_PERKS_DATA[normalizedCardType as keyof typeof CARD_PERKS_DATA];
    
    if (!perksToAdd) {
      // Try to match partial card type names
      if (normalizedCardType.includes('visa')) {
        perksToAdd = CARD_PERKS_DATA.visa;
      } else if (normalizedCardType.includes('master')) {
        perksToAdd = CARD_PERKS_DATA.mastercard;
      } else if (normalizedCardType.includes('amex') || normalizedCardType.includes('american')) {
        perksToAdd = CARD_PERKS_DATA.amex;
      } else if (normalizedCardType.includes('rupay')) {
        perksToAdd = CARD_PERKS_DATA.rupay;
      } else {
        perksToAdd = CARD_PERKS_DATA.default;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 40,
      message: `Found ${perksToAdd.length} perks for ${cardType || 'card'}...`,
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-3',
      progress: 40,
      message: `Found ${perksToAdd.length} perks for ${cardType || 'card'}...`
    });

    // Check if perks already exist for this card
    const { data: existingPerks } = await supabase
      .from('card_perks')
      .select('id')
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (existingPerks && existingPerks.length > 0) {
      // Update progress - perks already exist
      await jobQueue.updateJob(jobId, {
        progress: 100,
        message: 'Perks already exist for this card',
      });

      await sseManager.sendToUser(userId, 'progress', {
        process: 'process-3',
        progress: 100,
        message: '✅ Perks already configured'
      });

      await jobQueue.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        message: 'Perks fetch completed - already existed',
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Perks already exist',
        perksCount: existingPerks.length 
      });
    }

    // Insert perks into database
    let insertedCount = 0;
    const totalPerks = perksToAdd.length;

    for (let i = 0; i < perksToAdd.length; i++) {
      const perk = perksToAdd[i];
      
      try {
        const { error } = await supabase
          .from('card_perks')
          .insert({
            user_id: userId,
            card_id: cardId,
            perk_type: perk.perk_type,
            perk_description: perk.description,
            perk_value: JSON.stringify({
              category: perk.category,
              reward_rate: perk.reward_rate,
              max_monthly_benefit: perk.max_monthly_benefit
            }),
            is_active: true
          });

        if (error) {
          console.error('Error inserting perk:', error);
        } else {
          insertedCount++;
        }

        // Update progress during insertion
        const progress = 40 + Math.floor(((i + 1) / totalPerks) * 50);
        await jobQueue.updateJob(jobId, {
          progress,
          message: `Saving perks... ${i + 1}/${totalPerks}`,
        });

        await sseManager.sendToUser(userId, 'progress', {
          process: 'process-3',
          progress,
          message: `Saving perks... ${i + 1}/${totalPerks}`
        });

        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('Error processing perk:', error);
      }
    }

    // Final update
    await jobQueue.updateJob(jobId, {
      progress: 100,
      message: `Successfully added ${insertedCount} perks`,
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-3',
      progress: 100,
      message: `✅ Added ${insertedCount} perks successfully`
    });

    // Complete the job
    await jobQueue.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      message: `Perks fetch completed - added ${insertedCount} perks`,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Perks fetched successfully',
      perksCount: insertedCount 
    });

  } catch (error) {
    console.error('Fetch perks worker error:', error);
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