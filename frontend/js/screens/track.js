import { getPlans, postTrack } from '../api/client.js';
import { toast } from '../ui/toast.js';

const EVA_TRACK_STORAGE_KEY = 'eva_track';

function $(id) {
  return document.getElementById(id);
}

const trackState = {
  energy: null,
  sleep: null,
};

function buildTrackPayload() {
  const notes = [];
  if (trackState.energy != null) notes.push(`energy:${trackState.energy}`);
  if (trackState.sleep != null) notes.push(`sleep:${trackState.sleep}`);
  if (notes.length === 0) notes.push('tracked_session');
  return {
    actual_meals: [],
    notes,
  };
}

/** Always persists; does not throw. */
function appendLocalTrackEntry(entry) {
  try {
    const raw = localStorage.getItem(EVA_TRACK_STORAGE_KEY);
    const history = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(history) ? history : [];
    list.push(entry);
    localStorage.setItem(EVA_TRACK_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / JSON issues */
  }
}

function wireRatings() {
  document.querySelectorAll('.rating-btn').forEach((btn) => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const rating = Number(btn.dataset.rating);
      document
        .querySelectorAll(`.rating-btn[data-group="${group}"]`)
        .forEach((x) => x.classList.remove('btn--gold'));
      btn.classList.add('btn--gold');
      if (group === 'energy') trackState.energy = rating;
      if (group === 'sleep') trackState.sleep = rating;
    });
  });
}

export async function initTrack() {
  wireRatings();
  const list = $('track-exercise-list');
  const submit = $('btn-submit-workout');
  if (!list || !submit) return;
  try {
    const plans = await getPlans();
    const exercises = plans?.workout?.plan?.days?.[0]?.exercises || plans?.workout?.days?.[0]?.exercises || [];
    list.innerHTML = exercises.length
      ? exercises
          .map(
            (e) =>
              `<div class="workout-item"><div class="workout-item__num">•</div><div><div class="workout-item__name">${e.name || 'Exercise'}</div><div class="workout-item__detail">${e.sets || '-'} sets · ${e.reps || '-'} reps</div></div></div>`
          )
          .join('')
      : '<div class="empty-state">No workout plan found. Generate first.</div>';
  } catch (e) {
    toast(`Track load failed: ${e.message || e}`);
  }

  if (submit.dataset.bound === 'true') return;
  submit.dataset.bound = 'true';
  submit.addEventListener('click', async () => {
    submit.classList.add('btn--loading');
    const payload = buildTrackPayload();
    let remote = null;
    let remoteError = null;
    try {
      remote = await postTrack(payload);
    } catch (e) {
      remoteError = e?.message || String(e);
    }

    appendLocalTrackEntry({
      savedAt: Date.now(),
      payload,
      synced: !remoteError,
      adherence: remote?.adherence,
      error: remoteError || undefined,
    });

    submit.classList.remove('btn--outline');
    submit.classList.add('btn--success');
    submit.textContent = '✓ Logged Successfully';
    if (!remoteError) {
      toast('Track saved', 'success');
    } else {
      toast(`Saved on this device. Sync failed: ${remoteError}`, 'error');
    }
    submit.classList.remove('btn--loading');
  });
}
