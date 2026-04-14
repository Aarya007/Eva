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

/** @type {'login' | 'signup'} */
let _authMode = 'login';

function setAuthMode(mode) {
  _authMode = mode;
  const title = $('auth-title');
  const sub = $('auth-sub');
  const btnSign = $('btn-signin');
  const btnToggle = $('btn-signup-toggle');
  const err = $('auth-error');
  if (mode === 'signup') {
    if (title) title.textContent = 'Create account';
    if (sub) sub.textContent = 'Sign up with email or Google to use Eva.';
    if (btnSign) btnSign.textContent = 'Sign up →';
    if (btnToggle) btnToggle.textContent = 'Back to sign in';
  } else {
    if (title) title.textContent = 'Welcome Back';
    if (sub) sub.textContent = 'Sign in to continue';
    if (btnSign) btnSign.textContent = 'Sign In →';
    if (btnToggle) btnToggle.textContent = 'Create Account';
  }
  if (err) {
    err.style.display = 'none';
    err.textContent = '';
  }
}

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
    if (_authMode === 'signup') {
      const { error } = await signUpWithPassword(email, password);
      if (error) showErr(error.message || String(error));
      else {
        const errEl = $('auth-error');
        if (errEl) errEl.style.display = 'none';
        toast('Account created. Check your email if confirmation is enabled.', 'success');
      }
    } else {
      const { error } = await signInWithPassword(email, password);
      if (error) showErr(error.message || String(error));
    }
  });
  $('btn-signup-toggle')?.addEventListener('click', () => {
    setAuthMode(_authMode === 'login' ? 'signup' : 'login');
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
  const target = done ? 'dashboard' : 'onboarding';
  console.log('Onboarding complete:', done);
  console.log(`Routing -> ${target}`);
  await go(target);
}

async function initApp() {
  wireAuthUI();
  if (!isSupabaseConfigured()) {
    showAuth(true);
    setAuthMode('login');
    toast('Supabase env missing in frontend/.env.local');
    return;
  }
  const sessionData = await getSession();
  if (!sessionData?.session) {
    showAuth(true);
    setAuthMode('login');
  } else {
    await bootAuthed();
  }
  onAuthChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      showAuth(true);
      setAuthMode('login');
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
