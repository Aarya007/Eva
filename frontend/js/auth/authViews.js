import { getSupabase, getAuthRedirectUrl, isSupabaseConfigured } from "./supabaseClient.js";
import { inlineError } from "../ui/page-states.js";

/**
 * @param {import("@supabase/supabase-js").AuthError | Error | null | undefined} error
 */
function formatAuthError(error) {
  if (!error) return "Something went wrong.";
  const msg = "message" in error && error.message ? error.message : String(error);
  const code = "code" in error && error.code != null ? error.code : "status" in error ? error.status : null;
  if (import.meta.env.DEV && code != null) return `${msg} (${code})`;
  return msg;
}

function parseHashMode() {
  const h = (window.location.hash || "").replace(/^#/, "");
  if (h === "signup" || h === "register") return "signup";
  return "login";
}

function setHashMode(mode) {
  window.location.hash = mode === "signup" ? "signup" : "login";
}

/**
 * Mount login / signup UI into `container`. Calls `onAuthenticated` when session exists (email flows).
 * OAuth returns via full page load; bootstrap in main.js re-checks session.
 * @param {HTMLElement} container
 * @param {{ onAuthenticated: () => void }} handlers
 */
export function mountAuthRoot(container, { onAuthenticated }) {
  if (!isSupabaseConfigured()) {
    container.innerHTML = "";
    container.appendChild(
      inlineError(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local (see .env.example)."
      )
    );
    return () => {};
  }

  const supabase = getSupabase();
  if (!supabase) {
    container.innerHTML = "";
    container.appendChild(inlineError("Could not initialize Supabase client."));
    return () => {};
  }

  const wrap = document.createElement("div");
  wrap.className = "auth-layout";
  container.replaceChildren(wrap);

  const card = document.createElement("div");
  card.className = "card auth-card";
  wrap.appendChild(card);

  const errHost = document.createElement("div");
  errHost.className = "auth-card__errors";
  card.appendChild(errHost);

  const title = document.createElement("h1");
  title.className = "heading-page auth-card__title";
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "field__hint auth-card__subtitle";
  card.appendChild(subtitle);

  const form = document.createElement("form");
  form.className = "auth-card__form";
  form.setAttribute("novalidate", "");
  card.appendChild(form);

  const emailField = document.createElement("div");
  emailField.className = "field";
  emailField.innerHTML = `
    <label class="field__label" for="auth-email">Email</label>
    <input class="input" id="auth-email" name="email" type="email" autocomplete="email" required />
  `;

  const passField = document.createElement("div");
  passField.className = "field";
  passField.innerHTML = `
    <label class="field__label" for="auth-password">Password</label>
    <input class="input" id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="6" />
  `;

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row auth-card__actions";

  const btnSubmit = document.createElement("button");
  btnSubmit.type = "submit";
  btnSubmit.className = "btn btn--primary";

  const btnGoogle = document.createElement("button");
  btnGoogle.type = "button";
  btnGoogle.className = "btn btn--google";
  btnGoogle.textContent = "Continue with Google";

  const switchRow = document.createElement("p");
  switchRow.className = "auth-card__switch field__hint";

  form.appendChild(emailField);
  form.appendChild(passField);
  btnRow.appendChild(btnSubmit);
  btnRow.appendChild(btnGoogle);
  form.appendChild(btnRow);
  card.appendChild(switchRow);

  function showError(msg) {
    errHost.replaceChildren();
    if (msg) errHost.appendChild(inlineError(msg));
  }

  /** @type {"login" | "signup"} */
  let mode = "login";

  function applyMode(nextMode) {
    mode = nextMode;
    const isSignup = mode === "signup";
    title.textContent = isSignup ? "Create account" : "Log in";
    subtitle.textContent = isSignup
      ? "Sign up with email or Google to use Eva."
      : "Welcome back. Sign in with email or Google.";
    btnSubmit.textContent = isSignup ? "Sign up" : "Log in";
    const em = /** @type {HTMLInputElement | null} */ (form.querySelector("#auth-email"));
    const pw = /** @type {HTMLInputElement | null} */ (form.querySelector("#auth-password"));
    if (em) em.autocomplete = isSignup ? "email" : "username";
    if (pw) pw.autocomplete = isSignup ? "new-password" : "current-password";

    switchRow.innerHTML = "";
    const t = document.createTextNode(isSignup ? "Already have an account? " : "Need an account? ");
    const a = document.createElement("button");
    a.type = "button";
    a.className = "btn btn--ghost auth-card__link";
    a.textContent = isSignup ? "Log in" : "Sign up";
    a.addEventListener("click", () => {
      const next = /** @type {"login" | "signup"} */ (isSignup ? "login" : "signup");
      setHashMode(next);
      applyMode(next);
    });
    switchRow.appendChild(t);
    switchRow.appendChild(a);
  }

  applyMode(parseHashMode());

  /**
   * Shown when signUp succeeds but no session yet (email confirmation required).
   * @param {string} email
   */
  function showSignupEmailConfirmation(email) {
    showError("");
    form.hidden = true;
    switchRow.hidden = true;
    errHost.replaceChildren();

    const panel = document.createElement("div");
    panel.className = "auth-confirm-panel";
    panel.setAttribute("role", "status");

    const h = document.createElement("h2");
    h.className = "heading-section auth-confirm-panel__title";
    h.textContent = "Check your email";

    const steps = document.createElement("ol");
    steps.className = "auth-confirm-panel__steps field__hint";
    const step1 = document.createElement("li");
    step1.textContent = `We sent a confirmation link to ${email || "your inbox"}.`;
    const step2 = document.createElement("li");
    step2.textContent = "Open the email and click the link to confirm your account.";
    const step3 = document.createElement("li");
    step3.textContent = "Come back here and use Log in with the same email and password.";
    steps.append(step1, step2, step3);

    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn--secondary";
    back.textContent = "Back to log in";
    back.addEventListener("click", () => {
      form.hidden = false;
      setHashMode("login");
      applyMode("login");
      showError("");
    });

    panel.append(h, steps, back);
    errHost.appendChild(panel);
  }

  const onHash = () => {
    applyMode(parseHashMode());
    showError("");
    form.hidden = false;
    switchRow.hidden = false;
    errHost.querySelector(".auth-confirm-panel")?.remove();
  };
  window.addEventListener("hashchange", onHash);

  btnGoogle.addEventListener("click", async () => {
    showError("");
    btnGoogle.disabled = true;
    try {
      const redirectTo = getAuthRedirectUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        if (import.meta.env.DEV) console.debug("[auth] OAuth", error);
        showError(formatAuthError(error));
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      btnGoogle.disabled = false;
    }
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showError("");
    const email = /** @type {HTMLInputElement | null} */ (form.querySelector("#auth-email"))?.value?.trim();
    const password = /** @type {HTMLInputElement | null} */ (form.querySelector("#auth-password"))?.value ?? "";
    if (!email || !password) {
      showError("Enter email and password.");
      return;
    }
    btnSubmit.disabled = true;
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        });
        if (error) {
          if (import.meta.env.DEV) console.debug("[auth] signUp", error);
          showError(formatAuthError(error));
          return;
        }
        if (data.session) {
          onAuthenticated();
          return;
        }
        showSignupEmailConfirmation(email);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (import.meta.env.DEV) console.debug("[auth] signInWithPassword", error);
          showError(formatAuthError(error));
          return;
        }
        if (data.session) onAuthenticated();
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
    } finally {
      btnSubmit.disabled = false;
    }
  });

  return () => window.removeEventListener("hashchange", onHash);
}
