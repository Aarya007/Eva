import { getOnboardingStatus, getPlansMerged, getProfile } from '../api/client.js';
import { EmptyState, InsightCard, LoadingState, StatCard } from '../components/ui.js';
import { signOut } from '../auth/session.js';
import { toast } from '../ui/toast.js';
import { getMockGreeting } from '../dashboard/mockDashboard.js';

const EVA_TRACK_KEY = 'eva_track';

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

function readEvaTrackHistory() {
  try {
    const raw = localStorage.getItem(EVA_TRACK_KEY);
    const h = raw ? JSON.parse(raw) : [];
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

function buildConsistencyInsightLine(history) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const days = new Set();
  for (const e of history) {
    if (!e || typeof e.savedAt !== 'number') continue;
    const d = new Date(e.savedAt);
    if (d >= start) days.add(d.toDateString());
  }
  const n = days.size;
  if (n === 0) return 'Log from Track to build your consistency streak.';
  if (n === 1) return 'You logged once this week — keep going.';
  return `You logged ${n} days this week — improving consistency.`;
}

/** 35 ml/kg → L, clamped. Real intake logging is a follow-up. */
function hydrationTargetLitres(weightKg) {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return null;
  const L = (w * 35) / 1000;
  return Math.min(4.5, Math.max(1.5, Math.round(L * 10) / 10));
}

function proteinTargetGrams(profile) {
  const p = profile || {};
  const g =
    p.target_protein_g ??
    p.target_protein ??
    p.protein ??
    (Number(p.weight) > 0 ? Math.round(Number(p.weight) * 1.8) : null);
  return g != null && Number.isFinite(Number(g)) ? Number(g) : null;
}

function normalizeWorkoutExercises(plans, dayIndex = 0) {
  const wp = plans?.workout?.plan;
  if (!wp || typeof wp !== 'object') return [];
  if (Array.isArray(wp.days) && wp.days[dayIndex]) {
    const ex = wp.days[dayIndex].exercises;
    return Array.isArray(ex) ? ex : [];
  }
  if (Array.isArray(wp.weekly_plan)) {
    const d = wp.weekly_plan[dayIndex] || wp.weekly_plan[0];
    return Array.isArray(d?.exercises) ? d.exercises : [];
  }
  return [];
}

function pickCurrentOrNextMeal(meals) {
  if (!Array.isArray(meals) || !meals.length) return { label: '', html: '' };
  const hour = new Date().getHours();
  const slotFromName = (name) => {
    const n = String(name || '').toLowerCase();
    if (/breakfast|morning/.test(n)) return 0;
    if (/lunch/.test(n)) return 1;
    if (/dinner|evening|supper/.test(n)) return 2;
    if (/snack/.test(n)) return 1;
    return -1;
  };
  const currentSlot = hour < 11 ? 0 : hour < 16 ? 1 : 2;
  let bestIdx = 0;
  let bestScore = 999;
  meals.forEach((m, i) => {
    const name = m.name || m.meal_name || '';
    const slot = slotFromName(name);
    const score = slot >= 0 ? Math.abs(slot - currentSlot) : Math.abs(i - (currentSlot === 0 ? 0 : currentSlot === 1 ? 1 : 2));
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  const m = meals[bestIdx];
  const name = m.name || m.meal_name || `Meal ${bestIdx + 1}`;
  const kcal = m.calories || m.kcal || 0;
  const slot = slotFromName(name);
  const label = slot >= 0 && slot === currentSlot ? 'Now' : 'Up next';
  const html = `<div class="meal-row meal-row--highlight"><div class="meal-row__time">${label}</div><div class="meal-row__name">${name}</div><div class="meal-row__cal">${kcal} kcal</div></div>`;
  return { label, html };
}

function renderWorkoutContent(workout) {
  if (!Array.isArray(workout) || !workout.length) {
    return EmptyState('No workout yet. Generate a plan first.');
  }
  return workout
    .slice(0, 8)
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
  return meals.map((m, i) => {
    const name = m.name || m.meal_name || `Meal ${i + 1}`;
    const kcal = m.calories || m.kcal || 0;
    return `<div class="meal-row"><div class="meal-row__time">Meal ${i + 1}</div><div class="meal-row__name">${name}</div><div class="meal-row__cal">${kcal} kcal</div></div>`;
  }).join('');
}

function buildWeeklyTargetKcal(plans) {
  const dp = plans?.diet?.plan || plans?.diet || {};
  const dm = dp.daily_meals;
  if (Array.isArray(dm) && dm.length >= 7) {
    return dm.slice(0, 7).map((day) => {
      const meals = day?.meals || day;
      if (!Array.isArray(meals)) return 0;
      return meals.reduce((s, m) => s + (Number(m.calories || m.kcal) || 0), 0);
    });
  }
  const meals = dp.meals;
  let daily = 0;
  if (Array.isArray(meals)) {
    daily = meals.reduce((s, m) => s + (Number(m.calories || m.kcal) || 0), 0);
  }
  if (daily <= 0 && dp.target_calories != null) {
    daily = Number(dp.target_calories);
  }
  return Array(7).fill(daily);
}

function last7CalendarDays() {
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(12, 0, 0, 0);
    out.push(d);
  }
  return out;
}

function extractAdherencePercent(entry) {
  const a = entry?.adherence;
  if (a && typeof a === 'object' && typeof a.adherence === 'number') return a.adherence;
  return null;
}

function buildWeeklyActualAdherence(history) {
  const days = last7CalendarDays();
  const series = [];
  for (const day of days) {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const entries = history.filter((e) => {
      const t = e?.savedAt;
      if (typeof t !== 'number') return false;
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });
    if (entries.length === 0) {
      series.push(0);
      continue;
    }
    let pct = null;
    for (let j = entries.length - 1; j >= 0; j -= 1) {
      const p = extractAdherencePercent(entries[j]);
      if (p != null) {
        pct = p;
        break;
      }
    }
    series.push(pct != null ? pct : 100);
  }
  return series;
}

function normalizeTargetsToChartScale(targetKcal) {
  const max = Math.max(...targetKcal, 1);
  return targetKcal.map((t) => (t / max) * 100);
}

function renderWeeklyCaloricChart(svgEl, targetPct, actualPct) {
  if (!svgEl) return;
  const W = 700;
  const pad = 16;
  const plotW = W - pad * 2;
  const plotH = 120 - pad * 2;
  const n = 7;
  const x = (i) => pad + (i / Math.max(n - 1, 1)) * plotW;
  const y = (v) => pad + plotH - (Math.min(100, Math.max(0, v)) / 100) * plotH;
  const pts = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const hasData = targetPct.some((v) => v > 0) || actualPct.some((v) => v > 0);
  if (!hasData) {
    svgEl.innerHTML = `<text x="350" y="64" text-anchor="middle" fill="var(--muted)" font-family="var(--font-mono)" font-size="11">Log on Track or generate a plan to see adherence</text>`;
    return;
  }
  svgEl.innerHTML = `
    <polyline fill="none" stroke="var(--gold)" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${pts(targetPct)}" />
    <polyline fill="none" stroke="var(--silver)" stroke-width="1.5" vector-effect="non-scaling-stroke" points="${pts(actualPct)}" />
  `;
}

export async function initDashboard() {
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
    return;
  }
  workoutHost.innerHTML = LoadingState('Loading your system...');
  mealHost.innerHTML = LoadingState('Loading your system...');

  const dd = $('dash-date');
  if (dd) {
    dd.textContent = new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  try {
    const profileResp = await getProfile().catch(async () => getOnboardingStatus());
    const profile = profileResp?.profile || profileResp || {};

    const plans = (await getPlansMerged().catch(() => null)) || {};
    const history = readEvaTrackHistory();
    const consistencyLine = buildConsistencyInsightLine(history);

    safeText('dash-name', profile.display_name || 'Athlete');
    safeText('dash-greeting', 'Good morning,');
    safeText('dash-goal', profile.goal || 'Goal not set');
    safeText('dash-streak', String(profile.streak_days || 0));
    safeText('cal-val', String(profile.last_calories || 0));
    const protG = proteinTargetGrams(profile);
    safeText('prot-val', protG != null ? String(protG) : '—');
    const protDelta = $('prot-pct');
    if (protDelta) protDelta.textContent = protG != null ? `${protG} g daily target` : 'Set plan for target';
    const protBar = $('prot-bar');
    if (protBar) protBar.style.width = protG != null ? '100%' : '0%';

    const wKg = profile.weight;
    if (wKg != null && Number.isFinite(Number(wKg))) {
      safeText('weight-val', String(wKg));
      const wd = $('weight-delta');
      if (wd) wd.textContent = 'From profile';
    } else {
      safeText('weight-val', '—');
      const wd = $('weight-delta');
      if (wd) wd.textContent = 'Set in onboarding';
    }

    const hydroTarget = hydrationTargetLitres(profile.weight);
    const hydroBar = $('hydro-bar');
    if (hydroTarget != null) {
      safeText('hydro-val', '0');
      const hp = $('hydro-pct');
      if (hp) hp.textContent = `Goal ${hydroTarget} L · 0% (log water later)`;
      if (hydroBar) hydroBar.style.width = '0%';
    } else {
      safeText('hydro-val', '—');
      const hp = $('hydro-pct');
      if (hp) hp.textContent = 'Add weight for target';
      if (hydroBar) hydroBar.style.width = '0%';
    }

    const insight = $('dash-insight');
    if (insight) {
      const pg = protG ?? '—';
      insight.innerHTML = `
        ${InsightCard(consistencyLine)}
        ${InsightCard('Focus on execution quality today. Train hard, recover harder.')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
          ${StatCard('Calories', profile.last_calories || 0, 'kcal', 75)}
          ${StatCard('Protein', pg, 'g', 80)}
        </div>
      `;
    }

    const workout = normalizeWorkoutExercises(plans, 0);
    workoutHost.innerHTML = renderWorkoutContent(workout);

    const todayMeals = plans?.diet?.plan?.meals || plans?.diet?.meals || [];
    const nextHost = $('dash-next-meal');
    const nextWrap = $('dash-next-meal-host');
    const picked = pickCurrentOrNextMeal(todayMeals);
    if (nextHost && nextWrap) {
      if (picked.html) {
        nextHost.innerHTML = picked.html;
        nextWrap.style.display = '';
      } else {
        nextHost.innerHTML = '<div class="empty-state">No meals in plan yet.</div>';
        nextWrap.style.display = '';
      }
    }

    mealHost.innerHTML = renderMealsContent(todayMeals);

    const totalKcal = todayMeals.reduce((s, m) => s + (Number(m.calories || m.kcal) || 0), 0);
    const mealTotalEl = $('dash-meal-total-cal');
    if (mealTotalEl) mealTotalEl.textContent = totalKcal > 0 ? `${totalKcal} kcal` : '— kcal';

    const targetKcal = buildWeeklyTargetKcal(plans);
    const actualAdh = buildWeeklyActualAdherence(history);
    const targetPct = normalizeTargetsToChartScale(targetKcal);
    renderWeeklyCaloricChart($('weekly-chart'), targetPct, actualAdh);
  } catch (e) {
    console.error('Dashboard crash:', e);
    const mock = getMockGreeting();
    safeText('dash-name', mock.name);
    safeText('dash-greeting', 'Good morning,');
    safeText('dash-goal', 'Maintenance');
    safeText('cal-val', '2200');
    safeText('prot-val', '140');
    const protDeltaF = $('prot-pct');
    if (protDeltaF) protDeltaF.textContent = '140 g daily target';
    const hist = readEvaTrackHistory();
    const line = buildConsistencyInsightLine(hist);
    const insight = $('dash-insight');
    if (insight) {
      insight.innerHTML = `
        ${InsightCard(line)}
        ${InsightCard('API unavailable. Showing fallback data for UI continuity.')}
      `;
    }
    workoutHost.innerHTML =
      '<div class="workout-item"><div class="workout-item__num">1</div><div><div class="workout-item__name">Upper Strength</div><div class="workout-item__detail">4 sets · 8 reps</div></div></div>';
    mealHost.innerHTML =
      '<div class="meal-row"><div class="meal-row__time">Meal 1</div><div class="meal-row__name">Oats + Eggs</div><div class="meal-row__cal">520 kcal</div></div>';
    renderWeeklyCaloricChart($('weekly-chart'), Array(7).fill(0), buildWeeklyActualAdherence(hist));
    toast(`Dashboard API fallback: ${e.message || e}`);
  }
}
