import { createClient } from '@supabase/supabase-js'

// Gunakan URL Supabase asli Anda yang benar
const supabaseUrl = 'https://pprnhxijexrmpvmzfdmv.supabase.co'
const supabaseKey = 'SUPABASE_ANON_KEY_ANDA_DISINI' // Pastikan Anon Key Anda tetap sesuai

export const supabase = createClient(supabaseUrl, supabaseKey)