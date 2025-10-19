/* eslint-disable @typescript-eslint/no-explicit-any */
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

  const decodedData = Buffer.from(message.data, 'base64').toString('utf-8')
  const messageData = JSON.parse(decodedData)
  const emailAddress = messageData.emailAddress
  const historyId = messageData.historyId

  const historyResponse = await gmail.users.history.list({
    userId: 'me',
    startHistoryId: historyId,
    historyTypes: ['messageAdded'],
  })

  if (!historyResponse.data.history) {
    return NextResponse.json({ success: true, message: 'No new messages' })
  }

  const messageId = historyResponse.data.history[0].messages?.[0].id

  if (!messageId) {
    return NextResponse.json({ success: true, message: 'No new messages' })
  }

  const messageDetails = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  })

  const transactions = parseEmail(JSON.stringify(messageDetails.data))

  if (transactions) {
    const supabase = await createClient()
    const { data: card } = await supabase
      .from('credit_cards')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (card) {
      const transactionsWithCardId = transactions.map((transaction) => ({
        ...transaction,
        card_id: card.id,
        user_id: user.id,
      }))
      await supabase.from('transactions').insert(transactionsWithCardId)
    }
  }

  return NextResponse.json({ success: true })
}