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
  const scoreNum =
    quality && (quality.final_score != null ? quality.final_score : quality.score);
  const details = quality && quality.details ? quality.details : null;

  if (quality) {
    const box = document.createElement("div");
    box.className = "card";
    box.style.marginBottom = "var(--space-3)";
    const h = document.createElement("h3");
    h.className = "heading-section";
    h.textContent = "Score";
    const p = document.createElement("p");
    p.style.fontSize = "var(--text-xl)";
    p.style.fontWeight = "700";
    p.style.margin = "0";
    p.textContent = scoreNum != null ? String(scoreNum) : "—";
    box.appendChild(h);
    box.appendChild(p);
    if (details) {
      Object.entries(details).forEach(([k, v]) => {
        const d = document.createElement("div");
        d.className = "field__hint";
        d.innerHTML = `<strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v))}`;
        box.appendChild(d);
      });
    }
    container.appendChild(box);
  }

  const ad = data.adherence;
  if (ad) {
    const box = document.createElement("div");
    box.className = "card";
    box.style.marginBottom = "var(--space-3)";
    box.innerHTML = `<h3 class="heading-section">Adherence</h3>
      <p style="font-size:var(--text-xl);font-weight:700;margin:0;">${ad.adherence != null ? ad.adherence + "%" : "—"}</p>
      <p class="field__hint">Completed ${ad.completed != null ? ad.completed : "—"} / ${ad.total != null ? ad.total : "—"} meals</p>`;
    container.appendChild(box);
  }

  const recObj = data.recommendations;
  const recList = recObj && recObj.recommendations ? recObj.recommendations : null;
  if (recList && recList.length) {
    const box = document.createElement("div");
    box.className = "card";
    const h = document.createElement("h3");
    h.className = "heading-section";
    h.textContent = "Recommendations";
    const ul = document.createElement("ul");
    ul.style.margin = "0";
    ul.style.paddingLeft = "1.1rem";
    recList.forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      ul.appendChild(li);
    });
    box.appendChild(h);
    box.appendChild(ul);
    container.appendChild(box);
  }

  if (!quality && !ad && (!recList || !recList.length)) {
    const p = document.createElement("p");
    p.className = "field__hint";
    p.textContent = "Generate a plan; simulate adherence to see recommendations.";
    container.appendChild(p);
  }
}
