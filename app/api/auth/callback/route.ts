import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/backend/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    console.error('No code parameter found in callback');
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  try {
    const supabase = await createClient();
    
    // Exchange the code for a session
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      console.error('Error exchanging code for session:', sessionError);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    if (!sessionData.user) {
      console.error('No user found in session data');
      return NextResponse.redirect(`${origin}/login?error=no_user`);
    }

    const userId = sessionData.user.id;
    
    // Check if this is a new user by querying the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('created_at, email, full_name')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      console.error('Error fetching user profile:', profileError);
      return NextResponse.redirect(`${origin}/login?error=profile_fetch_failed`);
    }

    // Determine if this is a new user (created within the last 60 seconds)
    const newUser = profile ? 
      (new Date().getTime() - new Date(profile.created_at).getTime()) < 60000 : 
      true; // If no profile exists, it's definitely a new user

    if (newUser) {
      console.log('New user detected, redirecting to loading page for initial sync');
      
      // For new users, we'll redirect to a loading page where the initial sync will be triggered
      // The actual job enqueueing will happen in the loading page component or a separate API endpoint
      // This is because we need the job queue system to be set up first (which comes in Phase 5)
      
      return NextResponse.redirect(`${origin}/loading?new_user=true`);
    } else {
      console.log('Existing user, redirecting to dashboard');
      
      // For existing users, redirect directly to dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }

  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(`${origin}/login?error=unexpected`);
  }
}