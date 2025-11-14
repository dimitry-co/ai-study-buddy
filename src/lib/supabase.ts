import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// createBrowserClient stores auth in HTTP cookies (works with API routes)
// createClient stores in localStorage (API routes can't access)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);