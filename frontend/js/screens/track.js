import { getPlans, postTrack } from '../api/client.js';
import { toast } from '../ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

const trackState = {
  energy: null,
  sleep: null,
};

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
    try {
      const payload = {
        actual_meals: [],
        notes: ['Tracked activity'],
      };
      console.log('Tracking payload:', payload);
      await postTrack(payload);
      submit.classList.remove('btn--outline');
      submit.classList.add('btn--success');
      submit.textContent = '✓ Logged Successfully';
      console.log('Track success');
      toast('Track saved', 'success');
    } catch (e) {
      console.error('Track failed:', e);
      toast(`Track submit failed: ${e.message || e}`);
    } finally {
      submit.classList.remove('btn--loading');
    }
  });
}
