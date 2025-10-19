'use client'

import CardStack from '@/components/dashboard/card-stack'
import Header from '@/components/dashboard/header'
import Sidebar from '@/components/dashboard/sidebar'
import Transactions from '@/components/dashboard/transactions'
import { useCards } from '@/hooks/use-cards'
import { useTransactions } from '@/hooks/use-transactions'
import { type Database } from '@/types/database'
import { useState } from 'react';

type CreditCard = Database['public']['Tables']['credit_cards']['Row']
type Transaction = Database['public']['Tables']['transactions']['Row']

export default function DashboardClient({ cards: initialCards, transactions: initialTransactions }: { cards: CreditCard[], transactions: Transaction[] }) {
  const cards = useCards(initialCards)
  const transactions = useTransactions(initialTransactions)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isSidebarOpen={isSidebarOpen} />
      <div className="flex flex-1 flex-col">
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CardStack cards={cards} />
            </div>
            <div className="lg:col-span-1">
              {/* Placeholder for other content */}
            </div>
          </div>
          <div className="mt-6">
            <Transactions transactions={transactions} cards={cards} />
          </div>
        </main>
      </div>
    </div>
  )
}