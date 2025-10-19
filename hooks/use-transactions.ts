import { useRealtime } from './use-realtime'
import { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']

export function useTransactions(initialTransactions?: Transaction[]) {
  return useRealtime<Transaction>('transactions', initialTransactions)
}