import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cvccxxwkjphryzkmbcjv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_aumvKd8xGotyq1jWUowYgA_xQ3e2L76';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
