import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGmailService } from '@/lib/services/gmail';

interface SetupRequest {
  topicName?: string;
  forceSetup?: boolean;
}

interface WatchConfig {
  historyId?: string;
  expiration?: number;
  topicName?: string;
}

/**
 * POST handler to setup Gmail push notifications for authenticated users
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Gmail setup API called');
    
    // Verify authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in to setup Gmail integration' },
        { status: 401 }
      );
    }

    console.log(`Setting up Gmail integration for user: ${user.id}`);

    // Parse request body
    const body: SetupRequest = await request.json().catch(() => ({}));
    const { topicName, forceSetup = false } = body;

    // Use environment variable for Pub/Sub topic name if not provided
    const pubsubTopic = topicName || process.env.GMAIL_PUBSUB_TOPIC;
    
    if (!pubsubTopic) {
      console.error('No Pub/Sub topic name provided');
      return NextResponse.json(
        { error: 'Pub/Sub topic name is required' },
        { status: 400 }
      );
    }

    // Check if user already has Gmail tokens
    const { data: existingToken, error: tokenError } = await supabase
      .from('gmail_tokens')
      .select('id, is_active, watch_config, created_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError && tokenError.code !== 'PGRST116') {
      console.error('Error checking existing Gmail tokens:', tokenError);
      return NextResponse.json(
        { error: 'Failed to check existing Gmail integration' },
        { status: 500 }
      );
    }

    if (!existingToken) {
      console.error('No Gmail tokens found for user');
      return NextResponse.json(
        { error: 'Gmail authentication required - Please complete OAuth flow first' },
        { status: 400 }
      );
    }

    if (!existingToken.is_active) {
      console.error('Gmail tokens are inactive');
      return NextResponse.json(
        { error: 'Gmail integration is inactive - Please re-authenticate' },
        { status: 400 }
      );
    }

    // Check if watch is already configured and not expired
    if (existingToken.watch_config && !forceSetup) {
      const watchConfig = existingToken.watch_config as WatchConfig;
      const now = Date.now();
      
      if (watchConfig.expiration && watchConfig.expiration > now) {
        console.log('Gmail watch already configured and active');
        return NextResponse.json({
          success: true,
          message: 'Gmail push notifications are already configured',
          watchConfig: {
            historyId: watchConfig.historyId,
            expiration: new Date(watchConfig.expiration).toISOString(),
            isActive: true,
          },
        });
      }
    }

    // Create Gmail service and setup watch
    try {
      const gmailService = createGmailService(user.id);
      
      console.log(`Setting up Gmail watch with topic: ${pubsubTopic}`);
      await gmailService.setupWatch(pubsubTopic);
      
      // Get updated watch configuration
      const { data: updatedToken, error: fetchError } = await supabase
        .from('gmail_tokens')
        .select('watch_config')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching updated watch config:', fetchError);
        throw new Error('Failed to fetch updated watch configuration');
      }

      const watchConfig = updatedToken.watch_config as WatchConfig;
      
      console.log('Gmail watch setup completed successfully');
      
      return NextResponse.json({
        success: true,
        message: 'Gmail push notifications configured successfully',
        watchConfig: {
          historyId: watchConfig?.historyId,
          expiration: watchConfig?.expiration ? new Date(watchConfig.expiration).toISOString() : null,
          isActive: true,
          setupAt: new Date().toISOString(),
        },
      });

    } catch (gmailError) {
      console.error('Gmail service error:', gmailError);
      
      // Check if it's a token refresh issue
      if (gmailError instanceof Error && gmailError.message.includes('token')) {
        return NextResponse.json(
          { error: 'Gmail authentication expired - Please re-authenticate' },
          { status: 401 }
        );
      }
      
      // Check if it's a quota/rate limit issue
      if (gmailError instanceof Error && gmailError.message.includes('quota')) {
        return NextResponse.json(
          { error: 'Gmail API quota exceeded - Please try again later' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to setup Gmail watch: ${gmailError instanceof Error ? gmailError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Gmail setup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler to check Gmail setup status
 */
export async function GET() {
  try {
    console.log('Gmail setup status check');
    
    // Verify authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Gmail token status
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_tokens')
      .select('id, is_active, watch_config, created_at, updated_at')
      .eq('user_id', user.id)
      .single();

    if (tokenError && tokenError.code !== 'PGRST116') {
      console.error('Error checking Gmail token status:', tokenError);
      return NextResponse.json(
        { error: 'Failed to check Gmail integration status' },
        { status: 500 }
      );
    }

    if (!tokenData) {
      return NextResponse.json({
        isConfigured: false,
        isActive: false,
        message: 'Gmail authentication required',
      });
    }

    const watchConfig = tokenData.watch_config as WatchConfig;
    const now = Date.now();
    const isWatchActive = watchConfig?.expiration && watchConfig.expiration > now;

    return NextResponse.json({
      isConfigured: !!watchConfig,
      isActive: tokenData.is_active && isWatchActive,
      watchConfig: watchConfig ? {
        historyId: watchConfig.historyId,
        expiration: watchConfig.expiration ? new Date(watchConfig.expiration).toISOString() : null,
        isExpired: watchConfig.expiration ? watchConfig.expiration <= now : true,
      } : null,
      tokenStatus: {
        isActive: tokenData.is_active,
        createdAt: tokenData.created_at,
        updatedAt: tokenData.updated_at,
      },
    });

  } catch (error) {
    console.error('Gmail setup status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler to disable Gmail push notifications
 */
export async function DELETE() {
  try {
    console.log('Gmail setup deletion requested');
    
    // Verify authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Clear watch configuration
    const { error: updateError } = await supabase
      .from('gmail_tokens')
      .update({
        watch_config: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error clearing watch configuration:', updateError);
      return NextResponse.json(
        { error: 'Failed to disable Gmail push notifications' },
        { status: 500 }
      );
    }

    console.log('Gmail push notifications disabled successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Gmail push notifications disabled successfully',
    });

  } catch (error) {
    console.error('Gmail setup deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}