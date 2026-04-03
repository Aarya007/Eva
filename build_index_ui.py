"""Regenerate frontend/index.html from frontend/index.html.bak.

NOTE: The canonical UI is frontend/index.html. This script was used for the initial
onboarding/dashboard layout. Running it overwrites index.html and will drop any
hand-maintained features (e.g. curated profile summary, /onboarding/status bootstrap,
Edit profile). Prefer editing frontend/index.html directly, or merge bak with the
current file and update the strings in this script before regenerating.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
BAK = ROOT / "frontend" / "index.html.bak"
OUT = ROOT / "frontend" / "index.html"

CSS_EXTRA = """
    .top-nav {
      display: flex;
      align-items: center;
      padding: 0.75rem 1.25rem;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
    }
    .tabs { display: flex; gap: 0.25rem; }
    .tab {
      padding: 0.5rem 1rem;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      min-width: auto;
      flex: 0 0 auto;
    }
    .tab:hover { color: var(--text); }
    .tab.active {
      color: var(--text);
      background: var(--bg);
      border-color: var(--border);
    }
    .view { display: block; }
    .view.hidden { display: none !important; }
    .hidden { display: none !important; }
    .wizard-wrap {
      max-width: 560px;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 2rem;
    }
    .wizard-meta {
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 1rem;
    }
    .wizard-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1.25rem;
    }
    .wizard-nav button { flex: 1; min-width: 100px; }
    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(280px, 360px) 1fr minmax(260px, 300px);
      min-height: calc(100vh - 52px);
      gap: 0;
    }
    @media (max-width: 1100px) {
      .dashboard-grid { grid-template-columns: 1fr; }
      .insights-col { border-left: none !important; border-top: 1px solid var(--border); }
    }
    .left-col {
      border-right: 1px solid var(--border);
      padding: 1.25rem 1.5rem;
      background: var(--panel);
      overflow-y: auto;
    }
    .center-col {
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      min-width: 0;
    }
    .insights-col {
      border-left: 1px solid var(--border);
      padding: 1.25rem 1.25rem;
      background: #151c28;
      overflow-y: auto;
    }
    .insights-empty {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .insight-list {
      margin: 0;
      padding-left: 1.2rem;
      font-size: 0.9rem;
      color: var(--text);
    }
    pre.raw { max-height: 320px; }
"""

WIZARD = """
      <h1>Profile onboarding</h1>
      <p class="hint" style="margin-bottom:1rem;">Complete all steps, then submit. Data is stored for the diet agents.</p>
      <div class="wizard-meta" id="wizard-step-label">Step 1 of 3 — Profile</div>

      <div id="wizard-step-1">
        <div class="field">
          <label for="ob-age">Age</label>
          <input type="number" id="ob-age" min="1" max="120" value="28" />
        </div>
        <div class="field">
          <label for="ob-weight">Weight (kg)</label>
          <input type="number" id="ob-weight" step="0.1" value="70" />
        </div>
        <div class="field">
          <label for="ob-height">Height (cm)</label>
          <input type="number" id="ob-height" value="175" />
        </div>
        <div class="field">
          <label for="ob-gender">Gender</label>
          <select id="ob-gender">
            <option value="male">male</option>
            <option value="female">female</option>
          </select>
        </div>
        <div class="field">
          <label for="ob-activity_level">Activity level</label>
          <select id="ob-activity_level">
            <option value="sedentary">sedentary</option>
            <option value="moderate" selected>moderate</option>
            <option value="active">active</option>
          </select>
        </div>
        <div class="field">
          <label for="ob-goal">Goal</label>
          <select id="ob-goal">
            <option value="fat_loss">fat_loss</option>
            <option value="maintenance" selected>maintenance</option>
            <option value="muscle_gain">muscle_gain</option>
          </select>
        </div>
      </div>

      <div id="wizard-step-2" class="hidden">
        <div class="field">
          <label for="ob-diet_type">Diet type</label>
          <select id="ob-diet_type">
            <option value="veg">veg</option>
            <option value="non_veg" selected>non_veg</option>
            <option value="vegan">vegan</option>
          </select>
        </div>
        <div class="field">
          <label for="ob-allergies">Allergies (comma-separated)</label>
          <input type="text" id="ob-allergies" placeholder="peanuts, shellfish" />
        </div>
        <div class="field">
          <label for="ob-preferred_foods">Preferred foods</label>
          <input type="text" id="ob-preferred_foods" placeholder="dal, rice, yogurt" />
        </div>
        <div class="field">
          <label for="ob-disliked_foods">Disliked foods</label>
          <input type="text" id="ob-disliked_foods" placeholder="okra, bitter gourd" />
        </div>
      </div>

      <div id="wizard-step-3" class="hidden">
        <div class="field">
          <label for="ob-fitness_type">Fitness type</label>
          <select id="ob-fitness_type">
            <option value="gym">gym</option>
            <option value="home">home</option>
            <option value="sport">sport</option>
            <option value="mixed" selected>mixed</option>
          </select>
        </div>
        <div class="field">
          <label for="ob-gym_level">Gym level</label>
          <select id="ob-gym_level">
            <option value="beginner" selected>beginner</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </div>
        <div class="field">
          <label for="ob-sport_type">Sport type</label>
          <input type="text" id="ob-sport_type" placeholder="e.g. running, cricket" />
        </div>
        <div class="field">
          <label for="ob-training_intensity">Training intensity</label>
          <select id="ob-training_intensity">
            <option value="low">low</option>
            <option value="moderate" selected>moderate</option>
            <option value="high">high</option>
          </select>
        </div>
      </div>

      <div class="wizard-nav">
        <button type="button" id="btn-ob-back" class="secondary">Back</button>
        <button type="button" id="btn-ob-next">Next</button>
        <button type="button" id="btn-ob-submit" class="hidden">Submit</button>
      </div>
      <p class="hint" id="onboard-hint"></p>
"""

INSIGHTS = """
      <aside class="insights-col" id="insights-panel">
        <h2>Insights</h2>
        <div id="output-insights" class="insights-empty">Score and adherence appear after you generate a plan. Simulate adds adherence and recommendations.</div>
      </aside>
"""

def main():
    s = BAK.read_text(encoding="utf-8")
    s = s.replace("    code { font-size: 0.85em; }", "    code { font-size: 0.85em; }" + CSS_EXTRA, 1)

    head = """<body>
  <header class="top-nav">
    <nav class="tabs" role="tablist" aria-label="Main">
      <button type="button" class="tab active" id="tab-onboarding" role="tab" aria-selected="true">Onboarding</button>
      <button type="button" class="tab" id="tab-dashboard" role="tab" aria-selected="false">Dashboard</button>
    </nav>
  </header>

  <section id="view-onboarding" class="view">
    <div class="wizard-wrap">
""" + WIZARD + """
    </div>
  </section>

  <section id="view-dashboard" class="view hidden">
    <div class="dashboard-grid">
      <aside class="left-col">"""

    s = s.replace("<body>\n  <div class=\"wrap\">\n    <aside class=\"left\">", head, 1)

    s = s.replace(
        "<p class=\"hint\" style=\"margin-bottom:1rem;\">Vite dev proxies <code>/generate-diet</code> and <code>/feedback</code> to <code>http://127.0.0.1:8000</code>. Ensure the API is running.</p>",
        "<p class=\"hint\" style=\"margin-bottom:1rem;\">Vite dev proxies <code>/generate-full-plan</code>, <code>/generate-diet</code>, <code>/feedback</code>, <code>/onboard</code> to <code>http://127.0.0.1:8000</code>. Ensure the API is running.</p>",
        1,
    )

    block = """      <div class="field">
        <label for="skipped_meals">Skipped meals (optional, comma-separated)</label>
        <input type="text" id="skipped_meals" placeholder="breakfast, dinner" />
        <div class="hint">Examples: breakfast, lunch, dinner</div>
      </div>

      <div class="btn-row">
        <button type="button" id="btn-generate">Generate Plan</button>
      </div>"""

    new_block = """      <div class="field">
        <label for="skipped_meals">Skipped meals (optional, comma-separated)</label>
        <input type="text" id="skipped_meals" placeholder="breakfast, dinner" />
        <div class="hint">Examples: breakfast, lunch, dinner</div>
      </div>

      <div class="field">
        <label for="actual_meals">Completed meals for adherence (comma-separated)</label>
        <input type="text" id="actual_meals" placeholder="Breakfast, Lunch" />
        <div class="hint">Use meal names that match the generated plan (e.g. Breakfast). Used by Simulate.</div>
      </div>

      <div class="btn-row">
        <button type="button" id="btn-generate">Generate Plan</button>
        <button type="button" id="btn-simulate" class="secondary">Simulate Adherence</button>
      </div>"""

    s = s.replace(block, new_block, 1)

    s = s.replace('<main class="right">', '<main class="center-col">', 1)
    s = s.replace('id="output"', 'id="output-center"', 1)

    tail = """    </main>
""" + INSIGHTS + """    </div>
  </section>

  <script>"""

    s = s.replace("""    </main>
  </div>

  <script>""", tail, 1)

    m = re.search(r"<script>(.*)</script>", s, re.DOTALL)
    if not m:
        raise SystemExit("script block not found")
    old_js = m.group(1)
    new_js = build_js()
    s = s.replace("<script>" + old_js + "</script>", "<script>" + new_js + "</script>", 1)

    OUT.write_text(s, encoding="utf-8")
    print("Wrote", OUT)


def build_js():
    return """
    const API = "";
    let lastPlan = null;
    let lastResponse = null;

    const onboardingData = {};

    let onboardStep = 1;
    const $ = (id) => document.getElementById(id);

    function parseCommaList(raw) {
      if (!raw || !String(raw).trim()) return undefined;
      const parts = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
      return parts.length ? parts : undefined;
    }

    function parseSkippedMeals(raw) {
      return parseCommaList(raw);
    }

    function buildGeneratePayload(includeActualMeals) {
      const payload = {
        age: parseInt($("age").value, 10),
        weight: parseFloat($("weight").value),
        height: parseFloat($("height").value),
        gender: $("gender").value,
        activity_level: $("activity_level").value,
        goal: $("goal").value,
        diet_type: $("diet_type").value,
      };
      const skipped = parseSkippedMeals($("skipped_meals").value);
      if (skipped) payload.skipped_meals = skipped;
      if (includeActualMeals) {
        const am = parseCommaList($("actual_meals").value);
        if (am) payload.actual_meals = am;
      }
      return payload;
    }

    function setLoading(on, which) {
      $("btn-generate").disabled = on && which === "gen";
      $("btn-simulate").disabled = on && which === "sim";
      $("btn-feedback").disabled = on && which === "fb";
      if (!on) {
        $("status-line").textContent = "";
        return;
      }
      if (which === "gen") $("status-line").textContent = "Thinking…";
      else if (which === "sim") $("status-line").textContent = "Thinking…";
      else $("status-line").textContent = "Sending feedback…";
    }

    function showBanner(type, msg) {
      const el = $("banner");
      if (!msg) {
        el.innerHTML = "";
        return;
      }
      el.innerHTML = `<div class="banner ${type}">${escapeHtml(msg)}</div>`;
    }

    function escapeHtml(s) {
      const d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }

    function mealSortKey(name) {
      const n = (name || "").toLowerCase();
      if (n.includes("breakfast")) return 0;
      if (n.includes("lunch")) return 1;
      if (n.includes("dinner") || n.includes("supper")) return 2;
      return 3;
    }

    function renderWorkoutHtml(workout) {
      if (!workout || workout.error) {
        return `<div class="section"><h2>Workout</h2><div class="empty">Could not load workout plan.</div></div>`;
      }
      const plan = workout.weekly_plan;
      if (!plan || !Array.isArray(plan) || !plan.length) {
        return `<div class="section"><h2>Workout</h2><div class="empty">No workout days in response.</div></div>`;
      }
      let prog = "";
      if (workout.progression)
        prog = `<p class="hint"><strong>Progression:</strong> ${escapeHtml(String(workout.progression))}</p>`;
      let notes = "";
      if (workout.notes)
        notes = `<p class="hint"><strong>Notes:</strong> ${escapeHtml(String(workout.notes))}</p>`;
      const days = plan
        .map((day) => {
          const dayLabel = day.day != null ? String(day.day) : "Day";
          const focus = day.focus != null ? String(day.focus) : "";
          const title = focus
            ? `${escapeHtml(dayLabel)} — ${escapeHtml(focus)}`
            : escapeHtml(dayLabel);
          const exercises = day.exercises || [];
          const rows = exercises
            .map(
              (ex) =>
                `<tr><td>${escapeHtml(ex && ex.name != null ? String(ex.name) : "—")}</td><td>${
                  ex && ex.sets != null ? String(ex.sets) : "—"
                }</td><td>${ex && ex.reps != null ? String(ex.reps) : "—"}</td></tr>`
            )
            .join("");
          return `<article class="meal-card"><h3>${title}</h3><table style="width:100%;border-collapse:collapse;font-size:0.9rem;"><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th></tr></thead><tbody>${rows}</tbody></table></article>`;
        })
        .join("");
      return `<div class="section"><h2>Workout</h2>${prog}${notes}<div class="meals">${days}</div></div>`;
    }

    function renderOutput(data, workout, fullRaw) {
      renderCenter(data, workout, fullRaw);
      renderInsights(data);
    }

    function renderCenter(data, workout, fullRaw) {
      const out = $("output-center");
      if (data.error) {
        out.innerHTML = `<div class="empty">Request returned an error. See banner and raw JSON.</div>`;
        return;
      }

      const plan = data.plan;
      const val = data.validation || {};
      const targetKcal = data.target_calories;
      const totalKcal = val.total_calories != null ? val.total_calories : "—";
      const totalProt = val.total_protein != null ? val.total_protein : "—";
      const macros = data.macros || {};
      const targetProt = macros.protein != null ? macros.protein : "—";

      let mealsHtml = "";
      if (plan && Array.isArray(plan.meals) && plan.meals.length) {
        const meals = [...plan.meals].sort(
          (a, b) => mealSortKey(a.name) - mealSortKey(b.name)
        );
        mealsHtml = `<div class="section"><h2>Meals</h2><div class="meals">${meals
          .map((m) => {
            const items = (m.items || []).filter((i) => typeof i === "string");
            const li = items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
            return `<article class="meal-card">
              <h3>${escapeHtml(m.name || "Meal")}</h3>
              <div class="meal-meta">
                <span>Calories: <strong>${m.calories != null ? m.calories : "—"}</strong></span>
                <span>Protein: <strong>${m.protein != null ? Math.round(m.protein) : "—"}</strong> g</span>
              </div>
              <ul class="items">${li || "<li>(no items)</li>"}</ul>
            </article>`;
          })
          .join("")}</div></div>`;
      } else {
        mealsHtml = `<div class="section"><h2>Meals</h2><div class="empty">No meals in response.</div></div>`;
      }

      const adapt =
        data.adaptation
          ? `<div class="banner info" style="margin-bottom:1rem;">${escapeHtml(data.adaptation)}</div>`
          : "";

      out.innerHTML = `
        ${adapt}
        <div class="section">
          <h2>Summary</h2>
          <div class="summary-grid">
            <div class="stat"><div class="lbl">Target calories</div><div class="val">${targetKcal != null ? targetKcal : "—"}</div></div>
            <div class="stat"><div class="lbl">Total calories (plan)</div><div class="val">${totalKcal}</div></div>
            <div class="stat"><div class="lbl">Protein (plan) g</div><div class="val">${totalProt}</div></div>
            <div class="stat"><div class="lbl">Target protein g</div><div class="val">${targetProt}</div></div>
            <div class="stat"><div class="lbl">Validation</div><div class="val" style="font-size:1rem;">${escapeHtml(val.status || "—")}</div></div>
          </div>
        </div>
        ${mealsHtml}
        ${workout !== undefined ? renderWorkoutHtml(workout) : ""}
        <div class="section">
          <h2>Raw response</h2>
          <div class="json-toggle" id="json-toggle">▶ Show full JSON</div>
          <pre class="raw" id="raw-json"></pre>
        </div>
      `;

      $("raw-json").textContent = JSON.stringify(fullRaw != null ? fullRaw : data, null, 2);
      $("json-toggle").addEventListener("click", () => {
        const pre = $("raw-json");
        const t = $("json-toggle");
        const open = pre.classList.toggle("open");
        t.textContent = open ? "▼ Hide full JSON" : "▶ Show full JSON";
      });
    }

    function renderInsights(data) {
      const el = $("output-insights");
      if (data.error) {
        el.innerHTML = `<div class="insights-empty">No insights (error in response).</div>`;
        return;
      }

      const plan = data.plan;
      const quality = plan && plan.quality ? plan.quality : null;
      const scoreNum =
        quality && (quality.final_score != null ? quality.final_score : quality.score);
      const details = quality && quality.details ? quality.details : null;
      const selection = quality && quality.selection ? quality.selection : null;

      let scoreHtml = "";
      if (quality) {
        const breakdown = details
          ? Object.entries(details)
              .map(([k, v]) => `<div><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v))}</div>`)
              .join("")
          : "";
        const sel =
          selection &&
          Object.entries(selection)
            .map(([k, v]) => `<div><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v))}</div>`)
            .join("");
        scoreHtml = `<div class="section"><h2>Score</h2>
          <div class="score-box">
            <div class="lbl" style="color:var(--muted);font-size:0.75rem;">Total / final</div>
            <div class="score-total">${scoreNum != null ? scoreNum : "—"}</div>
            ${quality.score != null && quality.final_score != null && quality.final_score !== quality.score
              ? `<div class="hint">Base score: ${quality.score}</div>`
              : ""}
            <div class="breakdown">${breakdown}</div>
            ${sel ? `<div class="breakdown" style="margin-top:0.75rem;"><strong>Selection weights</strong>${sel}</div>` : ""}
          </div></div>`;
      } else {
        scoreHtml = `<div class="section"><h2>Score</h2><div class="hint">No <code>plan.quality</code> in response.</div></div>`;
      }

      const ad = data.adherence;
      let adHtml = "";
      if (ad) {
        adHtml = `<div class="section"><h2>Adherence</h2>
          <div class="score-box">
            <div class="score-total" style="font-size:1.5rem;">${ad.adherence != null ? ad.adherence + "%" : "—"}</div>
            <div class="hint">followed (planned)</div>
            <div class="breakdown">
              <div>Completed meals: <strong>${ad.completed != null ? ad.completed : "—"}</strong></div>
              <div>Planned meals: <strong>${ad.total != null ? ad.total : "—"}</strong></div>
            </div>
          </div></div>`;
      } else {
        adHtml = `<div class="section"><h2>Adherence</h2><div class="hint">Run <strong>Simulate Adherence</strong> with completed meal names to see adherence.</div></div>`;
      }

      const recObj = data.recommendations;
      const recList = recObj && recObj.recommendations ? recObj.recommendations : null;
      let recHtml = "";
      if (recList && recList.length) {
        const lis = recList.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
        recHtml = `<div class="section"><h2>Recommendations</h2><ul class="insight-list">${lis}</ul></div>`;
      } else {
        recHtml = `<div class="section"><h2>Recommendations</h2><div class="hint">None yet — simulate adherence after generating a plan.</div></div>`;
      }

      el.innerHTML = scoreHtml + adHtml + recHtml;
    }

    function syncOnboardingFromDom() {
      onboardingData.age = parseInt($("ob-age").value, 10);
      onboardingData.weight = parseFloat($("ob-weight").value);
      onboardingData.height = parseFloat($("ob-height").value);
      onboardingData.gender = $("ob-gender").value;
      onboardingData.activity_level = $("ob-activity_level").value;
      onboardingData.goal = $("ob-goal").value;
      onboardingData.diet_type = $("ob-diet_type").value;
      const al = parseCommaList($("ob-allergies").value);
      onboardingData.allergies = al || [];
      const pf = parseCommaList($("ob-preferred_foods").value);
      onboardingData.preferred_foods = pf || [];
      const df = parseCommaList($("ob-disliked_foods").value);
      onboardingData.disliked_foods = df || [];
      onboardingData.fitness_type = $("ob-fitness_type").value;
      onboardingData.gym_level = $("ob-gym_level").value;
      onboardingData.sport_type = $("ob-sport_type").value.trim() || undefined;
      onboardingData.training_intensity = $("ob-training_intensity").value;
    }

    function buildOnboardPayload() {
      syncOnboardingFromDom();
      const body = {
        age: onboardingData.age,
        weight: onboardingData.weight,
        height: onboardingData.height,
        gender: onboardingData.gender,
        activity_level: onboardingData.activity_level,
        goal: onboardingData.goal,
        diet_type: onboardingData.diet_type,
        fitness_type: onboardingData.fitness_type,
        gym_level: onboardingData.gym_level,
        training_intensity: onboardingData.training_intensity,
      };
      if (onboardingData.sport_type) body.sport_type = onboardingData.sport_type;
      if (onboardingData.allergies && onboardingData.allergies.length) body.allergies = onboardingData.allergies;
      if (onboardingData.preferred_foods && onboardingData.preferred_foods.length) body.preferred_foods = onboardingData.preferred_foods;
      if (onboardingData.disliked_foods && onboardingData.disliked_foods.length) body.disliked_foods = onboardingData.disliked_foods;
      return body;
    }

    function setWizardStep(n) {
      onboardStep = n;
      $("wizard-step-1").classList.toggle("hidden", n !== 1);
      $("wizard-step-2").classList.toggle("hidden", n !== 2);
      $("wizard-step-3").classList.toggle("hidden", n !== 3);
      $("btn-ob-back").disabled = n === 1;
      $("btn-ob-next").classList.toggle("hidden", n === 3);
      $("btn-ob-submit").classList.toggle("hidden", n !== 3);
      const labels = ["Profile", "Diet preferences", "Fitness"];
      $("wizard-step-label").textContent = `Step ${n} of 3 — ${labels[n - 1]}`;
    }

    function showMainView(which) {
      const onb = which === "onboarding";
      $("view-onboarding").classList.toggle("hidden", !onb);
      $("view-dashboard").classList.toggle("hidden", onb);
      $("tab-onboarding").classList.toggle("active", onb);
      $("tab-dashboard").classList.toggle("active", !onb);
      $("tab-onboarding").setAttribute("aria-selected", onb);
      $("tab-dashboard").setAttribute("aria-selected", !onb);
    }

    $("tab-onboarding").addEventListener("click", () => showMainView("onboarding"));
    $("tab-dashboard").addEventListener("click", () => showMainView("dashboard"));

    $("btn-ob-back").addEventListener("click", () => {
      if (onboardStep > 1) setWizardStep(onboardStep - 1);
    });

    $("btn-ob-next").addEventListener("click", () => {
      if (onboardStep < 3) setWizardStep(onboardStep + 1);
    });

    $("btn-ob-submit").addEventListener("click", async () => {
      $("onboard-hint").textContent = "";
      syncOnboardingFromDom();
      try {
        const res = await fetch(`${API}/onboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildOnboardPayload()),
        });
        const data = await res.json();
        if (!res.ok) {
          $("onboard-hint").textContent = data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`;
        } else {
          $("onboard-hint").textContent = "Saved. You can open the Dashboard to generate a plan.";
        }
      } catch (e) {
        $("onboard-hint").textContent = e.message;
      }
    });

    $("btn-generate").addEventListener("click", async () => {
      showBanner("", "");
      setLoading(true, "gen");
      try {
        const res = await fetch(`${API}/generate-full-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildGeneratePayload(false)),
        });
        const data = await res.json();
        lastResponse = data;
        const dietData = data.diet !== undefined ? data.diet : data;
        const workoutData = data.workout;
        if (!res.ok) {
          showBanner("error", data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`);
          renderOutput({ error: true, ...data }, undefined, data);
          lastPlan = null;
        } else {
          if (dietData.error) {
            showBanner("error", dietData.error + (dietData.details ? ` — ${dietData.details}` : ""));
            lastPlan = null;
          } else {
            showBanner("ok", "Plan generated.");
            lastPlan = dietData.plan || null;
          }
          renderOutput(dietData, workoutData, data);
        }
      } catch (e) {
        showBanner(
          "error",
          e.message + " (Start FastAPI on :8000 and run this page via Vite: npm run dev.)"
        );
        $("output-center").innerHTML = `<div class="empty">Network error. ${escapeHtml(e.message)}</div>`;
        $("output-insights").innerHTML = `<div class="insights-empty">—</div>`;
        lastPlan = null;
      } finally {
        setLoading(false, "gen");
      }
    });

    $("btn-simulate").addEventListener("click", async () => {
      showBanner("", "");
      setLoading(true, "sim");
      try {
        const res = await fetch(`${API}/generate-full-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildGeneratePayload(true)),
        });
        const data = await res.json();
        lastResponse = data;
        const dietData = data.diet !== undefined ? data.diet : data;
        const workoutData = data.workout;
        if (!res.ok) {
          showBanner("error", data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`);
          renderOutput({ error: true, ...data }, undefined, data);
          lastPlan = null;
        } else {
          if (dietData.error) {
            showBanner("error", dietData.error + (dietData.details ? ` — ${dietData.details}` : ""));
            lastPlan = null;
          } else {
            showBanner("ok", "Plan updated with adherence simulation.");
            lastPlan = dietData.plan || null;
          }
          renderOutput(dietData, workoutData, data);
        }
      } catch (e) {
        showBanner("error", e.message);
        $("output-center").innerHTML = `<div class="empty">Network error. ${escapeHtml(e.message)}</div>`;
        lastPlan = null;
      } finally {
        setLoading(false, "sim");
      }
    });

    $("btn-feedback").addEventListener("click", async () => {
      if (!lastPlan) {
        showBanner("error", "Generate a plan first (no plan stored).");
        return;
      }
      showBanner("", "");
      setLoading(true, "fb");
      try {
        const body = {
          rating: parseInt($("rating").value, 10),
          feedback_text: $("feedback_text").value || null,
          plan: lastPlan,
        };
        const res = await fetch(`${API}/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          showBanner("error", data.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`);
        } else {
          showBanner("ok", "Feedback stored.");
        }
      } catch (e) {
        showBanner("error", e.message);
      } finally {
        setLoading(false, "fb");
      }
    });

    setWizardStep(1);
"""


if __name__ == "__main__":
    main()
