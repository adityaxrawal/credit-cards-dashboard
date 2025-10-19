'use client'

import { useTransactions } from '@/hooks/use-transactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Transaction } from '@/types'

export default function SpendingSummary() {
  const { transactions, isLoading } = useTransactions()

  if (isLoading) {
    return <div>Loading...</div>
  }

  const totalSpending = transactions.reduce((acc: number, curr: Transaction) => acc + curr.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Total Spending: {totalSpending}</p>
      </CardContent>
    </Card>
  )
}