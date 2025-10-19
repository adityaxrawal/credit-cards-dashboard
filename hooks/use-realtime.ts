import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type TableName = keyof Database['public']['Tables']

export function useRealtime<T>(table: TableName, initialData?: T[]) {
  const [data, setData] = useState<T[]>(initialData || [])
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id)
      if (error) {
        console.error(error)
        return
      }
      setData(data as T[])
    }

    if (initialData === undefined) {
      fetchData()
    }

    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, table, initialData])

  return data
}