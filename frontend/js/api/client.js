import { getSupabase } from "../auth/supabaseClient.js";

const API = "";

async function authHeaders() {
  const supabase = getSupabase();
  if (!supabase) return {};
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function jsonHeaders() {
  const a = await authHeaders();
  return { "Content-Type": "application/json", ...a };
}

export async function fetchOnboardingStatus() {
  const res = await fetch(`${API}/onboarding/status`, {
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export async function postOnboardingStep(body) {
  const res = await fetch(`${API}/onboarding/step`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function postOnboard(body) {
  const res = await fetch(`${API}/onboard`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Diet + workout — POST /generate-full-plan */
export async function postGenerateFullPlan(body) {
  const res = await fetch(`${API}/generate-full-plan`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

export async function postFeedback(body) {
  const res = await fetch(`${API}/feedback`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`);
  }
  return data;
}
