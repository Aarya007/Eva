import { STEPS } from "./steps/index.js";
import { renderStepper } from "./Stepper.js";
import { validateStep, validateFull } from "./validate.js";
import {
  mapPayloadFull,
  mapPayloadStep,
  initialState,
  applyProfileToState,
  applyFitnessTypeChange,
} from "./mapPayload.js";
import { postOnboardingStep, postOnboard, fetchOnboardingStatus } from "../api/client.js";
import { createButton } from "../ui/button.js";

/**
 * @param {HTMLElement} root
 * @param {{ onComplete: () => void | Promise<void>, onStateChange?: () => void }} callbacks
 */
export function mountWizard(root, callbacks) {
  const state = initialState();
  let stepIndex = 0;
  let stepErrors = {};
  let submitError = "";

  const shell = document.createElement("div");
  shell.className = "card card--pad-lg";
  shell.setAttribute("data-wizard", "true");

  const stepperHost = document.createElement("div");
  const title = document.createElement("h1");
  title.className = "heading-page";
  title.id = "wizard-step-title";
  title.tabIndex = -1;

  const summary = document.createElement("p");
  summary.className = "field__hint";
  summary.id = "wizard-summary";

  const stepHost = document.createElement("div");
  stepHost.className = "wizard-panel";
  stepHost.setAttribute("role", "region");
  stepHost.setAttribute("aria-labelledby", "wizard-step-title");

  const alertHost = document.createElement("div");
  alertHost.setAttribute("role", "alert");
  alertHost.setAttribute("aria-live", "assertive");

  const nav = document.createElement("div");
  nav.className = "btn-row";
  nav.style.marginTop = "var(--space-5)";

  const btnBack = createButton("Back", "secondary", { id: "wiz-back" });
  const btnNext = createButton("Next", "primary", { id: "wiz-next" });
  const btnDone = createButton("Complete", "success", { id: "wiz-done" });
  btnDone.style.display = "none";

  nav.appendChild(btnBack);
  nav.appendChild(btnNext);
  nav.appendChild(btnDone);

  shell.appendChild(stepperHost);
  shell.appendChild(title);
  shell.appendChild(summary);
  shell.appendChild(alertHost);
  shell.appendChild(stepHost);
  shell.appendChild(nav);

  root.appendChild(shell);

  function onChange(key, value) {
    if (key === "fitness_type" && stepIndex === 6) {
      applyFitnessTypeChange(state, value);
      stepErrors = {};
      render();
      if (callbacks.onStateChange) callbacks.onStateChange();
    } else {
      state[key] = value;
      if (callbacks.onStateChange) callbacks.onStateChange();
    }
  }

  function render() {
    const inv = Object.keys(stepErrors).length ? [stepIndex] : [];
    renderStepper(stepperHost, stepIndex, inv);
    title.textContent = `${STEPS[stepIndex].title}`;
    summary.textContent = `Step ${stepIndex + 1} of ${STEPS.length}`;

    STEPS[stepIndex].render(stepHost, state, stepErrors, { onChange });
    if (
      typeof stepHost.animate === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      stepHost.animate([{ opacity: 0.82 }, { opacity: 1 }], {
        duration: 200,
        easing: "ease-out",
      });
    }

    btnBack.disabled = stepIndex === 0;
    btnNext.style.display = stepIndex < STEPS.length - 1 ? "inline-flex" : "none";
    btnDone.style.display = stepIndex === STEPS.length - 1 ? "inline-flex" : "none";

    alertHost.replaceChildren();
    if (submitError) {
      const err = document.createElement("div");
      err.className = "inline-error";
      err.textContent = submitError;
      alertHost.appendChild(err);
    }

    requestAnimationFrame(() => title.focus());
  }

  async function saveCurrentStep() {
    const body = mapPayloadStep(stepIndex, state);
    await postOnboardingStep(body);
  }

  btnBack.addEventListener("click", () => {
    submitError = "";
    if (stepIndex > 0) {
      stepIndex -= 1;
      stepErrors = {};
      render();
    }
  });

  btnNext.addEventListener("click", async () => {
    submitError = "";
    const { ok, errors } = validateStep(stepIndex, state);
    stepErrors = errors;
    if (!ok) {
      render();
      return;
    }
    shell.setAttribute("aria-busy", "true");
    try {
      await saveCurrentStep();
      stepIndex += 1;
      stepErrors = {};
      render();
    } catch (e) {
      submitError = e.message || String(e);
      render();
    } finally {
      shell.removeAttribute("aria-busy");
    }
  });

  btnDone.addEventListener("click", async () => {
    submitError = "";
    const full = validateFull(state);
    const last = validateStep(stepIndex, state);
    stepErrors = { ...full.errors, ...last.errors };
    if (!full.ok || !last.ok) {
      render();
      return;
    }
    shell.setAttribute("aria-busy", "true");
    try {
      const body = mapPayloadFull(state);
      await postOnboard(body);
      await Promise.resolve(callbacks.onComplete?.());
    } catch (e) {
      submitError = e.message || String(e);
      render();
    } finally {
      shell.removeAttribute("aria-busy");
    }
  });

  async function hydrate() {
    try {
      const st = await fetchOnboardingStatus();
      applyProfileToState(state, st.profile || {});
    } catch (_) {
      /* offline — keep defaults */
    }
    render();
  }

  render();
  hydrate();

  return {
    state,
    refresh: hydrate,
    getStep: () => stepIndex,
    rerender: render,
  };
}
