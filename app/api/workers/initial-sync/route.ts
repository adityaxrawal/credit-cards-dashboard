import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue/worker';
import { gmailClient } from '@/lib/services/gmail-client';
import { EmailParserService, ParsedEmail } from '@/lib/services/email-parser';
import { createClient } from '@/src/backend/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

interface InitialSyncRequest {
  jobId: string;
  userId: string;
  data: {
    yearsBack?: number;
    forceRefresh?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: InitialSyncRequest = await request.json();
    const { jobId, userId, data } = body;

    // Update job status to processing
    await jobQueue.updateJob(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0,
      message: 'Starting initial email sync...',
    });

    const supabase = await createClient();
    const emailParser = new EmailParserService();
    const yearsBack = data.yearsBack || 2;

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 10,
      message: 'Fetching historical emails from Gmail...',
    });

    // Fetch historical emails
    const messages = await gmailClient.fetchHistoricalEmails(userId, yearsBack);
    
    await jobQueue.updateJob(jobId, {
      progress: 30,
      message: `Found ${messages.length} emails. Starting to parse...`,
    });

    let processedCount = 0;
    let transactionCount = 0;
    let statementCount = 0;
    const errors: string[] = [];

    // Process emails in batches
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      for (const message of batch) {
        try {
          // Extract email content
          const { subject, from, body, date } = gmailClient.extractEmailContent(message);
          
          // Parse email
          const parsed = emailParser.parseEmail({
            subject,
            sender: from,
            body,
            date,
          });
          
          if (parsed) {
            if (parsed.type === 'transaction') {
              // Check for duplicate transaction
              const isDuplicate = await checkDuplicateTransaction(
                supabase,
                getCardLast4(parsed.cardNumber),
                parsed.amount || 0,
                parsed.merchant || '',
                parsed.date || new Date()
              );

              if (!isDuplicate) {
                // Find or create credit card
                const card = await findOrCreateCard(supabase, userId, parsed);
                
                // Store transaction
                await storeTransaction(supabase, userId, card.id, parsed, message.id);
                transactionCount++;

                // If new card, enqueue perks fetching job
                if (card.isNew) {
                  await jobQueue.enqueue('fetch-perks', userId, {
                    cardId: card.id,
                    cardType: parsed.cardNumber ? getCardType(parsed.cardNumber) : 'Unknown',
                  });
                }
              }
            } else if (parsed.type === 'statement') {
              // Find card and create statement
              const card = await findCardByLast4(supabase, userId, getCardLast4(parsed.cardNumber));
              if (card) {
                await createStatement(supabase, card.id, parsed, message.id);
                statementCount++;
              }
            }
          }
          
          processedCount++;
        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
          errors.push(`Message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update progress
      const progress = Math.min(30 + Math.floor((i / messages.length) * 60), 90);
      await jobQueue.updateJob(jobId, {
        progress,
        message: `Processed ${processedCount}/${messages.length} emails. Found ${transactionCount} transactions, ${statementCount} statements.`,
      });
    }

    // Complete the job
    await jobQueue.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      message: `Initial sync completed. Processed ${processedCount} emails, found ${transactionCount} transactions and ${statementCount} statements.`,
    });

    return NextResponse.json({
      success: true,
      processed: processedCount,
      transactions: transactionCount,
      statements: statementCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error reporting
    });

  } catch (error) {
    console.error('Initial sync worker error:', error);
    
    // Update job with error
    const { jobId } = await request.json().catch(() => ({ jobId: 'unknown' }));
    
    if (jobId !== 'unknown') {
      await jobQueue.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function checkDuplicateTransaction(
  supabase: SupabaseClient,
  cardLast4: string,
  amount: number,
  merchant: string,
  date: Date
): Promise<boolean> {
  const { data, error } = await supabase
    .from('current_transactions')
    .select('id')
    .eq('card_last_4', cardLast4)
    .eq('amount', amount)
    .eq('merchant', merchant)
    .gte('date', new Date(date.getTime() - 24 * 60 * 60 * 1000).toISOString()) // Within 24 hours
    .lte('date', new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  return !error && data && data.length > 0;
}

async function findOrCreateCard(
  supabase: SupabaseClient, 
  userId: string, 
  parsed: ParsedEmail
): Promise<{ id: string; isNew: boolean }> {
  const cardLast4 = getCardLast4(parsed.cardNumber);
  
  // Try to find existing card
  const { data: existingCard } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('last_4_digits', cardLast4)
    .single();

  if (existingCard) {
    return { id: existingCard.id, isNew: false };
  }

  // Create new card
  const { data: newCard, error } = await supabase
    .from('credit_cards')
    .insert({
      user_id: userId,
      bank_name: parsed.bank || 'Unknown',
      card_type: parsed.cardNumber ? getCardType(parsed.cardNumber) : 'Unknown',
      last_4_digits: cardLast4,
      card_name: `${parsed.bank || 'Unknown'} ${parsed.cardNumber ? getCardType(parsed.cardNumber) : 'Card'}`,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create card: ${error.message}`);
  }

  return { id: newCard.id, isNew: true };
}

async function findCardByLast4(
  supabase: SupabaseClient, 
  userId: string, 
  cardLast4: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('last_4_digits', cardLast4)
    .single();

  return error ? null : data;
}

async function storeTransaction(
  supabase: SupabaseClient, 
  userId: string, 
  cardId: string, 
  parsed: ParsedEmail, 
  messageId: string
): Promise<void> {
  const { error } = await supabase
    .from('current_transactions')
    .insert({
      user_id: userId,
      card_id: cardId,
      amount: parsed.amount || 0,
      merchant: parsed.merchant || 'Unknown',
      category: parsed.category || 'Other',
      date: (parsed.date || new Date()).toISOString(),
      description: `${parsed.merchant || 'Transaction'} - ${parsed.amount || 0}`,
      transaction_type: parsed.transactionType || 'debit',
      card_last_4: getCardLast4(parsed.cardNumber),
      is_processed: true,
      gmail_message_id: messageId,
      created_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to store transaction: ${error.message}`);
  }
}

async function createStatement(
  supabase: SupabaseClient, 
  cardId: string, 
  parsed: ParsedEmail, 
  messageId: string
): Promise<void> {
  const { error } = await supabase
    .from('statements')
    .insert({
      card_id: cardId,
      statement_date: (parsed.date || new Date()).toISOString(),
      due_date: parsed.date?.toISOString(),
      total_amount: parsed.amount || 0,
      minimum_amount: 0,
      available_credit: 0,
      gmail_message_id: messageId,
      created_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to create statement: ${error.message}`);
  }
}

// Utility functions
function getCardLast4(cardNumber?: string): string {
  if (!cardNumber) return '0000';
  return cardNumber.slice(-4);
}

function getCardType(cardNumber: string): string {
  const firstDigit = cardNumber.charAt(0);
  switch (firstDigit) {
    case '4': return 'Visa';
    case '5': return 'Mastercard';
    case '3': return 'American Express';
    case '6': return 'Discover';
    default: return 'Unknown';
  }
}