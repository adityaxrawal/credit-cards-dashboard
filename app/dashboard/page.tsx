import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CreditCardComponent from '@/components/dashboard/credit-card'
import SpendingSummary from '@/components/dashboard/spending-summary'
import TransactionList from '@/components/dashboard/transaction-list'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="space-y-8">
      <CreditCardComponent />
      <SpendingSummary />
      <TransactionList />
    </div>
  )
}