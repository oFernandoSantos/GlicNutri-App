import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './configSupabase';

const GOOGLE_OAUTH_SCHEME = 'glicnutri';
const GOOGLE_OAUTH_CALLBACK_PATH = 'autenticacao/callback';
const GOOGLE_OAUTH_NATIVE_REDIRECT = `${GOOGLE_OAUTH_SCHEME}://${GOOGLE_OAUTH_CALLBACK_PATH}`;

function getGoogleRedirectTo() {
  if (Platform.OS === 'web') {
    return window.location.origin;
  }

  return GOOGLE_OAUTH_NATIVE_REDIRECT;
}

function readOAuthParamsFromUrl(url) {
  const params = {};
  const parsed = Linking.parse(url);

  Object.entries(parsed?.queryParams || {}).forEach(([key, value]) => {
    params[key] = value;
  });

  if (url.includes('#')) {
    const hashPart = url.split('#')[1];
    const hashParams = new URLSearchParams(hashPart);

    hashParams.forEach((value, key) => {
      if (!params[key]) {
        params[key] = value;
      }
    });
  }

  return params;
}

async function resolveNativeGoogleSession(returnedUrl) {
  const params = readOAuthParamsFromUrl(returnedUrl);

  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);

    if (error) {
      throw error;
    }

    return data?.session || null;
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });

    if (error) {
      throw error;
    }

    return data?.session || null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data?.session || null;
}

export function maybeCompleteGoogleOAuthSession() {
  WebBrowser.maybeCompleteAuthSession();
}

export async function startGoogleOAuth() {
  const redirectTo = getGoogleRedirectTo();

  console.log('Google OAuth redirectTo =>', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Nao foi possivel iniciar o fluxo do Google.');
  }

  if (Platform.OS === 'web') {
    window.location.href = data.url;
    return { redirected: true, session: null };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  console.log('Google OAuth result =>', result);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { cancelled: true, session: null };
  }

  if (result.type !== 'success' || !result.url) {
    throw new Error('Nao foi possivel concluir o fluxo do Google.');
  }

  const session = await resolveNativeGoogleSession(result.url);

  return {
    cancelled: false,
    redirected: false,
    session,
  };
}
