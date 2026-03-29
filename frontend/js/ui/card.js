/**
 * @param {HTMLElement} [child]
 * @param {string} [extraClass]
 */
export function createCard(child, extraClass = "") {
  const el = document.createElement("div");
  el.className = `card ${extraClass}`.trim();
  if (child) el.appendChild(child);
  return el;
}
