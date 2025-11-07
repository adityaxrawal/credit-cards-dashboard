/**
 * Supabase client with service role key for backend operations
 * This bypasses Row Level Security and should only be used in trusted backend services
 * Singleton pattern ensures only one instance is created
 */
export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export default supabase;
