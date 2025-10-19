import { createClient } from '@/lib/supabase/server'
import { getGoogleAuth } from '@/lib/google'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('google_refresh_token')
    .single()

  if (!profile || !profile.google_refresh_token) {
    return new Response('Missing Google refresh token', { status: 400 })
  }

  const auth = getGoogleAuth()
  auth.setCredentials({ refresh_token: profile.google_refresh_token })

  const gmail = google.gmail({ version: 'v1', auth })

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'from:me subject:"Your credit card statement" is:unread',
  })

  return NextResponse.json(response.data)
}