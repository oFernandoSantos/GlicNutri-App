import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export { supabaseUrl, supabaseAnonKey };

/** Nao commite chaves no codigo: use .env / EAS Secrets (EXPO_PUBLIC_*). */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (__DEV__ && !isSupabaseConfigured) {
  console.warn(
    '[GlicNutri] Supabase nao configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (veja .env.example).'
  );
}

const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder-nao-use-em-producao';

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : placeholderUrl,
  isSupabaseConfigured ? supabaseAnonKey : placeholderKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  }
);
