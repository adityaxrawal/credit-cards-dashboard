import { useRealtime } from './use-realtime'
import { Transaction } from '@/types'

export function useTransactions() {
  const transactions = useRealtime<Transaction>('transactions')
  return { transactions, isLoading: transactions.length === 0 }
}