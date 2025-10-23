import { createBrowserClient } from '@supabase/ssr'

// Read public envs with literal keys so Next can inline them in the browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )