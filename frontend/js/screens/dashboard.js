import { generateFullPlan, getOnboardingStatus, getPlans, getProfile } from '../api/client.js';
import { EmptyState, InsightCard, LoadingState, StatCard } from '../components/ui.js';
import { signOut } from '../auth/session.js';
import { toast } from '../ui/toast.js';
import { getMockGreeting } from '../dashboard/mockDashboard.js';

function $(id) {
  return document.getElementById(id);
}

function safeText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function fillSkeleton(id) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = '<div class="skeleton" style="height:12px;width:70%"></div>';
}

function renderWorkoutContent(workout) {
  if (!Array.isArray(workout) || !workout.length) {
    return EmptyState('No workout yet. Generate a plan first.');
  }
  return workout
    .slice(0, 5)
    .map(
      (w, i) =>
        `<div class="workout-item"><div class="workout-item__num">${i + 1}</div><div><div class="workout-item__name">${w.name || 'Exercise'}</div><div class="workout-item__detail">${w.sets || '-'} sets · ${w.reps || '-'} reps</div></div></div>`
    )
    .join('');
}

function renderMealsContent(meals) {
  if (!Array.isArray(meals) || !meals.length) {
    return EmptyState('No meals yet. Generate a plan first.');
  }
  return meals
    .slice(0, 5)
    .map((m, i) => {
      const name = m.name || m.meal_name || `Meal ${i + 1}`;
      const kcal = m.calories || m.kcal || 0;
      return `<div class="meal-row"><div class="meal-row__time">Meal ${i + 1}</div><div class="meal-row__name">${name}</div><div class="meal-row__cal">${kcal} kcal</div></div>`;
    })
    .join('');
}

function toGeneratePayload(profile) {
  const p = profile || {};
  return {
    age: Number(p.age) || 25,
    weight: Number(p.weight) || 70,
    height: Number(p.height) || 170,
    gender: p.gender || 'male',
    activity_level: p.activity_level || 'moderate',
    goal: p.goal || 'maintenance',
    diet_type: p.diet_type || 'omnivore',
  };
}

function hasPlans(plans) {
  return Boolean(plans?.diet?.plan || plans?.diet || plans?.workout?.plan || plans?.workout);
}

export async function initDashboard() {
  console.log('Dashboard initializer triggered');
  const signOutBtn = $('btn-signout-dashboard');
  if (signOutBtn && !signOutBtn.dataset.bound) {
    signOutBtn.addEventListener('click', () => signOut());
    signOutBtn.dataset.bound = '1';
  }

  fillSkeleton('dash-name');
  fillSkeleton('dash-goal');
  const workoutHost = $('dash-workout-list');
  const mealHost = $('dash-meal-list');
  if (!workoutHost || !mealHost) {
    console.error('Dashboard render hosts missing', {
      workout: Boolean(workoutHost),
      meals: Boolean(mealHost),
    });
    return;
  }
  workoutHost.innerHTML = LoadingState('Loading your system...');
  mealHost.innerHTML = LoadingState('Loading your system...');
  const hide = (id) => {
    const el = $(id);
    if (el && el.parentElement) el.parentElement.style.display = 'none';
  };
  // Today System focus: keep calories/protein + workout/meals + single insight
  hide('hydro-val');
  hide('weight-val');
  const chart = $('weekly-chart');
  if (chart) {
    const panel = chart.closest('.panel');
    if (panel) panel.style.display = 'none';
  }
  try {
    const profileResp = await getProfile().catch(async () => getOnboardingStatus());
    const profile = profileResp?.profile || profileResp || {};
    console.log('Profile:', profile);

    let plans = await getPlans().catch(() => null);
    console.log('Plans:', plans);
    if (!hasPlans(plans)) {
      console.warn('No plans found -> generating...');
      const genPayload = toGeneratePayload(profile);
      await generateFullPlan(genPayload);
      plans = await getPlans();
      console.log('Plans after generate:', plans);
    }
    plans = plans || {};

    safeText('dash-name', profile.display_name || 'Athlete');
    safeText('dash-greeting', 'Good morning,');
    safeText('dash-goal', profile.goal || 'Goal not set');
    safeText('dash-streak', String(profile.streak_days || 0));
    safeText('cal-val', String(profile.last_calories || 0));
    safeText('prot-val', String(profile.protein || profile.target_protein || 0));
    const insight = $('dash-insight');
    if (insight) {
      insight.innerHTML = `
        ${InsightCard('Focus on execution quality today. Train hard, recover harder.')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
          ${StatCard('Calories', profile.last_calories || 0, 'kcal', 75)}
          ${StatCard('Protein', profile.protein || profile.target_protein || 0, 'g', 80)}
        </div>
      `;
    }

    const workout =
      plans?.workout?.plan?.days?.[0]?.exercises ||
      plans?.workout?.days?.[0]?.exercises ||
      [];
    workoutHost.innerHTML = renderWorkoutContent(workout);

    const todayMeals = plans?.diet?.plan?.meals || plans?.diet?.meals || [];
    mealHost.innerHTML = renderMealsContent(todayMeals);
  } catch (e) {
    console.error('Dashboard crash:', e);
    const mock = getMockGreeting();
    safeText('dash-name', mock.name);
    safeText('dash-greeting', 'Good morning,');
    safeText('dash-goal', 'Maintenance');
    safeText('cal-val', '2200');
    safeText('prot-val', '140');
    const insight = $('dash-insight');
    if (insight) insight.innerHTML = InsightCard('API unavailable. Showing fallback data for UI continuity.');
    workoutHost.innerHTML =
      '<div class="workout-item"><div class="workout-item__num">1</div><div><div class="workout-item__name">Upper Strength</div><div class="workout-item__detail">4 sets · 8 reps</div></div></div>';
    mealHost.innerHTML =
      '<div class="meal-row"><div class="meal-row__time">Meal 1</div><div class="meal-row__name">Oats + Eggs</div><div class="meal-row__cal">520 kcal</div></div>';
    toast(`Dashboard API fallback: ${e.message || e}`);
  }
}
