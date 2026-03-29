/** Parse comma-separated string into trimmed list or undefined */
export function parseCommaList(raw) {
  if (raw == null || String(raw).trim() === "") return undefined;
  const parts = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function num(v, fallback = undefined) {
  if (v === "" || v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v, fallback = undefined) {
  if (v === "" || v == null) return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Flat wizard state → POST /onboard body (matches OnboardingInput)
 * @param {Record<string, unknown>} state
 */
export function mapPayloadFull(state) {
  const allergies = parseCommaList(state.allergies_text);
  const preferred_foods = parseCommaList(state.preferred_foods_text);
  const disliked_foods = parseCommaList(state.disliked_foods_text);
  const medical_conditions = parseCommaList(state.medical_conditions_text);
  const medications = parseCommaList(state.medications_text);

  const body = {
    age: int(state.age),
    weight: num(state.weight),
    height: num(state.height),
    gender: String(state.gender || "").trim(),
    medical_none_ack: Boolean(state.medical_none_ack),
    medical_conditions: medical_conditions ?? null,
    medications: medications ?? null,
    sleep_hours: num(state.sleep_hours, 0),
    stress_level: String(state.stress_level || "").trim(),
    work_schedule: String(state.work_schedule || "").trim(),
    diet_type: String(state.diet_type || "").trim() || null,
    allergies: allergies ?? null,
    preferred_foods: preferred_foods ?? null,
    disliked_foods: disliked_foods ?? null,
    goal: String(state.goal || "").trim(),
    activity_level: String(state.activity_level || "").trim(),
    target_weight_kg: state.target_weight_kg === "" || state.target_weight_kg == null
      ? null
      : num(state.target_weight_kg),
    goal_timeline_weeks:
      state.goal_timeline_weeks === "" || state.goal_timeline_weeks == null
        ? null
        : int(state.goal_timeline_weeks),
    measurements_na: Boolean(state.measurements_na),
    waist_cm: state.waist_cm === "" || state.waist_cm == null ? null : num(state.waist_cm),
    body_fat_pct:
      state.body_fat_pct === "" || state.body_fat_pct == null ? null : num(state.body_fat_pct),
    fitness_type: String(state.fitness_type || "").trim() || null,
    gym_level: state.gym_level ? String(state.gym_level).trim() : null,
    sport_type: state.sport_type ? String(state.sport_type).trim() : null,
    training_intensity: state.training_intensity
      ? String(state.training_intensity).trim()
      : null,
    training_environment: state.training_environment
      ? String(state.training_environment).trim()
      : null,
    display_name: state.display_name ? String(state.display_name).trim() : null,
    timezone: state.timezone ? String(state.timezone).trim() : null,
  };

  const ft = body.fitness_type;
  if (ft === "home") {
    body.gym_level = null;
    body.sport_type = null;
    body.training_environment = null;
  } else if (ft === "gym") {
    body.sport_type = null;
    body.training_environment = null;
  } else if (ft === "athlete") {
    body.gym_level = null;
  }

  if (body.medical_none_ack) {
    body.medical_conditions = null;
    body.medications = null;
  }

  if (body.measurements_na) {
    body.waist_cm = null;
    body.body_fat_pct = null;
  }

  return body;
}

/** Partial body for POST /onboarding/step — only defined keys */
export function mapPayloadStep(stepIndex, state) {
  const full = mapPayloadFull(state);
  const keysByStep = [
    ["age", "weight", "height", "gender"],
    ["medical_none_ack", "medical_conditions", "medications"],
    ["sleep_hours", "stress_level", "work_schedule"],
    ["diet_type", "allergies", "preferred_foods", "disliked_foods"],
    ["goal", "activity_level", "target_weight_kg", "goal_timeline_weeks"],
    ["measurements_na", "waist_cm", "body_fat_pct"],
    [
      "fitness_type",
      "gym_level",
      "sport_type",
      "training_intensity",
      "training_environment",
      "display_name",
      "timezone",
    ],
  ];
  const keys = keysByStep[stepIndex] || [];
  const out = {};
  for (const k of keys) {
    if (full[k] !== undefined) out[k] = full[k];
  }
  return out;
}

export function initialState() {
  return {
    age: "28",
    weight: "70",
    height: "175",
    gender: "male",
    medical_none_ack: false,
    medical_conditions_text: "",
    medications_text: "",
    sleep_hours: "7",
    stress_level: "medium",
    work_schedule: "mixed",
    diet_type: "non_veg",
    allergies_text: "",
    preferred_foods_text: "",
    disliked_foods_text: "",
    goal: "maintenance",
    activity_level: "moderate",
    target_weight_kg: "",
    goal_timeline_weeks: "",
    measurements_na: false,
    waist_cm: "",
    body_fat_pct: "",
    fitness_type: "",
    gym_level: "",
    sport_type: "",
    training_intensity: "",
    training_environment: "",
    display_name: "",
    timezone: "",
  };
}

/** Clear fields not used by the selected fitness branch (call before setting fitness_type). */
export function applyFitnessTypeChange(state, newType) {
  const t = String(newType || "").trim();
  if (t === "home") {
    state.gym_level = "";
    state.sport_type = "";
    state.training_environment = "";
  } else if (t === "gym") {
    state.sport_type = "";
    state.training_environment = "";
  } else if (t === "athlete") {
    state.gym_level = "";
  }
  state.fitness_type = t;
}

/** Apply profile from GET /onboarding/status into state */
export function applyProfileToState(state, profile) {
  if (!profile) return;
  const p = profile;
  if (p.age != null) state.age = String(p.age);
  if (p.weight != null) state.weight = String(p.weight);
  if (p.height != null) state.height = String(p.height);
  if (p.gender) state.gender = p.gender;
  if (typeof p.medical_none_ack === "boolean") state.medical_none_ack = p.medical_none_ack;
  if (Array.isArray(p.medical_conditions))
    state.medical_conditions_text = p.medical_conditions.join(", ");
  if (Array.isArray(p.medications)) state.medications_text = p.medications.join(", ");
  if (p.sleep_hours != null) state.sleep_hours = String(p.sleep_hours);
  if (p.stress_level) state.stress_level = p.stress_level;
  if (p.work_schedule) state.work_schedule = p.work_schedule;
  if (p.diet_type) state.diet_type = p.diet_type;
  if (Array.isArray(p.allergies)) state.allergies_text = p.allergies.join(", ");
  if (Array.isArray(p.preferred_foods))
    state.preferred_foods_text = p.preferred_foods.join(", ");
  if (Array.isArray(p.disliked_foods))
    state.disliked_foods_text = p.disliked_foods.join(", ");
  if (p.goal) state.goal = p.goal;
  if (p.activity_level) state.activity_level = p.activity_level;
  if (p.target_weight_kg != null) state.target_weight_kg = String(p.target_weight_kg);
  if (p.goal_timeline_weeks != null)
    state.goal_timeline_weeks = String(p.goal_timeline_weeks);
  if (typeof p.measurements_na === "boolean") state.measurements_na = p.measurements_na;
  if (p.waist_cm != null) state.waist_cm = String(p.waist_cm);
  if (p.body_fat_pct != null) state.body_fat_pct = String(p.body_fat_pct);
  if (p.fitness_type) {
    const ft = String(p.fitness_type).trim();
    if (["home", "gym", "athlete"].includes(ft)) state.fitness_type = ft;
    else if (ft === "none") state.fitness_type = "";
    else state.fitness_type = ft;
  }
  if (p.gym_level) state.gym_level = p.gym_level;
  if (p.sport_type) state.sport_type = p.sport_type;
  if (p.training_intensity) state.training_intensity = p.training_intensity;
  if (p.training_environment) state.training_environment = p.training_environment;
  if (p.display_name) state.display_name = p.display_name;
  if (p.timezone) state.timezone = p.timezone;
}
