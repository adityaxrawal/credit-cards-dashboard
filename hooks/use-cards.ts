import { useRealtime } from './use-realtime'
import { Database } from '@/types/database'

type CreditCard = Database['public']['Tables']['credit_cards']['Row']

export function useCards(initialCards?: CreditCard[]) {
  return useRealtime<CreditCard>('credit_cards', initialCards)
}