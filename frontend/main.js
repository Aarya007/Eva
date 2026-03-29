import "./css/layout.css";
import "./css/components.css";

import { mountWizard } from "./js/onboarding/wizard.js";
import { fetchOnboardingStatus, postGenerateDiet, postFeedback } from "./js/api/client.js";
import { parseCommaList } from "./js/onboarding/mapPayload.js";
import { renderPlanOutput, renderInsightsOutput } from "./js/dashboard/planView.js";
import { pageLoading, inlineError, emptyState } from "./js/ui/page-states.js";
import { getMockGreeting, getMockMetrics } from "./js/dashboard/mockDashboard.js";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DASHBOARD === "true";

let lastPlan = null;
/** Profile from GET /onboarding/status — used for generate-diet (no duplicate form fields). */
let lastProfile = null;

function $(id) {
  return document.getElementById(id);
}

function showTab(name) {
  const onb = name === "onboarding";
  $("view-onboarding").hidden = !onb;
  $("view-dashboard").hidden = onb;
  $("tab-onboarding").setAttribute("aria-selected", onb ? "true" : "false");
  $("tab-dashboard").setAttribute("aria-selected", !onb ? "true" : "false");
}

function setOnboardingTabsUnlocked(unlocked) {
  $("tab-dashboard").hidden = !unlocked;
}

function formatProfileSummary(p) {
  if (!p || typeof p !== "object") return "No profile loaded yet.";
  const parts = [];
  if (p.age != null) parts.push(`Age ${p.age}`);
  if (p.weight != null) parts.push(`${p.weight} kg`);
  if (p.height != null) parts.push(`${p.height} cm`);
  if (p.gender) parts.push(String(p.gender));
  if (p.activity_level) parts.push(`activity: ${p.activity_level}`);
  if (p.goal) parts.push(`goal: ${p.goal}`);
  if (p.diet_type) parts.push(`diet: ${p.diet_type}`);
  return parts.length ? parts.join(" · ") : "Profile incomplete.";
}

/**
 * Build UserInput for POST /generate-diet from saved profile + optional meal overrides.
 * Demographics come from onboarding-backed memory, not duplicate dashboard fields.
 */
function buildDashboardPayload(includeActualMeals) {
  const p = lastProfile || {};
  const age = p.age != null ? parseInt(String(p.age), 10) : NaN;
  const weight = p.weight != null ? parseFloat(String(p.weight)) : NaN;
  const height = p.height != null ? parseFloat(String(p.height)) : NaN;
  if (!Number.isFinite(age) || !Number.isFinite(weight) || !Number.isFinite(height)) {
    throw new Error(
      "Profile is missing age, weight, or height. Finish onboarding first."
    );
  }
  const gender = (p.gender && String(p.gender).trim()) || "male";
  const activity_level = (p.activity_level && String(p.activity_level).trim()) || "moderate";
  const goal = (p.goal && String(p.goal).trim()) || "maintenance";
  const diet_type = (p.diet_type && String(p.diet_type).trim()) || "non_veg";

  const payload = {
    age,
    weight,
    height,
    gender,
    activity_level,
    goal,
    diet_type,
  };
  const skipped = parseCommaList($("d-skipped")?.value);
  if (skipped) payload.skipped_meals = skipped;
  if (includeActualMeals) {
    const am = parseCommaList($("d-actual")?.value);
    if (am) payload.actual_meals = am;
  }
  return payload;
}

function applyProfileToDashboard(profile) {
  lastProfile = profile && typeof profile === "object" ? { ...profile } : null;
  const p = lastProfile;
  const name = (p && (p.display_name || "").trim()) || "";
  const g = $("dash-greeting");
  if (g) g.textContent = name ? `Hello, ${name}` : "Hello";

  const sum = $("dash-profile-lines");
  if (sum) sum.textContent = formatProfileSummary(p);
}

async function loadProfile() {
  const host = $("dashboard-profile-status");
  host.replaceChildren();
  host.appendChild(pageLoading("Loading profile…"));
  try {
    const st = await fetchOnboardingStatus();
    applyProfileToDashboard(st.profile || {});
    const unlocked =
      st.onboarding_complete === true || (st.completion_percent != null && st.completion_percent >= 90);
    setOnboardingTabsUnlocked(unlocked);
    if (unlocked) showTab("dashboard");
    else showTab("onboarding");

    host.replaceChildren();
    if (USE_MOCK) {
      const m = getMockGreeting();
      const g = $("dash-greeting");
      g.replaceChildren();
      g.appendChild(document.createTextNode(`Hello, ${m.name} `));
      const badge = document.createElement("span");
      badge.className = "field__hint";
      badge.textContent = `(${m.label})`;
      g.appendChild(badge);
      const metrics = $("dash-metrics");
      metrics.replaceChildren();
      getMockMetrics().forEach((x) => {
        const d = document.createElement("div");
        d.className = "metric-card";
        d.innerHTML = `<p class="metric-card__label">${x.title}</p><p class="metric-card__value">${x.value}</p><p class="field__hint">${x.hint}</p>`;
        metrics.appendChild(d);
      });
    }
  } catch (e) {
    host.replaceChildren();
    host.appendChild(inlineError(e.message || String(e)));
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn--secondary";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => loadProfile());
    host.appendChild(retry);
  }
}

async function runGenerate(simulate) {
  const banner = $("dash-banner");
  banner.replaceChildren();
  $("btn-gen").disabled = true;
  $("btn-sim").disabled = true;
  try {
    const payload = buildDashboardPayload(simulate);
    const { res, data } = await postGenerateDiet(payload);
    lastPlan = null;
    if (!res.ok) {
      banner.appendChild(
        inlineError(data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`)
      );
      renderPlanOutput($("dash-plan"), { error: true });
      renderInsightsOutput($("dash-insights"), { error: true });
      return;
    }
    if (data.error) {
      banner.appendChild(inlineError(data.error + (data.details ? ` — ${data.details}` : "")));
      return;
    }
    lastPlan = data.plan || null;
    await loadProfile();
    renderPlanOutput($("dash-plan"), data);
    renderInsightsOutput($("dash-insights"), data);
  } catch (e) {
    banner.appendChild(inlineError(e.message || String(e)));
  } finally {
    $("btn-gen").disabled = false;
    $("btn-sim").disabled = false;
  }
}

function init() {
  const app = $("app");
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-topbar">
        <div class="app-brand">Eva</div>
        <nav class="app-tabs" role="tablist" aria-label="Main">
          <button type="button" class="tab-btn" id="tab-onboarding" role="tab" aria-selected="true">Onboarding</button>
          <button type="button" class="tab-btn" id="tab-dashboard" role="tab" aria-selected="false" hidden>Dashboard</button>
        </nav>
      </header>
      <div id="view-onboarding" class="app-main-wrap app-view">
        <div id="onboarding-root" class="app-region"></div>
      </div>
      <div id="view-dashboard" class="app-main-wrap dashboard-layout app-view" hidden>
        <aside class="app-region left-col card dash-sidebar">
          <div id="dashboard-profile-status"></div>
          <h2 class="heading-section">Saved profile</h2>
          <p id="dash-profile-lines" class="field__hint" style="margin-bottom:var(--space-4)"></p>
          <h2 class="heading-section">Plan controls</h2>
          <p class="field__hint" style="margin-bottom:var(--space-3)">Skipped / completed meals apply to this run only. Demographics use values from onboarding.</p>
          <div class="field">
            <label class="field__label" for="d-skipped">Skipped meals</label>
            <input class="input" id="d-skipped" type="text" placeholder="comma-separated" />
          </div>
          <div class="field">
            <label class="field__label" for="d-actual">Completed meals (simulate)</label>
            <input class="input" id="d-actual" type="text" placeholder="Breakfast, Lunch" />
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn--primary" id="btn-gen">Generate plan</button>
            <button type="button" class="btn btn--secondary" id="btn-sim">Simulate adherence</button>
          </div>
          <h2 class="heading-section">Feedback</h2>
          <div class="field">
            <label class="field__label" for="d-rating">Rating</label>
            <select class="select" id="d-rating">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="d-fb">Notes</label>
            <textarea class="textarea" id="d-fb"></textarea>
          </div>
          <button type="button" class="btn btn--secondary" id="btn-fb" style="width:100%">Send feedback</button>
        </aside>
        <main class="app-region center-col card dash-main">
          <p id="dash-greeting" class="heading-page" style="margin-bottom:var(--space-3)">Hello</p>
          <div id="dash-metrics" class="btn-row" style="margin-bottom:var(--space-4)"></div>
          <h2 class="heading-section">Plan</h2>
          <div id="dash-banner"></div>
          <div id="dash-plan"></div>
        </main>
        <aside class="app-region insights-col card dash-insights">
          <h2 class="heading-section">Insights</h2>
          <div id="dash-insights"></div>
        </aside>
      </div>
    </div>
  `;

  $("dash-plan").appendChild(emptyState("Generate a plan to see meals here."));
  $("dash-insights").appendChild(
    emptyState("Insights appear when the API returns adherence or recommendations.")
  );

  const root = $("onboarding-root");
  mountWizard(root, {
    onComplete: () => {
      $("tab-dashboard").hidden = false;
      showTab("dashboard");
      loadProfile();
    },
  });

  $("tab-onboarding").addEventListener("click", () => showTab("onboarding"));
  $("tab-dashboard").addEventListener("click", () => {
    if (!$("tab-dashboard").hidden) showTab("dashboard");
  });

  $("btn-gen").addEventListener("click", () => runGenerate(false));
  $("btn-sim").addEventListener("click", () => runGenerate(true));
  $("btn-fb").addEventListener("click", async () => {
    if (!lastPlan) {
      $("dash-banner").replaceChildren();
      $("dash-banner").appendChild(inlineError("Generate a plan first."));
      return;
    }
    $("btn-fb").disabled = true;
    try {
      await postFeedback({
        rating: parseInt($("d-rating").value, 10),
        feedback_text: $("d-fb").value || null,
        plan: lastPlan,
      });
      $("dash-banner").replaceChildren();
      const ok = document.createElement("p");
      ok.className = "field__hint";
      ok.textContent = "Feedback saved.";
      $("dash-banner").appendChild(ok);
    } catch (e) {
      $("dash-banner").replaceChildren();
      $("dash-banner").appendChild(inlineError(e.message));
    } finally {
      $("btn-fb").disabled = false;
    }
  });

  loadProfile();
}

init();
