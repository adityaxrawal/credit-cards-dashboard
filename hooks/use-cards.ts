import { useRealtime } from './use-realtime'
import { CreditCard } from '@/types'

export function useCards() {
  const cards = useRealtime<CreditCard>('cards')
  return { cards, isLoading: cards.length === 0 }
}