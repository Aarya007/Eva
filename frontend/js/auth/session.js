// ═══════════════════════════════════════════
// EVA — SESSION / AUTH GUARD
// ═══════════════════════════════════════════
import { getSupabase, getAuthRedirectUrl } from './supabase.js';

export async function getSession() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  return { session, user: session.user ?? null };
}

/**
 * Get the access token (Bearer) for API calls.
 * Refreshes automatically via Supabase SDK.
 */
export async function getAccessToken() {
  const data = await getSession();
  return data?.session?.access_token ?? null;
}

/**
 * Sign out and reload.
 */
export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  window.location.reload();
}

export function onAuthChange(callback) {
  const sb = getSupabase();
  if (!sb) return { data: { subscription: { unsubscribe() {} } } };
  return sb.auth.onAuthStateChange(callback);
}

/**
 * Sign in with email + password.
 * @returns {{ error: Error|null }}
 */
export async function signInWithPassword(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not configured') };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return { error };
}

/**
 * Sign up with email + password.
 */
export async function signUpWithPassword(email, password) {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not configured') };
  const { error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  return { error };
}

/**
 * Sign in with Google OAuth (PKCE).
 */
export async function signInWithGoogle() {
  const sb = getSupabase();
  if (!sb) return { error: new Error('Supabase not configured') };
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getAuthRedirectUrl() },
  });
  return { error };
}
