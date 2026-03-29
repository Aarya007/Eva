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

  const diet = document.createElement("select");
  diet.className = "select";
  diet.id = "ob-diet";
  [
    ["veg", "Vegetarian"],
    ["non_veg", "Non-vegetarian"],
    ["vegan", "Vegan"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    diet.appendChild(o);
  });
  diet.value = state.diet_type;
  diet.addEventListener("change", () => onChange("diet_type", diet.value));

  const al = document.createElement("input");
  al.className = "input";
  al.type = "text";
  al.id = "ob-al";
  al.value = state.allergies_text;
  al.addEventListener("input", () => onChange("allergies_text", al.value));

  const pf = document.createElement("input");
  pf.className = "input";
  pf.type = "text";
  pf.id = "ob-pf";
  pf.value = state.preferred_foods_text;
  pf.addEventListener("input", () => onChange("preferred_foods_text", pf.value));

  const df = document.createElement("input");
  df.className = "input";
  df.type = "text";
  df.id = "ob-df";
  df.value = state.disliked_foods_text;
  df.addEventListener("input", () => onChange("disliked_foods_text", df.value));

  container.appendChild(fieldRow("ob-diet", "Diet type", diet, errors.diet_type));
  container.appendChild(fieldRow("ob-al", "Allergies (comma-separated)", al, null));
  container.appendChild(fieldRow("ob-pf", "Preferred foods", pf, null));
  container.appendChild(fieldRow("ob-df", "Disliked foods", df, null));
}
