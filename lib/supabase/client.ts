import { createBrowserClient } from '@supabase/ssr'
import { config } from '../config/env'

export const createClient = () =>
  createBrowserClient(
    config.supabase.url,
    config.supabase.anonKey
  )