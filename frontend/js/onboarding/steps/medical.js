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

  const none = document.createElement("label");
  none.className = "field";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.id = "ob-medical-none";
  cb.checked = Boolean(state.medical_none_ack);
  cb.addEventListener("change", () => onChange("medical_none_ack", cb.checked));
  none.appendChild(cb);
  const span = document.createElement("span");
  span.textContent = " No medical conditions or medications to report";
  span.style.marginLeft = "8px";
  none.appendChild(span);
  container.appendChild(none);

  const cond = document.createElement("input");
  cond.className = "input";
  cond.type = "text";
  cond.id = "ob-conditions";
  cond.placeholder = "comma-separated";
  cond.value = state.medical_conditions_text;
  cond.disabled = Boolean(state.medical_none_ack);
  cond.addEventListener("input", () => onChange("medical_conditions_text", cond.value));

  const meds = document.createElement("input");
  meds.className = "input";
  meds.type = "text";
  meds.id = "ob-meds";
  meds.placeholder = "comma-separated";
  meds.value = state.medications_text;
  meds.disabled = Boolean(state.medical_none_ack);
  meds.addEventListener("input", () => onChange("medications_text", meds.value));

  container.appendChild(fieldRow("ob-conditions", "Medical conditions", cond, null));
  container.appendChild(fieldRow("ob-meds", "Medications", meds, null));

  if (errors.medical) {
    const alert = document.createElement("div");
    alert.className = "inline-error";
    alert.setAttribute("role", "alert");
    alert.id = "step-medical-summary";
    alert.textContent = errors.medical;
    container.appendChild(alert);
  }
}
