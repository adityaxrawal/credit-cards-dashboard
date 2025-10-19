'use client'

import { type Database } from '@/types/database'
import { useState } from 'react'

type Transaction = Database['public']['Tables']['transactions']['Row']
type CreditCard = Database['public']['Tables']['credit_cards']['Row']

export default function Transactions({ transactions, cards }: { transactions: Transaction[], cards: CreditCard[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  const filteredTransactions = transactions
    .filter((transaction) =>
      transaction.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((transaction) =>
      selectedCard ? transaction.card_id === selectedCard : true
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Transactions</h2>
        <div className="flex items-center gap-4">
          <select
            value={selectedCard || ''}
            onChange={(e) => setSelectedCard(e.target.value)}
            className="p-2 border rounded"
          >
            <option value="">All Cards</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.bank_name} ****{card.card_last_4}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search transactions..."
            className="w-64 rounded-lg border border-gray-300 py-2 px-4 focus:border-blue-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="rounded-lg border border-gray-200">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Transaction</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="px-6 py-4 whitespace-nowrap">{transaction.description}</td>
                <td className="px-6 py-4 whitespace-nowrap">${transaction.amount.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(transaction.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}