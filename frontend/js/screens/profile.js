import { getOnboardingStatus, getProfile, getPlansMerged, patchProfile } from '../api/client.js';
import { signOut } from '../auth/session.js';
import { toast } from '../ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

const SETTINGS_KEY = 'eva_settings';

/** Latest profile for edit modal (set whenever profile UI is filled). */
let _lastProfile = null;

function applyProfileToUI(profile) {
  _lastProfile = profile || {};
  const p = _lastProfile;
  if ($('profile-name')) $('profile-name').textContent = p.display_name || 'Eva User';
  const initials = (p.display_name || 'EU')
    .split(' ')
    .map((x) => x[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  if ($('profile-initials')) $('profile-initials').textContent = initials || 'EU';
  if ($('p-height')) $('p-height').textContent = p.height != null ? String(p.height) : '—';
  if ($('p-weight')) $('p-weight').textContent = p.weight != null ? String(p.weight) : '—';
  if ($('p-bodyfat')) $('p-bodyfat').textContent = p.body_fat_pct != null ? String(p.body_fat_pct) : '—';
  if ($('profile-goal-badge')) $('profile-goal-badge').textContent = p.goal || '—';
  if ($('profile-diet-badge')) $('profile-diet-badge').textContent = p.diet_type || '—';
}

function openEditModal() {
  const modal = $('profile-edit-modal');
  if (!modal) return;
  const p = _lastProfile || {};
  const dn = $('edit-display-name');
  if (dn) dn.value = p.display_name != null ? String(p.display_name) : '';
  const h = $('edit-height');
  if (h) h.value = p.height != null ? String(p.height) : '';
  const w = $('edit-weight');
  if (w) w.value = p.weight != null ? String(p.weight) : '';
  const bf = $('edit-bodyfat');
  if (bf) bf.value = p.body_fat_pct != null ? String(p.body_fat_pct) : '';
  const g = $('edit-goal');
  if (g) g.value = p.goal || 'maintenance';
  const d = $('edit-diet');
  if (d) {
    const dt = p.diet_type || 'omnivore';
    d.value = [...d.options].some((o) => o.value === dt) ? dt : 'omnivore';
  }
  modal.style.display = 'flex';
}

function closeEditModal() {
  const modal = $('profile-edit-modal');
  if (modal) modal.style.display = 'none';
}

async function saveEditModal() {
  const patch = {};
  const dn = $('edit-display-name')?.value?.trim() ?? '';
  patch.display_name = dn;

  const h = parseFloat($('edit-height')?.value);
  if (Number.isFinite(h)) patch.height = h;

  const w = parseFloat($('edit-weight')?.value);
  if (Number.isFinite(w)) patch.weight = w;

  const bf = parseFloat($('edit-bodyfat')?.value);
  if (Number.isFinite(bf)) patch.body_fat_pct = bf;

  patch.goal = $('edit-goal')?.value || 'maintenance';
  patch.diet_type = $('edit-diet')?.value || 'omnivore';

  try {
    const res = await patchProfile(patch);
    const profile = res?.profile;
    if (profile) applyProfileToUI(profile);
    closeEditModal();
    toast('Profile updated', 'success');
  } catch (e) {
    toast(`Update failed: ${e.message || e}`);
  }
}

function wireEditProfileModal() {
  const root = $('profile-edit-modal');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  $('btn-edit-profile')?.addEventListener('click', () => openEditModal());
  $('btn-profile-edit-cancel')?.addEventListener('click', () => closeEditModal());
  $('btn-profile-edit-save')?.addEventListener('click', () => void saveEditModal());
  root.addEventListener('click', (e) => {
    if (e.target === root) closeEditModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.style.display === 'flex') closeEditModal();
  });
}

export async function initProfile() {
  wireEditProfileModal();

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
    applyProfileToUI(profile);

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
    applyProfileToUI({
      display_name: 'Eva User',
      height: 170,
      weight: 70,
      body_fat_pct: null,
      goal: 'maintenance',
      diet_type: 'omnivore',
    });
    const history = $('plan-history-body');
    if (history) history.innerHTML = '<div class="empty-state">Fallback mode: no server history.</div>';
    toast(`Profile API fallback: ${e.message || e}`);
  }
}
