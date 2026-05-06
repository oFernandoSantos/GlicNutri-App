import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const envSupabaseUrl = globalThis?.process?.env?.EXPO_PUBLIC_SUPABASE_URL;
const envSupabaseAnonKey = globalThis?.process?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseUrl =
  String(envSupabaseUrl || '').trim() || 'https://isiweqkdoyxorohuibqb.supabase.co';
export const supabaseAnonKey =
  String(envSupabaseAnonKey || '').trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaXdlcWtkb3l4b3JvaHVpYnFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODkzMDksImV4cCI6MjA4OTM2NTMwOX0.eGxS_47RDPHwRvdANeI18IjEuvSfWtSoONbbaAnTZuA';


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});
