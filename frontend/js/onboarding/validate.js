import { parseCommaList } from "./mapPayload.js";

function err(errors, key, msg) {
  errors[key] = msg;
}

/** @param {Record<string, unknown>} state */
export function validateStep(stepIndex, state) {
  const errors = {};
  switch (stepIndex) {
    case 0: {
      const age = parseInt(String(state.age), 10);
      if (!Number.isFinite(age) || age < 1 || age > 120) err(errors, "age", "Age must be 1–120");
      const w = parseFloat(String(state.weight));
      if (!Number.isFinite(w) || w <= 0) err(errors, "weight", "Weight must be positive");
      const h = parseFloat(String(state.height));
      if (!Number.isFinite(h) || h <= 0) err(errors, "height", "Height must be positive");
      if (!String(state.gender || "").trim()) err(errors, "gender", "Select gender");
      break;
    }
    case 1: {
      if (state.medical_none_ack) break;
      const c = parseCommaList(state.medical_conditions_text);
      const m = parseCommaList(state.medications_text);
      if ((!c || c.length === 0) && (!m || m.length === 0)) {
        err(errors, "medical", "Confirm none or add conditions/medications");
      }
      break;
    }
    case 2: {
      const sh = parseFloat(String(state.sleep_hours));
      if (!Number.isFinite(sh) || sh < 0 || sh > 24)
        err(errors, "sleep_hours", "Sleep hours must be 0–24");
      if (!String(state.stress_level || "").trim())
        err(errors, "stress_level", "Select stress level");
      if (!String(state.work_schedule || "").trim())
        err(errors, "work_schedule", "Select work schedule");
      break;
    }
    case 3: {
      if (!String(state.diet_type || "").trim()) err(errors, "diet_type", "Select diet type");
      break;
    }
    case 4: {
      if (!String(state.goal || "").trim()) err(errors, "goal", "Select goal");
      if (!String(state.activity_level || "").trim())
        err(errors, "activity_level", "Select activity level");
      break;
    }
    case 5: {
      if (state.measurements_na) break;
      const wc = state.waist_cm === "" ? null : parseFloat(String(state.waist_cm));
      const bf = state.body_fat_pct === "" ? null : parseFloat(String(state.body_fat_pct));
      if (
        (wc == null || !Number.isFinite(wc)) &&
        (bf == null || !Number.isFinite(bf))
      ) {
        err(errors, "measurements", "Enter waist or body fat %, or mark not applicable");
      }
      break;
    }
    case 6: {
      const ft = String(state.fitness_type || "").trim();
      if (!["home", "gym", "athlete"].includes(ft)) {
        err(errors, "fitness_type", "Select where you train");
        break;
      }
      const ti = String(state.training_intensity || "").trim();
      const tz = String(state.timezone || "").trim();
      if (ft === "home") {
        if (!ti) err(errors, "training_intensity", "Select training intensity");
        if (!tz) err(errors, "timezone", "Enter timezone");
        break;
      }
      if (ft === "gym") {
        const gl = String(state.gym_level || "").trim();
        if (!gl) err(errors, "gym_level", "Select gym level");
        if (!ti) err(errors, "training_intensity", "Select training intensity");
        if (!tz) err(errors, "timezone", "Enter timezone");
        break;
      }
      if (ft === "athlete") {
        const sp = String(state.sport_type || "").trim();
        const env = String(state.training_environment || "").trim();
        if (!sp) err(errors, "sport_type", "Enter sport or activity");
        if (!ti) err(errors, "training_intensity", "Select training intensity");
        if (!["gym", "outside", "both"].includes(env)) {
          err(errors, "training_environment", "Select where sport training happens");
        }
        if (!tz) err(errors, "timezone", "Enter timezone");
      }
      break;
    }
    default:
      break;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Full schema validation before POST /onboard (mirrors backend) */
export function validateFull(state) {
  const errors = {};
  for (let i = 0; i < 7; i++) {
    const { errors: e } = validateStep(i, state);
    Object.assign(errors, e);
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
