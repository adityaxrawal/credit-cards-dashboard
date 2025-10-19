import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: limits, error } = await supabase
    .from('spending_limits')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  return NextResponse.json(limits)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await request.json()

  const { data: limit, error } = await supabase
    .from('spending_limits')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  return NextResponse.json(limit)
}