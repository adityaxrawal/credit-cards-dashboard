import { NextRequest, NextResponse } from 'next/server';
import { jobQueue } from '@/lib/queue/worker';
import { GmailService } from '@/lib/services/gmail';
import { sseManager } from '@/lib/sse/manager';

interface SetupGmailRequest {
  jobId: string;
  userId: string;
  data: {
    topicName?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SetupGmailRequest = await request.json();
    const { jobId, userId, data } = body;

    // Update job status to processing
    await jobQueue.updateJob(jobId, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0,
      message: 'Starting Gmail Pub/Sub setup...',
    });

    // Send SSE progress update
    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-2',
      progress: 0,
      message: 'Preparing Gmail setup...'
    });

    // Get topic name from environment or data
    const topicName = data.topicName || process.env.GMAIL_PUBSUB_TOPIC;
    if (!topicName) {
      throw new Error('Gmail Pub/Sub topic name not configured');
    }

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 20,
      message: 'Initializing Gmail service...',
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-2',
      progress: 20,
      message: 'Initializing Gmail service...'
    });

    // Create Gmail service instance
    const gmailService = new GmailService(userId);

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 40,
      message: 'Authenticating with Gmail API...',
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-2',
      progress: 40,
      message: 'Authenticating with Gmail...'
    });

    // Test Gmail connection by getting client
    await gmailService.getClient();

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 60,
      message: 'Setting up Gmail push notifications...',
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-2',
      progress: 60,
      message: 'Setting up push notifications...'
    });

    // Setup Gmail watch with Pub/Sub
    await gmailService.setupWatch(topicName);

    // Update progress
    await jobQueue.updateJob(jobId, {
      progress: 80,
      message: 'Verifying Gmail watch setup...',
    });

    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-2',
      progress: 80,
      message: 'Verifying setup...'
    });

    // Complete the job
    await jobQueue.updateJob(jobId, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      message: 'Gmail Pub/Sub setup completed successfully.',
    });

    // Send final SSE progress update
    await sseManager.sendToUser(userId, 'progress', {
      process: 'process-2',
      progress: 100,
      message: '✅ Gmail integration ready'
    });

    return NextResponse.json({
      success: true,
      message: 'Gmail Pub/Sub setup completed successfully',
      topicName,
    });

  } catch (error) {
    console.error('Setup Gmail worker error:', error);
    
    // Update job with error
    const { jobId, userId } = await request.json().catch(() => ({ jobId: 'unknown', userId: 'unknown' }));
    
    if (jobId !== 'unknown') {
      await jobQueue.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    }

    // Send error SSE update
    if (userId !== 'unknown') {
      await sseManager.sendToUser(userId, 'progress', {
        process: 'process-2',
        progress: 0,
        message: `❌ Gmail setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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