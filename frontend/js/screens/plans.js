import { getPlansMerged } from '../api/client.js';
import { toast } from '../ui/toast.js';

function $(id) {
  return document.getElementById(id);
}

function normalizeWorkoutDays(workout) {
  if (!workout) return [];
  if (Array.isArray(workout.days)) return workout.days;
  return [];
}

export async function initPlans() {
  const tabs = $('plan-day-tabs');
  const exList = $('plan-exercise-list');
  const mealList = $('plan-meal-list');
  const note = $('plan-coach-note');
  if (!tabs || !exList || !mealList) return;

  try {
    const plans = await getPlansMerged();
    if (plans.status === 'empty') {
      exList.innerHTML = '<div class="empty-state">No plans yet. Generate your first plan.</div>';
      mealList.innerHTML = '<div class="empty-state">No diet plan yet.</div>';
      return;
    }

    const workoutDays = normalizeWorkoutDays(plans.workout?.plan || plans.workout);
    const dietMeals = plans.diet?.plan?.meals || plans.diet?.meals || [];
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    tabs.innerHTML = '';
    names.forEach((day, i) => {
      const b = document.createElement('button');
      b.className = `plan-day-tab ${i === 0 ? 'active' : ''}`;
      b.textContent = day;
      b.dataset.day = String(i);
      b.addEventListener('click', () => {
        tabs.querySelectorAll('.plan-day-tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        renderDay(i);
      });
      tabs.appendChild(b);
    });

    function renderDay(i) {
      const wd = workoutDays[i] || workoutDays[0] || {};
      const ex = Array.isArray(wd.exercises) ? wd.exercises : [];
      exList.innerHTML = ex.length
        ? ex
            .map(
              (e, idx) =>
                `<div class="exercise"><div class="exercise__num">${idx + 1}</div><div><div class="exercise__name">${e.name || 'Exercise'}</div><div class="exercise__specs"><span class="exercise__spec">${e.sets || '-'} sets</span><span class="exercise__spec">${e.reps || '-'} reps</span><span class="exercise__spec">${e.rest_seconds || '-'}s rest</span></div></div></div>`
            )
            .join('')
        : '<div class="empty-state">No workout entries for this day.</div>';

      mealList.innerHTML = (dietMeals || [])
        .slice(0, 5)
        .map(
          (m, idx) =>
            `<div class="meal-row"><div class="meal-row__time">Meal ${idx + 1}</div><div class="meal-row__name">${m.name || m.meal_name || 'Meal'}</div><div class="meal-row__cal">${m.calories || m.kcal || 0} kcal</div></div>`
        )
        .join('') || '<div class="empty-state">No meals found.</div>';
      if (note) note.textContent = 'Plan loaded. Keep consistency and recover well.';
    }

    renderDay(0);
  } catch (e) {
    tabs.innerHTML = '<button class="plan-day-tab active">Today</button>';
    exList.innerHTML =
      '<div class="exercise"><div class="exercise__num">1</div><div><div class="exercise__name">Fallback Workout</div><div class="exercise__specs"><span class="exercise__spec">4 sets</span><span class="exercise__spec">10 reps</span></div></div></div>';
    mealList.innerHTML =
      '<div class="meal-row"><div class="meal-row__time">Meal 1</div><div class="meal-row__name">Fallback Meal</div><div class="meal-row__cal">500 kcal</div></div>';
    if (note) note.textContent = 'Fallback mode active. Generate or reconnect API.';
    toast(`Plans API fallback: ${e.message || e}`);
  }
}
