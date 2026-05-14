import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const envSupabaseUrl = globalThis?.process?.env?.EXPO_PUBLIC_SUPABASE_URL;
const envSupabaseAnonKey = globalThis?.process?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseUrl = String(envSupabaseUrl || '').trim();
export const supabaseAnonKey = String(envSupabaseAnonKey || '').trim();

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
