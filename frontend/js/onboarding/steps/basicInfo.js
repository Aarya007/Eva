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

  const age = document.createElement("input");
  age.className = "input";
  age.type = "number";
  age.id = "ob-age";
  age.min = "1";
  age.max = "120";
  age.value = state.age;
  age.addEventListener("input", () => onChange("age", age.value));

  const weight = document.createElement("input");
  weight.className = "input";
  weight.type = "number";
  weight.id = "ob-weight";
  weight.step = "any";
  weight.value = state.weight;
  weight.addEventListener("input", () => onChange("weight", weight.value));

  const height = document.createElement("input");
  height.className = "input";
  height.type = "number";
  height.id = "ob-height";
  height.step = "any";
  height.value = state.height;
  height.addEventListener("input", () => onChange("height", height.value));

  const gender = document.createElement("select");
  gender.className = "select";
  gender.id = "ob-gender";
  [["male", "Male"], ["female", "Female"]].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    gender.appendChild(o);
  });
  gender.value = state.gender;
  gender.addEventListener("change", () => onChange("gender", gender.value));

  container.appendChild(fieldRow("ob-age", "Age", age, errors.age));
  container.appendChild(fieldRow("ob-weight", "Weight (kg)", weight, errors.weight));
  container.appendChild(fieldRow("ob-height", "Height (cm)", height, errors.height));
  container.appendChild(fieldRow("ob-gender", "Gender", gender, errors.gender));
}
