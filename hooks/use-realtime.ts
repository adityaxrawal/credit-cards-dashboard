import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtime<T>(table: string) {
  const [data, setData] = useState<T[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        console.error(error)
        return
      }
      setData(data as T[])
    }

    fetchData()

    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          console.log('Change received!', payload)
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, table])

  return data
}