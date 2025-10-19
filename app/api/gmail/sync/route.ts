/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuth } from '@/lib/google'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { Database } from '@/lib/supabase/database.types'
import { parseEmail } from '@/lib/gmail/parser'
import { gmail_v1 } from 'googleapis'

async function getEmailDetails(auth: any, messageId: string) {
  const gmail = google.gmail({ version: 'v1', auth })
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  })
  return response.data
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('gmail_refresh_token')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.gmail_refresh_token) {
    return new Response('Missing Google refresh token', { status: 400 })
  }

  const auth = getGoogleAuth()
  auth.setCredentials({ refresh_token: profile.gmail_refresh_token })

  const gmail = google.gmail({ version: 'v1', auth })

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 10, // Limiting for now
    q: 'category:promotions OR category:primary',
  })

  if (!response.data.messages) {
    return NextResponse.json({
      message: 'No messages found',
      result: response.data.resultSizeEstimate,
    })
  }

  const emailPromises = response.data.messages.map(async (message) => {
    if (message.id) {
      const emailDetails = await getEmailDetails(auth, message.id)
      return parseEmail(JSON.stringify(emailDetails))
    }
    return null
  })

  const parsedEmails = await Promise.all(emailPromises)

  return NextResponse.json(parsedEmails.filter(Boolean))
}