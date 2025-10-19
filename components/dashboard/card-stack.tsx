import { type Database } from '@/types/database'
import CreditCardComponent from './credit-card'
import Link from 'next/link'

type CreditCard = Database['public']['Tables']['credit_cards']['Row']

export default function CardStack({ cards }: { cards: CreditCard[] }) {
  return (
    <div className="relative h-48 w-full">
      {cards.map((card, index) => (
        <Link key={card.id} href={`/dashboard/cards/${card.id}`}>
          <div
            className="absolute cursor-pointer transition-all duration-300 ease-in-out hover:scale-105"
            style={{
              transform: `translateY(${index * 20}px) scale(${1 - index * 0.05})`,
              zIndex: cards.length - index,
            }}
          >
            <CreditCardComponent card={card} />
          </div>
        </Link>
      ))}
    </div>
  )
}