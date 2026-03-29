import { STEPS } from "./steps/index.js";

/**
 * @param {HTMLElement} container
 * @param {number} currentIndex 0-based
 * @param {number[]} invalidStepIndices
 */
export function renderStepper(container, currentIndex, invalidStepIndices = []) {
  container.replaceChildren();
  const ol = document.createElement("ol");
  ol.className = "stepper";
  ol.setAttribute("aria-label", "Onboarding progress");

  STEPS.forEach((s, i) => {
    const li = document.createElement("li");
    li.className = "stepper__item";
    if (i < currentIndex) li.classList.add("stepper__item--done");
    if (i === currentIndex) li.classList.add("stepper__item--current");
    if (invalidStepIndices.includes(i)) li.classList.add("stepper__item--error");
    li.textContent = `${i + 1}. ${s.title}`;
    ol.appendChild(li);
  });
  container.appendChild(ol);
}
