import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Fallback when `VITE_AUTH_REDIRECT_URL` is unset and `window` is unavailable (e.g. tests). */
const DEFAULT_AUTH_REDIRECT = "http://localhost:5173/";

export function isSupabaseConfigured() {
  return Boolean(
    typeof url === "string" &&
      url.trim() &&
      typeof anonKey === "string" &&
      anonKey.trim()
  );
}

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
let _client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!_client) {
    _client = createClient(url.trim(), anonKey.trim(), {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return _client;
}

function normalizeRedirectBase(u) {
  const t = u.trim();
  return t.endsWith("/") ? t : `${t}/`;
}

/**
 * OAuth `redirectTo` — must be listed under Supabase → Auth → URL Configuration → Redirect URLs.
 * PKCE state lives on this origin’s storage; if this URL does not match the tab you use (e.g. port 3000 vs 5173), you get `bad_oauth_callback` / missing state.
 *
 * Order: `VITE_AUTH_REDIRECT_URL` → current `window.location.origin` → {@link DEFAULT_AUTH_REDIRECT}.
 */
export function getAuthRedirectUrl() {
  const explicit = import.meta.env.VITE_AUTH_REDIRECT_URL;
  if (typeof explicit === "string" && explicit.trim()) {
    return normalizeRedirectBase(explicit);
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return normalizeRedirectBase(window.location.origin);
  }
  if (import.meta.env.PROD) {
    console.warn(
      "[Eva] VITE_AUTH_REDIRECT_URL is unset and window missing; OAuth redirectTo falls back to localhost:5173. Set VITE_AUTH_REDIRECT_URL for production builds."
    );
  }
  return DEFAULT_AUTH_REDIRECT;
}
