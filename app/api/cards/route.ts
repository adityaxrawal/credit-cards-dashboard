import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: cards, error } = await supabase.from('credit_cards').select('*')

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  return NextResponse.json(cards)
}