import { getPlansMerged, postFeedback } from '../api/client.js';
import { toast } from '../ui/toast.js';
import { go } from '../nav.js';

function $(id) {
  return document.getElementById(id);
}

/** Latest plans from last successful fetch (for Export + Feedback). */
let _lastPlansSnapshot = null;

let _plansHeaderActionsWired = false;

function wirePlansHeaderActionsOnce() {
  if (_plansHeaderActionsWired) return;
  _plansHeaderActionsWired = true;

  $('btn-export')?.addEventListener('click', () => {
    const p = _lastPlansSnapshot;
    if (!p || p.status === 'empty' || (!p.diet && !p.workout)) {
      toast('Nothing to export yet', 'error');
      return;
    }
    try {
      const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'eva-plans.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Plans exported', 'success');
    } catch (e) {
      toast(`Export failed: ${e.message || e}`, 'error');
    }
  });

  $('btn-regen-plan')?.addEventListener('click', () => {
    go('generate');
  });

  const modal = $('feedback-modal');
  const closeFeedbackModal = () => {
    if (modal) modal.style.display = 'none';
  };
  const openFeedbackModal = () => {
    if (modal) modal.style.display = 'flex';
  };

  $('btn-feedback')?.addEventListener('click', () => {
    openFeedbackModal();
  });
  $('btn-feedback-cancel')?.addEventListener('click', () => {
    closeFeedbackModal();
  });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeFeedbackModal();
  });
  $('btn-feedback-submit')?.addEventListener('click', async () => {
    const ratingRaw = Number($('feedback-rating')?.value);
    const rating = Number.isFinite(ratingRaw) ? Math.min(5, Math.max(1, Math.round(ratingRaw))) : 5;
    const text = $('feedback-text')?.value?.trim() || '';
    const p = _lastPlansSnapshot;
    const plan =
      p && p.status !== 'empty' && (p.diet || p.workout)
        ? { diet: p.diet ?? null, workout: p.workout ?? null }
        : {};
    try {
      await postFeedback({
        rating,
        feedback_text: text || null,
        plan,
      });
      closeFeedbackModal();
      const ta = $('feedback-text');
      if (ta) ta.value = '';
      toast('Thank you for your feedback', 'success');
    } catch (e) {
      toast(`Feedback failed: ${e.message || e}`, 'error');
    }
  });
}

function normalizeWorkoutDays(workout) {
  if (!workout || typeof workout !== 'object') return [];
  if (Array.isArray(workout.days)) return workout.days;
  if (Array.isArray(workout.weekly_plan)) {
    return workout.weekly_plan.map((d) => ({
      day: d?.day,
      focus: d?.focus,
      exercises: Array.isArray(d?.exercises) ? d.exercises : [],
    }));
  }
  return [];
}

function mealExtrasBlock(m) {
  const items = m.items || m.foods;
  if (!Array.isArray(items) || !items.length) return '';
  const text = items.filter((x) => typeof x === 'string').slice(0, 8).join(', ');
  return text ? `<div class="meal-row__sub">${text}</div>` : '';
}

export async function initPlans() {
  wirePlansHeaderActionsOnce();

  const tabs = $('plan-day-tabs');
  const exList = $('plan-exercise-list');
  const mealList = $('plan-meal-list');
  const note = $('plan-coach-note');
  if (!tabs || !exList || !mealList) return;

  const defaultTabNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  try {
    const plans = await getPlansMerged();
    _lastPlansSnapshot = plans;
    if (plans.status === 'empty') {
      exList.innerHTML = '<div class="empty-state">No plans yet. Generate your first plan.</div>';
      mealList.innerHTML = '<div class="empty-state">No diet plan yet.</div>';
      return;
    }

    const workoutRoot = plans.workout?.plan || plans.workout;
    const workoutDays = normalizeWorkoutDays(workoutRoot);
    const dietPlan = plans.diet?.plan || plans.diet || {};
    const dietMeals = dietPlan.meals || [];
    const dailyMeals = dietPlan.daily_meals;
    const macros = dietPlan.macros || plans.diet?.macros;

    const tabLabels =
      workoutDays.length > 0
        ? workoutDays.map((d, i) => {
            const label = d.day || d.focus || defaultTabNames[i] || `Day ${i + 1}`;
            return String(label).slice(0, 14);
          })
        : defaultTabNames;

    tabs.innerHTML = '';
    const nTabs = workoutDays.length > 0 ? workoutDays.length : 7;
    for (let i = 0; i < nTabs; i += 1) {
      const b = document.createElement('button');
      b.className = `plan-day-tab ${i === 0 ? 'active' : ''}`;
      b.textContent = tabLabels[i] || defaultTabNames[i] || `Day ${i + 1}`;
      b.dataset.day = String(i);
      b.addEventListener('click', () => {
        tabs.querySelectorAll('.plan-day-tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        renderDay(i);
      });
      tabs.appendChild(b);
    }

    const mp = $('plan-macro-p');
    const mc = $('plan-macro-c');
    const mf = $('plan-macro-f');
    const kcalBadge = $('plan-diet-kcal');
    if (macros && typeof macros === 'object') {
      if (mp) mp.textContent = macros.protein != null ? String(macros.protein) : '—';
      if (mc) mc.textContent = macros.carbs != null ? String(macros.carbs) : '—';
      if (mf) mf.textContent = macros.fats != null ? String(macros.fats) : '—';
    }
    if (kcalBadge && dietPlan.target_calories != null) {
      kcalBadge.textContent = `${dietPlan.target_calories} kcal`;
    }

    function mealsForDayIndex(i) {
      if (Array.isArray(dailyMeals) && dailyMeals[i] && Array.isArray(dailyMeals[i].meals)) {
        return dailyMeals[i].meals;
      }
      if (Array.isArray(dailyMeals) && dailyMeals[i] && Array.isArray(dailyMeals[i])) {
        return dailyMeals[i];
      }
      return dietMeals;
    }

    function renderDay(i) {
      const wd = workoutDays[i] || workoutDays[0] || {};
      const ex = Array.isArray(wd.exercises) ? wd.exercises : [];
      const header = $('plan-workout-header');
      const dayBadge = $('plan-day-badge');
      if (header) header.textContent = wd.focus || wd.day || 'Workout';
      if (dayBadge) dayBadge.textContent = wd.day || `Day ${i + 1}`;

      exList.innerHTML = ex.length
        ? ex
            .map(
              (e, idx) =>
                `<div class="exercise"><div class="exercise__num">${idx + 1}</div><div><div class="exercise__name">${e.name || 'Exercise'}</div><div class="exercise__specs"><span class="exercise__spec">${e.sets || '-'} sets</span><span class="exercise__spec">${e.reps || '-'} reps</span><span class="exercise__spec">${e.rest_seconds != null ? `${e.rest_seconds}s rest` : '—'}</span></div></div></div>`
            )
            .join('')
        : '<div class="empty-state">No workout entries for this day.</div>';

      const dayMeals = mealsForDayIndex(i);
      mealList.innerHTML = (dayMeals || [])
        .map((m, idx) => {
          const name = m.name || m.meal_name || `Meal ${idx + 1}`;
          const kcal = m.calories || m.kcal || 0;
          return `<div class="meal-row"><div class="meal-row__time">Meal ${idx + 1}</div><div class="meal-row__name">${name}${mealExtrasBlock(m)}</div><div class="meal-row__cal">${kcal} kcal</div></div>`;
        })
        .join('') || '<div class="empty-state">No meals found.</div>';
      if (note) note.textContent = 'Plan loaded. Keep consistency and recover well.';
    }

    renderDay(0);
  } catch (e) {
    _lastPlansSnapshot = null;
    tabs.innerHTML = '<button class="plan-day-tab active">Today</button>';
    exList.innerHTML =
      '<div class="exercise"><div class="exercise__num">1</div><div><div class="exercise__name">Fallback Workout</div><div class="exercise__specs"><span class="exercise__spec">4 sets</span><span class="exercise__spec">10 reps</span></div></div></div>';
    mealList.innerHTML =
      '<div class="meal-row"><div class="meal-row__time">Meal 1</div><div class="meal-row__name">Fallback Meal</div><div class="meal-row__cal">500 kcal</div></div>';
    if (note) note.textContent = 'Fallback mode active. Generate or reconnect API.';
    toast(`Plans API fallback: ${e.message || e}`);
  }
}
