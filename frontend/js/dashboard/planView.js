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

/**
 * @param {HTMLElement} container
 * @param {object} data API response
 */
export function renderPlanOutput(container, data) {
  container.replaceChildren();
  if (data.error) {
    const el = document.createElement("div");
    el.className = "empty-state";
    el.textContent = "Could not render plan.";
    container.appendChild(el);
    return;
  }

  const plan = data.plan;
  const val = data.validation || {};
  const targetKcal = data.target_calories;
  const totalKcal = val.total_calories != null ? val.total_calories : "—";
  const totalProt = val.total_protein != null ? val.total_protein : "—";
  const macros = data.macros || {};
  const targetProt = macros.protein != null ? macros.protein : "—";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(140px, 1fr))";
  grid.style.gap = "var(--space-3)";
  grid.style.marginBottom = "var(--space-4)";

  [
    ["Target calories", targetKcal != null ? targetKcal : "—"],
    ["Total calories (plan)", totalKcal],
    ["Protein (plan) g", totalProt],
    ["Target protein g", targetProt],
  ].forEach(([lbl, val]) => {
    const mc = document.createElement("div");
    mc.className = "metric-card";
    const l = document.createElement("p");
    l.className = "metric-card__label";
    l.textContent = lbl;
    const v = document.createElement("p");
    v.className = "metric-card__value";
    v.textContent = String(val);
    mc.appendChild(l);
    mc.appendChild(v);
    grid.appendChild(mc);
  });
  container.appendChild(grid);

  if (data.adaptation) {
    const info = document.createElement("div");
    info.className = "inline-error";
    info.style.background = "#eff6ff";
    info.style.borderColor = "#bfdbfe";
    info.style.color = "#1e40af";
    info.textContent = data.adaptation;
    container.appendChild(info);
  }

  if (plan && Array.isArray(plan.meals) && plan.meals.length) {
    const meals = [...plan.meals].sort((a, b) => mealSortKey(a.name) - mealSortKey(b.name));
    meals.forEach((m) => {
      const card = document.createElement("article");
      card.className = "meal-card";
      const h = document.createElement("h3");
      h.className = "meal-card__title";
      h.textContent = m.name || "Meal";
      const meta = document.createElement("div");
      meta.className = "meal-card__meta";
      meta.innerHTML = `Calories: <strong>${m.calories != null ? m.calories : "—"}</strong> · Protein: <strong>${m.protein != null ? Math.round(m.protein) : "—"}</strong> g`;
      const ul = document.createElement("ul");
      ul.style.margin = "0";
      ul.style.paddingLeft = "1.2rem";
      const items = (m.items || []).filter((i) => typeof i === "string");
      if (items.length === 0) {
        const li = document.createElement("li");
        li.textContent = "(no items)";
        ul.appendChild(li);
      } else {
        items.forEach((i) => {
          const li = document.createElement("li");
          li.textContent = i;
          ul.appendChild(li);
        });
      }
      card.appendChild(h);
      card.appendChild(meta);
      card.appendChild(ul);
      container.appendChild(card);
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No meals in response.";
    container.appendChild(empty);
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn btn--ghost";
  toggle.textContent = "Show raw JSON";
  const pre = document.createElement("pre");
  pre.style.display = "none";
  pre.style.marginTop = "var(--space-3)";
  pre.style.padding = "var(--space-3)";
  pre.style.background = "#18181b";
  pre.style.color = "#e4e4e7";
  pre.style.borderRadius = "var(--radius-sm)";
  pre.style.overflow = "auto";
  pre.style.maxHeight = "240px";
  pre.style.fontSize = "var(--text-sm)";
  pre.textContent = JSON.stringify(data, null, 2);
  toggle.addEventListener("click", () => {
    const open = pre.style.display !== "block";
    pre.style.display = open ? "block" : "none";
    toggle.textContent = open ? "Hide raw JSON" : "Show raw JSON";
  });
  container.appendChild(toggle);
  container.appendChild(pre);
}

/**
 * @param {object | null | undefined} quality plan.quality from API
 * @returns {number | null} integer 0–100
 */
function score0to100FromQuality(quality) {
  if (!quality || typeof quality !== "object") return null;
  const raw =
    quality.final_score != null ? quality.final_score : quality.score != null ? quality.score : null;
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  return Math.round(Math.max(0, Math.min(100, Number(raw))));
}

/**
 * @param {HTMLElement} container
 */
export function renderInsightsOutput(container, data) {
  container.replaceChildren();
  if (data.error) {
    const p = document.createElement("p");
    p.className = "field__hint";
    p.textContent = "No insights (error).";
    container.appendChild(p);
    return;
  }

  const plan = data.plan;
  const quality = plan && plan.quality ? plan.quality : null;
  const score = score0to100FromQuality(quality);
  const ad = data.adherence;
  const recObj = data.recommendations;
  const recList = recObj && Array.isArray(recObj.recommendations) ? recObj.recommendations : [];

  const root = document.createElement("div");
  root.className = "insights-panel";

  function addBlock(titleText) {
    const block = document.createElement("section");
    block.className = "insights-panel__block";
    const t = document.createElement("h3");
    t.className = "insights-panel__label";
    t.textContent = titleText;
    block.appendChild(t);
    return block;
  }

  // 1 — Plan score (0–100)
  const secScore = addBlock("Plan score");
  const scoreWrap = document.createElement("div");
  scoreWrap.className = "insights-score";
  if (score != null) {
    const v = document.createElement("span");
    v.className = "insights-score__value";
    v.textContent = String(score);
    const sfx = document.createElement("span");
    sfx.className = "insights-score__suffix";
    sfx.textContent = "/100";
    scoreWrap.append(v, sfx);
  } else {
    const dash = document.createElement("span");
    dash.className = "insights-score__empty";
    dash.textContent = "—";
    scoreWrap.appendChild(dash);
  }
  secScore.appendChild(scoreWrap);
  const scoreHint = document.createElement("p");
  scoreHint.className = "field__hint insights-panel__hint";
  scoreHint.textContent =
    score != null
      ? "Diversity, balance, and simplicity of the meal plan."
      : "Appears once a valid plan is generated.";
  secScore.appendChild(scoreHint);
  root.appendChild(secScore);

  // 2 — Adherence %
  const secPct = addBlock("Adherence");
  const pctRow = document.createElement("p");
  pctRow.className = "insights-metric";
  if (ad && ad.adherence != null && Number.isFinite(Number(ad.adherence))) {
    pctRow.textContent = `${Math.round(Number(ad.adherence))}%`;
  } else {
    pctRow.classList.add("insights-metric--muted");
    pctRow.textContent = "—";
  }
  secPct.appendChild(pctRow);
  const pctHint = document.createElement("p");
  pctHint.className = "field__hint insights-panel__hint";
  pctHint.textContent =
    ad && ad.adherence != null
      ? "Share of planned meals you marked as completed (simulate)."
      : "Run Simulate adherence with completed meal names.";
  secPct.appendChild(pctHint);
  root.appendChild(secPct);

  // 3 — Completed meals
  const secMeals = addBlock("Completed meals");
  const mealsRow = document.createElement("p");
  mealsRow.className = "insights-metric";
  if (ad && ad.completed != null && ad.total != null) {
    mealsRow.textContent = `${ad.completed} of ${ad.total} meals`;
  } else {
    mealsRow.classList.add("insights-metric--muted");
    mealsRow.textContent = "—";
  }
  secMeals.appendChild(mealsRow);
  const mealsHint = document.createElement("p");
  mealsHint.className = "field__hint insights-panel__hint";
  mealsHint.textContent =
    ad && ad.completed != null && ad.total != null
      ? "From your last adherence simulation."
      : "Shown after simulating with completed meals.";
  secMeals.appendChild(mealsHint);
  root.appendChild(secMeals);

  // 4 — Recommendations
  const secRec = addBlock("Recommendations");
  if (recList.length) {
    const ul = document.createElement("ul");
    ul.className = "insights-list";
    recList.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = typeof r === "string" ? r : String(r);
      ul.appendChild(li);
    });
    secRec.appendChild(ul);
  } else {
    const empty = document.createElement("p");
    empty.className = "field__hint insights-panel__hint";
    empty.textContent = "None yet — simulate adherence to get tailored tips.";
    secRec.appendChild(empty);
  }
  root.appendChild(secRec);

  container.appendChild(root);
}

/**
 * @param {HTMLElement} container
 * @param {object} workout weekly_plan / progression / notes from WorkoutPlannerAgent
 */
export function renderWorkoutOutput(container, workout) {
  container.replaceChildren();
  if (!workout || workout.error) {
    const el = document.createElement("div");
    el.className = "empty-state";
    el.textContent = "Could not render workout plan.";
    container.appendChild(el);
    return;
  }

  if (workout.progression) {
    const p = document.createElement("p");
    p.className = "field__hint";
    p.style.marginBottom = "var(--space-3)";
    const s = document.createElement("strong");
    s.textContent = "Progression: ";
    p.appendChild(s);
    p.appendChild(document.createTextNode(String(workout.progression)));
    container.appendChild(p);
  }
  if (workout.notes) {
    const p = document.createElement("p");
    p.className = "field__hint";
    p.style.marginBottom = "var(--space-4)";
    const s = document.createElement("strong");
    s.textContent = "Notes: ";
    p.appendChild(s);
    p.appendChild(document.createTextNode(String(workout.notes)));
    container.appendChild(p);
  }

  const plan = workout.weekly_plan;
  if (plan && Array.isArray(plan) && plan.length) {
    plan.forEach((day) => {
      const card = document.createElement("article");
      card.className = "meal-card";
      const h = document.createElement("h3");
      h.className = "meal-card__title";
      const dayLabel = day.day != null ? String(day.day) : "Day";
      const focus = day.focus != null ? String(day.focus) : "";
      h.textContent = focus ? `${dayLabel} — ${focus}` : dayLabel;
      card.appendChild(h);

      const exercises = day.exercises || [];
      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";
      table.style.fontSize = "var(--text-sm)";
      table.style.marginTop = "var(--space-2)";

      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      ["Exercise", "Sets", "Reps"].forEach((label) => {
        const th = document.createElement("th");
        th.style.textAlign = "left";
        th.style.padding = "var(--space-1) var(--space-2) var(--space-1) 0";
        th.textContent = label;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      exercises.forEach((ex) => {
        const tr = document.createElement("tr");
        const nameTd = document.createElement("td");
        nameTd.style.padding = "var(--space-1) var(--space-2) var(--space-1) 0";
        nameTd.textContent = ex && ex.name != null ? String(ex.name) : "—";
        const setsTd = document.createElement("td");
        setsTd.textContent = ex && ex.sets != null ? String(ex.sets) : "—";
        const repsTd = document.createElement("td");
        repsTd.textContent = ex && ex.reps != null ? String(ex.reps) : "—";
        tr.appendChild(nameTd);
        tr.appendChild(setsTd);
        tr.appendChild(repsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      card.appendChild(table);
      container.appendChild(card);
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No workout days in response.";
    container.appendChild(empty);
  }
}
