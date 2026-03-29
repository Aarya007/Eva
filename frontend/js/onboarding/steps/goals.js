function fieldRow(id, label, inputEl, error) {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const lab = document.createElement("label");
  lab.className = "field__label";
  lab.htmlFor = id;
  lab.textContent = label;
  wrap.appendChild(lab);
  wrap.appendChild(inputEl);
  if (error) {
    const e = document.createElement("p");
    e.className = "field__error";
    e.id = `${id}-error`;
    e.setAttribute("role", "alert");
    e.textContent = error;
    wrap.appendChild(e);
    inputEl.setAttribute("aria-invalid", "true");
    inputEl.setAttribute("aria-describedby", `${id}-error`);
  } else {
    inputEl.setAttribute("aria-invalid", "false");
  }
  return wrap;
}

export function render(container, state, errors, { onChange }) {
  container.replaceChildren();

  const goal = document.createElement("select");
  goal.className = "select";
  goal.id = "ob-goal";
  [
    ["fat_loss", "Fat loss"],
    ["maintenance", "Maintenance"],
    ["muscle_gain", "Muscle gain"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    goal.appendChild(o);
  });
  goal.value = state.goal;
  goal.addEventListener("change", () => onChange("goal", goal.value));

  const act = document.createElement("select");
  act.className = "select";
  act.id = "ob-act";
  [
    ["sedentary", "Sedentary"],
    ["moderate", "Moderate"],
    ["active", "Active"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    act.appendChild(o);
  });
  act.value = state.activity_level;
  act.addEventListener("change", () => onChange("activity_level", act.value));

  const tw = document.createElement("input");
  tw.className = "input";
  tw.type = "number";
  tw.id = "ob-tw";
  tw.step = "any";
  tw.placeholder = "optional";
  tw.value = state.target_weight_kg;
  tw.addEventListener("input", () => onChange("target_weight_kg", tw.value));

  const gw = document.createElement("input");
  gw.className = "input";
  gw.type = "number";
  gw.id = "ob-gw";
  gw.min = "1";
  gw.placeholder = "optional weeks";
  gw.value = state.goal_timeline_weeks;
  gw.addEventListener("input", () => onChange("goal_timeline_weeks", gw.value));

  container.appendChild(fieldRow("ob-goal", "Goal", goal, errors.goal));
  container.appendChild(fieldRow("ob-act", "Activity level", act, errors.activity_level));
  container.appendChild(fieldRow("ob-tw", "Target weight (kg)", tw, null));
  container.appendChild(fieldRow("ob-gw", "Goal timeline (weeks)", gw, null));
}
