'use client'

import { useTransactions } from '@/hooks/use-transactions'
import { Transaction } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TransactionList() {
  const { transactions, isLoading } = useTransactions()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {transactions.map((transaction: Transaction) => (
            <li key={transaction.id}>
              <p>{transaction.description}</p>
              <p>{transaction.amount}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}