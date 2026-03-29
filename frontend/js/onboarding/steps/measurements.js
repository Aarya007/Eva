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

  const na = document.createElement("label");
  na.className = "field";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.id = "ob-m-na";
  cb.checked = Boolean(state.measurements_na);
  cb.addEventListener("change", () => onChange("measurements_na", cb.checked));
  na.appendChild(cb);
  const span = document.createElement("span");
  span.textContent = " Measurements not applicable / prefer to skip";
  span.style.marginLeft = "8px";
  na.appendChild(span);
  container.appendChild(na);

  const waist = document.createElement("input");
  waist.className = "input";
  waist.type = "number";
  waist.id = "ob-waist";
  waist.step = "any";
  waist.placeholder = "cm";
  waist.value = state.waist_cm;
  waist.disabled = Boolean(state.measurements_na);
  waist.addEventListener("input", () => onChange("waist_cm", waist.value));

  const bf = document.createElement("input");
  bf.className = "input";
  bf.type = "number";
  bf.id = "ob-bf";
  bf.step = "any";
  bf.min = "0";
  bf.max = "100";
  bf.placeholder = "%";
  bf.value = state.body_fat_pct;
  bf.disabled = Boolean(state.measurements_na);
  bf.addEventListener("input", () => onChange("body_fat_pct", bf.value));

  container.appendChild(fieldRow("ob-waist", "Waist (cm)", waist, null));
  container.appendChild(fieldRow("ob-bf", "Body fat (%)", bf, null));

  if (errors.measurements) {
    const alert = document.createElement("div");
    alert.className = "inline-error";
    alert.setAttribute("role", "alert");
    alert.textContent = errors.measurements;
    container.appendChild(alert);
  }
}
