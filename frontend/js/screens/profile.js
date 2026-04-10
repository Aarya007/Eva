import { getOnboardingStatus, getProfile, getPlansMerged } from '../api/client.js';
import { signOut } from '../auth/session.js';
import { toast } from '../ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

const SETTINGS_KEY = 'eva_settings';

export async function initProfile() {
  const signOutBtn = $('btn-signout');
  if (signOutBtn && !signOutBtn.dataset.bound) {
    signOutBtn.addEventListener('click', () => signOut());
    signOutBtn.dataset.bound = '1';
  }
  const saveBtn = $('btn-save-settings');
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.addEventListener('click', () => {
      const payload = {
        units: $('set-units')?.value || 'metric',
        notif: $('set-notif')?.value || 'enabled',
        tone: $('set-tone')?.value || 'authoritative',
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
      toast('Settings saved', 'success');
    });
    saveBtn.dataset.bound = '1';
  }
  const resetBtn = $('btn-reset-settings');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(SETTINGS_KEY);
      toast('Settings reset', 'success');
    });
    resetBtn.dataset.bound = '1';
  }

  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if ($('set-units')) $('set-units').value = data.units || 'metric';
      if ($('set-notif')) $('set-notif').value = data.notif || 'enabled';
      if ($('set-tone')) $('set-tone').value = data.tone || 'authoritative';
    } catch {}
  }

  try {
    const [profileResp, plansResp] = await Promise.all([
      getProfile().catch(async () => getOnboardingStatus()),
      getPlansMerged(),
    ]);
    const profile = profileResp?.profile || profileResp || {};
    $('profile-name').textContent = profile.display_name || 'Eva User';
    const initials = (profile.display_name || 'EU')
      .split(' ')
      .map((x) => x[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
    $('profile-initials').textContent = initials || 'EU';
    $('p-height').textContent = profile.height != null ? String(profile.height) : '—';
    $('p-weight').textContent = profile.weight != null ? String(profile.weight) : '—';
    $('p-bodyfat').textContent = profile.body_fat_pct != null ? String(profile.body_fat_pct) : '—';
    $('profile-goal-badge').textContent = profile.goal || '—';
    $('profile-diet-badge').textContent = profile.diet_type || '—';

    const history = $('plan-history-body');
    if (history) {
      const rows = [];
      if (plansResp?.diet?.created_at) rows.push({ type: 'Diet', at: plansResp.diet.created_at });
      if (plansResp?.workout?.created_at) rows.push({ type: 'Workout', at: plansResp.workout.created_at });
      history.innerHTML = rows.length
        ? rows
            .map(
              (r, i) =>
                `<div class="workout-item"><div class="workout-item__num">#${i + 1}</div><div><div class="workout-item__name">${r.type} Plan</div><div class="workout-item__detail">${new Date(r.at).toLocaleString()}</div></div></div>`
            )
            .join('')
        : '<div class="empty-state">No plan history yet</div>';
    }
  } catch (e) {
    $('profile-name').textContent = 'Eva User';
    $('profile-initials').textContent = 'EU';
    $('p-height').textContent = '170';
    $('p-weight').textContent = '70';
    $('p-bodyfat').textContent = '—';
    $('profile-goal-badge').textContent = 'maintenance';
    $('profile-diet-badge').textContent = 'omnivore';
    const history = $('plan-history-body');
    if (history) history.innerHTML = '<div class="empty-state">Fallback mode: no server history.</div>';
    toast(`Profile API fallback: ${e.message || e}`);
  }
}
