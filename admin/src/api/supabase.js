import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://rqdsbclaxfrrpupaquxg.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_ANON_KEY && import.meta.env.DEV) {
  console.warn('[supabase] VITE_SUPABASE_ANON_KEY is not set — Realtime subscriptions will not work.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
