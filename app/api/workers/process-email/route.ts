import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue/worker';
import { gmailClient } from '@/lib/services/gmail-client';
import { EmailParserService, ParsedEmail } from '@/lib/services/email-parser';
import { createClient } from '@/src/backend/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { verifyQstashRequest } from '@/lib/qstash/verify';

interface ProcessEmailRequest {
  jobId: string;
  userId: string;
  data: {
    messageId: string;
    historyId?: string;
    forceReprocess?: boolean;
  };
}

export async function POST(request: NextRequest) {
  let body: ProcessEmailRequest | null = null;
  try {
    const verification = await verifyQstashRequest<ProcessEmailRequest>(request);
    if (!verification.valid || !verification.body) {
      return NextResponse.json({ error: verification.error ?? 'Unauthorized' }, { status: 401 });
    }
    body = verification.body;
    const { jobId, userId, data } = body;

    // Update job status to processing
    await jobQueue.updateJob(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0,
      message: 'Starting email processing...',
    });

    const supabase = await createClient();
    const emailParser = new EmailParserService();

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 20,
      message: 'Fetching email from Gmail...',
    });

    // Fetch the specific email
    const message = await gmailClient.fetchEmailById(userId, data.messageId);
    
    if (!message) {
      await jobQueue.updateJob(jobId, {
        status: 'failed',
        error: 'Email not found',
        completedAt: new Date(),
      });
      
      return NextResponse.json({
        success: false,
        error: 'Email not found',
      }, { status: 404 });
    }

    await jobQueue.updateJob(jobId, {
      progress: 40,
      message: 'Extracting email content...',
    });

    // Extract email content
    const { subject, from, body: emailBody, date } = gmailClient.extractEmailContent(message);

    await jobQueue.updateJob(jobId, {
      progress: 60,
      message: 'Parsing email for financial data...',
    });

    // Parse email
    const parsed = emailParser.parseEmail({
      subject,
      sender: from,
      body: emailBody,
      date,
    });

    if (!parsed) {
      await jobQueue.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        message: 'Email processed - no financial data found',
      });

      return NextResponse.json({
        success: true,
        processed: false,
        reason: 'No financial data found in email',
      });
    }

    await jobQueue.updateJob(jobId, {
      progress: 80,
      message: `Found ${parsed.type} data. Processing...`,
    });

    let result: { isNew: boolean; transactionId?: string; statementId?: string; cardId?: string } = { isNew: false };

    if (parsed.type === 'transaction') {
      result = await processTransaction(supabase, userId, parsed, data.messageId, data.forceReprocess);
    } else if (parsed.type === 'statement') {
      result = await processStatement(supabase, userId, parsed, data.messageId, data.forceReprocess);
    }

    // Complete the job
    await jobQueue.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      message: `Email processed successfully. ${parsed.type} ${result.isNew ? 'created' : 'updated'}.`,
    });

    return NextResponse.json({
      success: true,
      processed: true,
      type: parsed.type,
      ...result,
    });

  } catch (error) {
    console.error('Process email worker error:', error);
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
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Process transaction email
async function processTransaction(
  supabase: SupabaseClient,
  userId: string,
  parsed: ParsedEmail,
  messageId: string,
  forceReprocess = false
): Promise<{ isNew: boolean; transactionId?: string; cardId?: string }> {
  const cardLast4 = getCardLast4(parsed.cardNumber);

  // Check if already processed (unless force reprocess)
  if (!forceReprocess) {
    const { data: existingTransaction } = await supabase
      .from('current_transactions')
      .select('id')
      .eq('gmail_message_id', messageId)
      .single();

    if (existingTransaction) {
      return { isNew: false, transactionId: existingTransaction.id };
    }
  }

  // Check for duplicate transaction by amount, merchant, and date
  const isDuplicate = await checkDuplicateTransaction(
    supabase,
    cardLast4,
    parsed.amount || 0,
    parsed.merchant || '',
    parsed.date || new Date()
  );

  if (isDuplicate && !forceReprocess) {
    return { isNew: false };
  }

  // Find or create credit card
  const card = await findOrCreateCard(supabase, userId, parsed);

  // Store transaction
  const { data: transaction, error } = await supabase
    .from('current_transactions')
    .insert({
      user_id: userId,
      card_id: card.id,
      amount: parsed.amount || 0,
      merchant: parsed.merchant || 'Unknown',
      category: parsed.category || 'Other',
      date: (parsed.date || new Date()).toISOString(),
      description: `${parsed.merchant || 'Transaction'} - ${parsed.amount || 0}`,
      transaction_type: parsed.transactionType || 'debit',
      card_last_4: cardLast4,
      is_processed: true,
      gmail_message_id: messageId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store transaction: ${error.message}`);
  }

  // If new card, enqueue perks fetching job
  if (card.isNew) {
    await jobQueue.enqueue('fetch-perks', userId, {
      cardId: card.id,
      cardType: parsed.cardNumber ? getCardType(parsed.cardNumber) : 'Unknown',
    });
  }

  // Check spending limits for this card
  await jobQueue.enqueue('check-spending-limits', userId, {
    cardId: card.id,
    transactionAmount: parsed.amount || 0,
    category: parsed.category || 'Other',
  });

  return { 
    isNew: true, 
    transactionId: transaction.id, 
    cardId: card.id 
  };
}

// Process statement email
async function processStatement(
  supabase: SupabaseClient,
  userId: string,
  parsed: ParsedEmail,
  messageId: string,
  forceReprocess = false
): Promise<{ isNew: boolean; statementId?: string; cardId?: string }> {
  const cardLast4 = getCardLast4(parsed.cardNumber);

  // Check if already processed (unless force reprocess)
  if (!forceReprocess) {
    const { data: existingStatement } = await supabase
      .from('statements')
      .select('id')
      .eq('gmail_message_id', messageId)
      .single();

    if (existingStatement) {
      return { isNew: false, statementId: existingStatement.id };
    }
  }

  // Find card
  const card = await findCardByLast4(supabase, userId, cardLast4);
  
  if (!card) {
    // Create card if it doesn't exist
    const newCard = await findOrCreateCard(supabase, userId, parsed);
    
    // Create statement
    const { data: statement, error } = await supabase
      .from('statements')
      .insert({
        card_id: newCard.id,
        statement_date: (parsed.date || new Date()).toISOString(),
        due_date: parsed.date?.toISOString(),
        total_amount: parsed.amount || 0,
        minimum_amount: 0,
        available_credit: 0,
        gmail_message_id: messageId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create statement: ${error.message}`);
    }

    return { 
      isNew: true, 
      statementId: statement.id, 
      cardId: newCard.id 
    };
  }

  // Create statement for existing card
  const { data: statement, error } = await supabase
    .from('statements')
    .insert({
      card_id: card.id,
      statement_date: (parsed.date || new Date()).toISOString(),
      due_date: parsed.date?.toISOString(),
      total_amount: parsed.amount || 0,
      minimum_amount: 0,
      available_credit: 0,
      gmail_message_id: messageId,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create statement: ${error.message}`);
  }

  return { 
    isNew: true, 
    statementId: statement.id, 
    cardId: card.id 
  };
}

// Helper functions (reused from initial-sync)

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