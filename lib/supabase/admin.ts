import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config/env';

/**
 * Admin Supabase client using the service role key.
 * Use ONLY on the server for admin-only endpoints (bypasses RLS).
 */
export function createAdminClient() {
  return createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey);
}