/**
 * @param {"primary"|"secondary"|"ghost"|"success"} variant
 * @param {string} text
 * @param {object} [opts]
 */
export function createButton(text, variant = "primary", opts = {}) {
  const el = document.createElement("button");
  el.type = opts.type || "button";
  el.className = `btn btn--${variant}`;
  el.textContent = text;
  if (opts.id) el.id = opts.id;
  if (opts.disabled) el.disabled = true;
  if (opts.ariaLabel) el.setAttribute("aria-label", opts.ariaLabel);
  if (opts.onClick) el.addEventListener("click", opts.onClick);
  return el;
}
