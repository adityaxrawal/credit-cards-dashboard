import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sseManager } from '@/lib/sse/manager';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = user.id;

    // Parse request body
    const { type, data } = await request.json();

    if (!type || !data) {
      return new NextResponse('Missing type or data', { status: 400 });
    }

    // Validate notification type
    const validTypes = ['transaction:new', 'statement:generated', 'limit:exceeded'];
    if (!validTypes.includes(type)) {
      return new NextResponse('Invalid notification type', { status: 400 });
    }

    // Send notification to user
    await sseManager.sendToUser(userId, type, data);

    console.log(`Test notification sent to user ${userId}:`, { type, data });

    return NextResponse.json({ 
      success: true, 
      message: `${type} notification sent successfully`,
      userId,
      type,
      data
    });

  } catch (error) {
    console.error('Error sending test notification:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}