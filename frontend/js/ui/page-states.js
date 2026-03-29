import { createSpinner } from "./spinner.js";

export function pageLoading(message = "Loading…") {
  const wrap = document.createElement("div");
  wrap.className = "page-loading";
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");
  wrap.appendChild(createSpinner());
  const p = document.createElement("p");
  p.textContent = message;
  wrap.appendChild(p);
  return wrap;
}

export function inlineError(message) {
  const el = document.createElement("div");
  el.className = "inline-error";
  el.setAttribute("role", "alert");
  el.textContent = message;
  return el;
}

export function emptyState(message) {
  const el = document.createElement("div");
  el.className = "empty-state";
  el.textContent = message;
  return el;
}
