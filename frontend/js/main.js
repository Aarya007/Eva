import { getSupabase, isSupabaseConfigured } from './auth/supabase.js';
import {
  getSession,
  onAuthChange,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  signOut,
} from './auth/session.js';
import { getHealth, getOnboardingStatus } from './api/client.js';
import { initNav, go, registerScreen } from './nav.js';
import { runSplash } from './screens/splash.js';
import { initOnboarding } from './screens/onboarding.js';
import { initDashboard } from './screens/dashboard.js';
import { initPlans } from './screens/plans.js';
import { initGenerate } from './screens/generate.js';
import { initTrack } from './screens/track.js';
import { initProfile } from './screens/profile.js';
import { toast } from './ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

function showAuth(show) {
  const auth = $('auth-screen');
  const app = $('app-shell');
  if (auth) auth.style.display = show ? 'block' : 'none';
  if (app) app.style.display = show ? 'none' : 'block';
}

let _screensRegistered = false;
let _navBound = false;
let _bootRunId = 0;

function isOnboardingDone(status) {
  if (!status || typeof status !== 'object') return false;
  if (status.onboarding_complete === true) return true;
  if (status.onboarding_complete === false) return false;
  if (status.completed === true) return true;
  if (status.completed === false) return false;
  const pctRaw =
    status.completion_percent ??
    status.completion_pct ??
    status.completion ??
    status.progress;
  const pct = Number(pctRaw);
  return Number.isFinite(pct) ? pct >= 100 : false;
}

function wireAuthUI() {
  const err = $('auth-error');
  const showErr = (m) => {
    if (!err) return;
    err.style.display = 'block';
    err.textContent = m;
  };
  $('btn-signin')?.addEventListener('click', async () => {
    const email = $('auth-email')?.value?.trim();
    const password = $('auth-password')?.value || '';
    const { error } = await signInWithPassword(email, password);
    if (error) showErr(error.message || String(error));
  });
  $('btn-signup-toggle')?.addEventListener('click', async () => {
    const email = $('auth-email')?.value?.trim();
    const password = $('auth-password')?.value || '';
    const { error } = await signUpWithPassword(email, password);
    if (error) showErr(error.message || String(error));
    else showErr('Account created. Check your email if confirmation is enabled.');
  });
  $('btn-google')?.addEventListener('click', async () => {
    const { error } = await signInWithGoogle();
    if (error) showErr(error.message || String(error));
  });
  $('btn-signout')?.addEventListener('click', () => signOut());
  $('btn-signout-dashboard')?.addEventListener('click', () => signOut());
}

async function applyHealthBanner() {
  try {
    const h = await getHealth();
    const b = $('persist-banner');
    if (b) b.style.display = h?.persistence_enabled ? 'none' : 'block';
  } catch (e) {
    toast(`Health check failed: ${e.message || e}`);
  }
}

async function bootAuthed() {
  const runId = ++_bootRunId;
  showAuth(false);
  if (!_screensRegistered) {
    registerScreen('onboarding', initOnboarding);
    registerScreen('dashboard', initDashboard);
    registerScreen('plans', initPlans);
    registerScreen('generate', initGenerate);
    registerScreen('track', initTrack);
    registerScreen('profile', initProfile);
    _screensRegistered = true;
  }
  if (!_navBound) {
    initNav();
    _navBound = true;
    window.debugGoDashboard = () => go('dashboard');
  }
  // Keep a visible default while status resolves, without forcing dashboard first.
  await go('onboarding');
  await applyHealthBanner();
  let status = null;
  try {
    status = await getOnboardingStatus();
    console.log('Onboarding status:', status);
  } catch (e) {
    toast(`Onboarding status failed: ${e.message || e}`);
  }
  // Ignore stale runs triggered by overlapping auth events.
  if (runId !== _bootRunId) return;
  const done = isOnboardingDone(status);
  console.log('Onboarding complete:', done);
  console.log(`Routing -> ${done ? 'dashboard' : 'onboarding'}`);
  await go(done ? 'dashboard' : 'onboarding');
}

async function initApp() {
  wireAuthUI();
  if (!isSupabaseConfigured()) {
    showAuth(true);
    toast('Supabase env missing in frontend/.env.local');
    return;
  }
  const sessionData = await getSession();
  if (!sessionData?.session) {
    showAuth(true);
  } else {
    await bootAuthed();
  }
  onAuthChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      showAuth(true);
      return;
    }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session) {
      await bootAuthed();
    }
  });
  const sb = getSupabase();
  if (!sb) return;
}

document.addEventListener('DOMContentLoaded', async () => {
  await runSplash();
  void initApp();
});
