# Dashboard data contract

## Real API (default)

| Region | Source | Notes |
|--------|--------|--------|
| Greeting | `GET /onboarding/status` → `profile.display_name` | Falls back to `User` if empty |
| Form inputs (age, weight, …) | Same `profile` object | Synced after load and after generate |
| Generate plan | `POST /generate-diet` | Body: `UserInput` (age, weight, height, gender, activity_level, goal, diet_type, optional lists, `skipped_meals`, `actual_meals` for simulate) |
| Plan + insights UI | Response JSON | Rendered in center and right columns |
| Feedback | `POST /feedback` | Requires last successful `plan` from generate/simulate |

## Mock mode

Set `VITE_USE_MOCK_DASHBOARD=true` in `.env` (see `frontend/.env.example`). When enabled, the greeting strip shows a **Sample** label and mock metric placeholders from `frontend/js/dashboard/mockDashboard.js`. **Plan generation still uses the real API** unless you extend the flag to short-circuit fetches.

## Empty / error

- Profile load failure: **error + Retry** (no silent fallback to mock numbers).
- No plan yet: empty state copy in the plan column.
