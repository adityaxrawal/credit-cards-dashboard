import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sseManager } from '@/lib/sse/manager';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = user.id;

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Register connection with SSE manager
        sseManager.addConnection(userId, controller);
        
        console.log(`SSE connection established for user: ${userId}`);
      },
      cancel() {
        // Remove connection when client disconnects
        sseManager.removeConnection(userId);
        
        console.log(`SSE connection closed for user: ${userId}`);
      }
    });

    // Return response with proper SSE headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    console.error('SSE endpoint error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control, Authorization',
    },
  });
}