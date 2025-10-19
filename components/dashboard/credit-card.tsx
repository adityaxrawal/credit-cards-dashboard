'use client'

import { useCards } from '@/hooks/use-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditCard } from '@/types'

export default function CreditCardComponent() {
  const { cards, isLoading } = useCards()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Cards</CardTitle>
      </CardHeader>
      <CardContent>
        {cards.map((card: CreditCard) => (
          <div key={card.id}>
            <p>{card.card_number}</p>
            <p>{card.card_holder_name}</p>
            <p>{card.expiry_date}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}