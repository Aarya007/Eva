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

function selectOptions(select, pairs, current) {
  select.replaceChildren();
  pairs.forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    select.appendChild(o);
  });
  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
}

export function render(container, state, errors, { onChange }) {
  container.replaceChildren();

  const ft = document.createElement("select");
  ft.className = "select";
  ft.id = "ob-ft";
  ft.setAttribute("aria-required", "true");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select where you train…";
  ft.appendChild(placeholder);
  [
    ["home", "Home"],
    ["gym", "Gym"],
    ["athlete", "Athlete"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    ft.appendChild(o);
  });
  const curFt = String(state.fitness_type || "").trim();
  if (["home", "gym", "athlete"].includes(curFt)) {
    ft.value = curFt;
  } else {
    ft.value = "";
  }
  ft.addEventListener("change", () => onChange("fitness_type", ft.value));

  container.appendChild(fieldRow("ob-ft", "Where do you train?", ft, errors.fitness_type));

  const branch = curFt;

  const intensitySelect = () => {
    const el = document.createElement("select");
    el.className = "select";
    el.id = "ob-ti";
    selectOptions(
      el,
      [
        ["", "Select intensity…"],
        ["low", "Low"],
        ["medium", "Medium"],
        ["high", "High"],
      ],
      String(state.training_intensity || "").trim()
    );
    el.addEventListener("change", () => onChange("training_intensity", el.value));
    return el;
  };

  const gymLevelSelect = () => {
    const el = document.createElement("select");
    el.className = "select";
    el.id = "ob-gl";
    selectOptions(
      el,
      [
        ["", "Select level…"],
        ["beginner", "Beginner"],
        ["intermediate", "Intermediate"],
        ["advanced", "Advanced"],
      ],
      String(state.gym_level || "").trim()
    );
    el.addEventListener("change", () => onChange("gym_level", el.value));
    return el;
  };

  const tz = document.createElement("input");
  tz.className = "input";
  tz.type = "text";
  tz.id = "ob-tz";
  tz.placeholder = "e.g. Asia/Kolkata";
  tz.value = state.timezone || "";
  tz.addEventListener("input", () => onChange("timezone", tz.value));

  const dn = document.createElement("input");
  dn.className = "input";
  dn.type = "text";
  dn.id = "ob-dn";
  dn.placeholder = "optional";
  dn.value = state.display_name || "";
  dn.addEventListener("input", () => onChange("display_name", dn.value));

  if (branch === "home") {
    container.appendChild(fieldRow("ob-ti", "Training intensity", intensitySelect(), errors.training_intensity));
    container.appendChild(fieldRow("ob-tz", "Timezone", tz, errors.timezone));
  } else if (branch === "gym") {
    container.appendChild(fieldRow("ob-gl", "Gym level", gymLevelSelect(), errors.gym_level));
    container.appendChild(fieldRow("ob-ti", "Training intensity", intensitySelect(), errors.training_intensity));
    container.appendChild(fieldRow("ob-tz", "Timezone", tz, errors.timezone));
  } else if (branch === "athlete") {
    const st = document.createElement("input");
    st.className = "input";
    st.type = "text";
    st.id = "ob-st";
    st.placeholder = "e.g. running, cricket";
    st.value = state.sport_type || "";
    st.addEventListener("input", () => onChange("sport_type", st.value));

    const env = document.createElement("select");
    env.className = "select";
    env.id = "ob-env";
    selectOptions(
      env,
      [
        ["", "Select…"],
        ["gym", "Mostly gym"],
        ["outside", "Mostly outside"],
        ["both", "Both gym and outside"],
      ],
      String(state.training_environment || "").trim()
    );
    env.addEventListener("change", () => onChange("training_environment", env.value));

    container.appendChild(fieldRow("ob-st", "Sport / activity", st, errors.sport_type));
    container.appendChild(fieldRow("ob-ti", "Training intensity", intensitySelect(), errors.training_intensity));
    container.appendChild(
      fieldRow("ob-env", "Where does your sport training happen?", env, errors.training_environment)
    );
    container.appendChild(fieldRow("ob-tz", "Timezone", tz, errors.timezone));
  }

  container.appendChild(fieldRow("ob-dn", "Display name", dn, null));
}
