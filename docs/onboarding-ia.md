# Onboarding information architecture (7 steps)

**Auth:** The API currently uses a single in-memory `default_user` with no Bearer token. `POST /onboard` and `POST /onboarding/step` do not require authentication until auth is added.

## Step index

| Step | Domain | Purpose |
|------|--------|---------|
| 1 | Basic | Demographics |
| 2 | Medical | Conditions and medications (or explicit none) |
| 3 | Lifestyle | Sleep, stress, work pattern |
| 4 | Eating | Diet pattern and food preferences |
| 5 | Goals | Target outcome and activity level |
| 6 | Measurements | Optional body metrics or N/A |
| 7 | Personalization | Fitness context, timezone, display name |

## Field inventory

### Step 1 — Basic

| API key | Type | Required (final submit) | Validation |
|---------|------|---------------------------|------------|
| `age` | int | yes | 1–120 |
| `weight` | float | yes | > 0 |
| `height` | float | yes | > 0 |
| `gender` | string | yes | `male` \| `female` |

### Step 2 — Medical

| API key | Type | Required | Validation |
|---------|------|----------|------------|
| `medical_none_ack` | bool | yes | If `false`, at least one of `medical_conditions` or `medications` must be non-empty |
| `medical_conditions` | string[] | no | Trimmed tokens |
| `medications` | string[] | no | Trimmed tokens |

### Step 3 — Lifestyle

| API key | Type | Required | Validation |
|---------|------|----------|------------|
| `sleep_hours` | float | yes | e.g. 4–12 |
| `stress_level` | string | yes | `low` \| `medium` \| `high` |
| `work_schedule` | string | yes | `sedentary` \| `mixed` \| `active` |

### Step 4 — Eating

| API key | Type | Required | Validation |
|---------|------|----------|------------|
| `diet_type` | string | yes | `veg` \| `non_veg` \| `vegan` |
| `allergies` | string[] | no | — |
| `preferred_foods` | string[] | no | — |
| `disliked_foods` | string[] | no | — |

### Step 5 — Goals

| API key | Type | Required | Validation |
|---------|------|----------|------------|
| `goal` | string | yes | `fat_loss` \| `maintenance` \| `muscle_gain` |
| `activity_level` | string | yes | `sedentary` \| `moderate` \| `active` |
| `target_weight_kg` | float | no | > 0 if set |
| `goal_timeline_weeks` | int | no | ≥ 1 if set |

### Step 6 — Measurements

| API key | Type | Required | Validation |
|---------|------|----------|------------|
| `measurements_na` | bool | yes* | If `false`, at least one of `waist_cm`, `body_fat_pct` should be set (enforced on full submit) |
| `waist_cm` | float | no | > 0 if set |
| `body_fat_pct` | float | no | 0–100 if set |

### Step 7 — Personalization (conditional fitness)

First choose **`fitness_type`**: `home` \| `gym` \| `athlete`.

| Branch | Required fields |
|--------|-------------------|
| **home** | `training_intensity` (`low` \| `medium` \| `high`), `timezone` |
| **gym** | `gym_level` (`beginner` \| `intermediate` \| `advanced`), `training_intensity`, `timezone` |
| **athlete** | `sport_type` (free text), `training_intensity`, `training_environment` (`gym` \| `outside` \| `both`), `timezone` |

| API key | Type | Notes |
|---------|------|--------|
| `fitness_type` | string | `home` \| `gym` \| `athlete` |
| `gym_level` | string | Gym branch only |
| `sport_type` | string | Athlete branch only |
| `training_intensity` | string | All three branches |
| `training_environment` | string | Athlete only: where sport training happens |
| `display_name` | string | no |
| `timezone` | string | Required for all branches (IANA or free text) |

Unused fields for a branch are cleared client-side and sent as null on full submit.

## Endpoints

- `POST /onboarding/step` — partial update; body is `OnboardingStepInput` (all fields optional).
- `POST /onboard` — full profile; body is `OnboardingInput` (required fields per validators above); sets `onboarding_complete` in memory.
- `GET /onboarding/status` — `profile`, `completion_percent`, `filled`, `onboarding_complete`.

## Payload mapping

See [frontend/js/onboarding/mapPayload.js](../frontend/js/onboarding/mapPayload.js): flat wizard state → API JSON (comma-separated lists parsed where needed).
