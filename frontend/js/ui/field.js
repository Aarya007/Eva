/**
 * @param {object} cfg
 * @param {string} cfg.id
 * @param {string} cfg.label
 * @param {"text"|"number"|"textarea"|"select"} cfg.kind
 * @param {string} [cfg.error]
 * @param {string} [cfg.hint]
 * @param {string} [cfg.value]
 * @param {string} [cfg.placeholder]
 * @param {boolean} [cfg.required]
 * @param {{value:string,label:string}[]} [cfg.options]
 */
export function createField(cfg) {
  const wrap = document.createElement("div");
  wrap.className = "field";

  const label = document.createElement("label");
  label.className = "field__label";
  label.htmlFor = cfg.id;
  label.textContent = cfg.label;

  let input;
  if (cfg.kind === "textarea") {
    input = document.createElement("textarea");
    input.className = "textarea";
    if (cfg.value) input.value = cfg.value;
  } else if (cfg.kind === "select") {
    input = document.createElement("select");
    input.className = "select";
    for (const o of cfg.options || []) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (cfg.value === o.value) opt.selected = true;
      input.appendChild(opt);
    }
  } else {
    input = document.createElement("input");
    input.className = "input";
    input.type = cfg.kind === "number" ? "number" : "text";
    if (cfg.value != null && cfg.value !== "") input.value = cfg.value;
  }

  input.id = cfg.id;
  input.name = cfg.id;
  if (cfg.placeholder) input.placeholder = cfg.placeholder;
  if (cfg.required) input.required = true;
  if (cfg.error) {
    input.setAttribute("aria-invalid", "true");
    const errId = `${cfg.id}-error`;
    input.setAttribute("aria-describedby", errId);
  } else {
    input.setAttribute("aria-invalid", "false");
  }

  wrap.appendChild(label);
  wrap.appendChild(input);

  if (cfg.hint) {
    const hint = document.createElement("p");
    hint.className = "field__hint";
    hint.id = `${cfg.id}-hint`;
    hint.textContent = cfg.hint;
    wrap.appendChild(hint);
    input.setAttribute("aria-describedby", `${cfg.id}-hint`);
  }

  if (cfg.error) {
    const err = document.createElement("p");
    err.className = "field__error";
    err.id = `${cfg.id}-error`;
    err.setAttribute("role", "alert");
    err.textContent = cfg.error;
    wrap.appendChild(err);
  }

  return { wrap, input };
}
