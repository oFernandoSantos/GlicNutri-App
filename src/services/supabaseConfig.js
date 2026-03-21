import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://isiweqkdoyxorohuibqb.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaXdlcWtkb3l4b3JvaHVpYnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODkzMDksImV4cCI6MjA4OTM2NTMwOX0.eGxS_47RDPHwRvdANeI18IjEuvSfWtSoONbbaAnTZuA'


export const supabase = createClient(supabaseUrl, supabaseAnonKey);