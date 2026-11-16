import { createClient } from '@supabase/supabase-js'

// Ganti dengan URL dan Anon Key dari Project Settings > API di Supabase kamu
const SUPABASE_URL = 'https://pprnhxijexrmpvmzfdmv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwcm5oeGlqZXhybXB2bXpmZG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NTk2ODgsImV4cCI6MjEwOTEzNTY4OH0.8mHG2ZsSCkoO7taHU_LZtkkb3_tUs3d9TA1lGqx2aiM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)