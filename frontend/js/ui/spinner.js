export function createSpinner(ariaLabel = "Loading") {
  const el = document.createElement("div");
  el.className = "spinner";
  el.setAttribute("role", "status");
  el.setAttribute("aria-label", ariaLabel);
  return el;
}
