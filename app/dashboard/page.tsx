import { createClient } from '@/lib/supabase/server'
import DashboardClient from './client'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  const { data: cards } = await supabase.from('credit_cards').select('*').eq('user_id', user.id)
  const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', user.id)

  return <DashboardClient cards={cards || []} transactions={transactions || []} />
}