import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getGoogleAuth } from '@/lib/google'
import { createClient } from '@/lib/supabase/server'
import { parseEmail } from '@/lib/gmail/parser'

export async function POST(request: Request) {
  const body = await request.json()
  const message = body.message

  if (!message) {
    return new Response('Bad Request', { status: 400 })
  }

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

  const messageId = Buffer.from(message.data, 'base64').toString('utf-8')

  const messageDetails = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  })

  const transactions = parseEmail(messageDetails.data.snippet || '')

  if (transactions.length > 0) {
    const supabase = await createClient()
    await supabase.from('transactions').insert(transactions)
  }

  return NextResponse.json({ success: true })
}