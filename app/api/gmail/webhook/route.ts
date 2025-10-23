import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { jobQueue } from '@/lib/queue/worker';
import { apiWrapper, validationError } from '@/lib/utils/api-error';

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
}

/**
 * POST handler for Gmail Pub/Sub webhook notifications
 */
export async function POST(request: NextRequest) {
  return apiWrapper(async () => {
    console.log('Gmail webhook received POST request');
    
    // Parse the incoming Pub/Sub message
    const body: PubSubMessage = await request.json();
    
    if (!body.message?.data) {
      console.error('Invalid Pub/Sub message format - missing data');
      throw new Error('Invalid message format');
    }

    // Decode base64 data
    let decodedData: GmailPushNotification;
    try {
      const decodedString = Buffer.from(body.message.data, 'base64').toString('utf-8');
      decodedData = JSON.parse(decodedString);
      console.log('Decoded Gmail notification:', decodedData);
    } catch (error) {
      console.error('Failed to decode Pub/Sub message data:', error);
      throw new Error('Failed to decode message data');
    }

    // Extract emailAddress and historyId
    const { emailAddress, historyId } = decodedData;
    
    if (!emailAddress || !historyId) {
      console.error('Missing required fields in Gmail notification:', { emailAddress, historyId });
      throw new Error('Missing emailAddress or historyId');
    }

    // Find user by email in profiles table
    const supabase = await createClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', emailAddress)
      .single();

    if (profileError || !profile) {
      console.log(`No user found for email: ${emailAddress}`);
      // Return success to acknowledge receipt even if user not found
      // This prevents Pub/Sub from retrying
      return { 
        success: true, 
        message: 'User not found, but message acknowledged' 
      };
    }

    console.log(`Found user ${profile.id} for email ${emailAddress}`);

    // Check if we have Gmail tokens for this user
    const { data: gmailToken, error: tokenError } = await supabase
      .from('gmail_tokens')
      .select('id, is_active')
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .single();

    if (tokenError || !gmailToken) {
      console.log(`No active Gmail tokens found for user ${profile.id}`);
      return { 
        success: true, 
        message: 'No active Gmail tokens, but message acknowledged' 
      };
    }

    // Get the current watch configuration to compare history IDs
    const { data: currentToken } = await supabase
      .from('gmail_tokens')
      .select('watch_config')
      .eq('user_id', profile.id)
      .single();

    const currentHistoryId = currentToken?.watch_config?.historyId;

    // Only process if this is a newer history ID
    if (currentHistoryId && parseInt(historyId) <= parseInt(currentHistoryId)) {
      console.log(`History ID ${historyId} is not newer than current ${currentHistoryId}, skipping`);
      return { 
        success: true, 
        message: 'History ID not newer, skipping processing' 
      };
    }

    // Enqueue 'process-email' job with the history ID
    // The worker will fetch new messages since the last history ID
    const jobId = await jobQueue.enqueue('process-email', profile.id, {
      historyId: historyId,
      emailAddress: emailAddress,
      messageId: body.message.messageId,
      source: 'gmail-webhook',
    });

    console.log(`Enqueued process-email job ${jobId} for user ${profile.id}`);

    // Update the stored history ID
    await supabase
      .from('gmail_tokens')
      .update({
        watch_config: {
          ...currentToken?.watch_config,
          historyId: historyId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', profile.id);

    return {
      success: true,
      jobId: jobId,
      message: 'Email processing job enqueued successfully',
    };
  });
}

/**
 * GET handler for Gmail webhook verification
 * Used by Google to verify the webhook endpoint
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Gmail webhook received GET request for verification');
    
    // Get the challenge parameter from the URL
    const { searchParams } = new URL(request.url);
    const challenge = searchParams.get('hub.challenge');
    
    if (!challenge) {
      console.error('No challenge parameter found in verification request');
      return NextResponse.json(
        { error: 'Missing challenge parameter' },
        { status: 400 }
      );
    }

    console.log(`Gmail webhook verification challenge: ${challenge}`);
    
    // Return the challenge as plain text response
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error) {
    console.error('Gmail webhook verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}