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

  const sleep = document.createElement("input");
  sleep.className = "input";
  sleep.type = "number";
  sleep.id = "ob-sleep";
  sleep.step = "any";
  sleep.min = "0";
  sleep.max = "24";
  sleep.value = state.sleep_hours;
  sleep.addEventListener("input", () => onChange("sleep_hours", sleep.value));

  const stress = document.createElement("select");
  stress.className = "select";
  stress.id = "ob-stress";
  ["low", "medium", "high"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    stress.appendChild(o);
  });
  stress.value = state.stress_level;
  stress.addEventListener("change", () => onChange("stress_level", stress.value));

  const work = document.createElement("select");
  work.className = "select";
  work.id = "ob-work";
  [
    ["sedentary", "Sedentary"],
    ["mixed", "Mixed"],
    ["active", "Active"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    work.appendChild(o);
  });
  work.value = state.work_schedule;
  work.addEventListener("change", () => onChange("work_schedule", work.value));

  container.appendChild(fieldRow("ob-sleep", "Sleep (hours per night)", sleep, errors.sleep_hours));
  container.appendChild(fieldRow("ob-stress", "Stress level", stress, errors.stress_level));
  container.appendChild(fieldRow("ob-work", "Work schedule", work, errors.work_schedule));
}
