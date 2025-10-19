import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: limits, error } = await supabase.from('spending_limits').select('*')

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  return NextResponse.json(limits)
}