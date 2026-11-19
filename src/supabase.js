import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pprnhxijexrmpvmzfdmv.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'TEMPEL_ANON_KEY_SUPABASE_ANDA_DI_SINI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
