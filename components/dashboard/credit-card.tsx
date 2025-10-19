'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { Database } from '@/types/database'

  type CreditCard = Database['public']['Tables']['credit_cards']['Row']

  export default function CreditCard({ card }: { card: CreditCard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{card.bank_name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>**** **** **** {card.card_last_4}</p>
        <p>Due Date: {card.due_date}</p>
        <p>Current Due: {card.current_due}</p>
      </CardContent>
    </Card>
  )
}