// ═══════════════════════════════════════════
// EVA — API CLIENT
// All fetch() calls with Bearer auth headers
// ═══════════════════════════════════════════
import { getAccessToken, signOut } from '../auth/session.js';

const API = ''; // same-origin via Vite proxy

const AUTO_GENERATE_PLANS_KEY = 'eva_plans_auto_generate_attempted';

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    console.error('API error:', path, res.status);
    await signOut();
    const text = await res.text().catch(() => '');
    throw new Error(`401: ${text}`);
  }
  if (!res.ok) {
    console.error('API error:', path, res.status);
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

// ── Health ──────────────────────────────────
export async function getHealth() {
  return apiFetch('/health');
}

// ── Onboarding ──────────────────────────────
export async function getOnboardingStatus() {
  return apiFetch('/onboarding/status');
}

// Backward-compatible name used by onboarding/main modules.
export const fetchOnboardingStatus = getOnboardingStatus;

export async function postOnboardingStep(body) {
  return apiFetch('/onboarding/step', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postOnboard(body) {
  return apiFetch('/onboard', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Profile ─────────────────────────────────
export async function getProfile() {
  return apiFetch('/profile');
}

export async function patchProfile(body) {
  return apiFetch('/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ── Plans ────────────────────────────────────
export async function getPlans() {
  return apiFetch('/plans');
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildGeneratePayloadFromProfile(profile = {}) {
  return {
    age: toNumber(profile.age, 25),
    weight: toNumber(profile.weight, 70),
    height: toNumber(profile.height, 170),
    gender: profile.gender || 'male',
    activity_level: profile.activity_level || 'moderate',
    goal: profile.goal || 'maintenance',
    diet_type: profile.diet_type || 'omnivore',
  };
}

function toMergedPlansFromGenerateResult(generated) {
  const now = new Date().toISOString();
  const dietPlan = generated?.diet?.plan;
  const workoutPlan = generated?.workout?.plan || generated?.workout;
  return {
    status: dietPlan || workoutPlan ? 'ok' : 'empty',
    source: 'generated-fallback',
    diet: dietPlan ? { plan: dietPlan, created_at: now } : null,
    workout: workoutPlan ? { plan: workoutPlan, created_at: now } : null,
  };
}

/**
 * Merged data flow:
 * 1) Try GET /plans (new flow)
 * 2) If empty/fails, auto-generate from profile at most once per browser tab session
 */
export async function getPlansMerged() {
  try {
    const plans = await getPlans();
    if (plans?.status === 'ok') return plans;
    if (plans?.status !== 'empty') return plans;
  } catch {
    // Continue to legacy-style fallback below
  }

  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(AUTO_GENERATE_PLANS_KEY)) {
    return { status: 'empty', diet: null, workout: null, source: 'skipped-second-attempt' };
  }

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(AUTO_GENERATE_PLANS_KEY, '1');
  }

  const profileResp = await getProfile();
  const profile = profileResp?.profile || profileResp || {};
  const payload = buildGeneratePayloadFromProfile(profile);
  const generated = await generateFullPlan(payload);
  return toMergedPlansFromGenerateResult(generated);
}

// ── Generate ─────────────────────────────────
export async function generateFullPlan(prefs = {}) {
  return apiFetch('/generate-full-plan', {
    method: 'POST',
    body: JSON.stringify(prefs),
  });
}

// Backward-compatible name used by existing UI calls.
export const postGenerateFullPlan = generateFullPlan;

// ── Track ─────────────────────────────────────
export async function postTrack(body) {
  return apiFetch('/track', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Feedback ──────────────────────────────────
export async function postFeedback(body) {
  return apiFetch('/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
