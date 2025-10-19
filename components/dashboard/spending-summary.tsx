'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type SpendingSummary = {
    total_spending: number
    total_transactions: number
  }

  export default function SpendingSummary({ summary }: { summary: SpendingSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Total Spending: {summary.total_spending}</p>
        <p>Total Transactions: {summary.total_transactions}</p>
      </CardContent>
    </Card>
  )
}