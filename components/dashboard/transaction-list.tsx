'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']

export default function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.map((transaction) => (
          <div key={transaction.id}>
            <p>{transaction.description}</p>
            <p>{transaction.amount}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}