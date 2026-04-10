// ═══════════════════════════════════════════
// EVA — SUPABASE CLIENT
// ═══════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const url     = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const DEFAULT_REDIRECT = 'http://localhost:3000/';

export function isSupabaseConfigured() {
  return Boolean(
    typeof url === 'string' && url.trim() &&
    typeof anonKey === 'string' && anonKey.trim()
  );
}

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(url.trim(), anonKey.trim(), {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  }
  return _client;
}

function normalizeBase(u) {
  const t = u.trim();
  return t.endsWith('/') ? t : `${t}/`;
}

export function getAuthRedirectUrl() {
  const explicit = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (typeof explicit === 'string' && explicit.trim()) return normalizeBase(explicit);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeBase(window.location.origin);
  }
  return DEFAULT_REDIRECT;
}
