// ═══════════════════════════════════════════
// EVA — NAVIGATION
// Screen switching (in-page). URL stays http://localhost:3000/ — no #fragment.
// Path-based routes like /dashboard would collide with Vite API proxies (/plans, /profile, …).
// ═══════════════════════════════════════════

const SCREEN_IDS = ['dashboard', 'plans', 'generate', 'track', 'onboarding', 'profile'];
const inits = new Map();

export function registerScreen(screenId, initFn) {
  inits.set(screenId, initFn);
}

export function triggerFadeIns(selector) {
  document.querySelectorAll(`${selector} .fade-in`).forEach((el, i) => {
    el.classList.remove('is-visible');
    window.setTimeout(() => el.classList.add('is-visible'), i * 80);
  });
}

/** Keep address bar as plain origin + / (strips old #/… bookmarks). */
function syncUrlToRoot() {
  try {
    if (window.location.pathname !== '/' || window.location.hash || window.location.search) {
      window.history.replaceState(null, '', '/');
    }
  } catch (_) {
    /* ignore */
  }
}

export async function go(screenId, opts = {}) {
  const { syncUrl = true } = opts;
  if (!SCREEN_IDS.includes(screenId)) {
    console.error('Unknown screen:', screenId);
    return;
  }
  const screen = document.getElementById(`screen-${screenId}`);
  if (!screen) {
    console.error('Screen not found:', screenId);
    return;
  }
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('is-active'));
  screen.classList.add('is-active');

  document.querySelectorAll('.nav-item[data-screen]').forEach((item) => {
    const active = item.dataset.screen === screenId;
    item.classList.toggle('is-active', active);
    item.classList.toggle('active', active);
  });

  if (syncUrl) syncUrlToRoot();

  const init = inits.get(screenId);
  if (init) {
    try {
      await init();
    } catch (e) {
      console.error('Initializer failed:', screenId, e);
    }
  }
  triggerFadeIns(`#screen-${screenId}`);
}

export function initNav() {
  document.querySelectorAll('.nav-item[data-screen]').forEach((item) => {
    item.addEventListener('click', () => {
      void go(item.dataset.screen || 'dashboard');
    });
  });
}
