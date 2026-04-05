# Dashboard data contract

**Supabase:** Run [`supabase/eva_user_state.sql`](../supabase/eva_user_state.sql) for JSONB memory; run [`supabase/eva_onboarding.sql`](../supabase/eva_onboarding.sql) for typed onboarding columns. After onboarding routes save memory, the API upserts `eva_onboarding` when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.

## Real API (default)

| Region | Source | Notes |
|--------|--------|--------|
| Greeting | `GET /onboarding/status` → `profile.display_name` | Falls back to `User` if empty |
| Form inputs (age, weight, …) | Same `profile` object | Synced after load and after generate |
| Generate plan | `POST /generate-full-plan` | Body: `UserInput` (same as before). Response: `{ "diet": <diet payload>, "workout": <workout payload> }`. Diet-only: `POST /generate-diet` (same body, diet fields only). |
| Plan + insights UI | Response JSON | Rendered in center and right columns |
| Feedback | `POST /feedback` | Requires last successful `plan` from generate/simulate |

## Mock mode

Set `VITE_USE_MOCK_DASHBOARD=true` in `.env` (see `frontend/.env.example`). When enabled, the greeting strip shows a **Sample** label and mock metric placeholders from `frontend/js/dashboard/mockDashboard.js`. **Plan generation still uses the real API** unless you extend the flag to short-circuit fetches.

## Empty / error

- Profile load failure: **error + Retry** (no silent fallback to mock numbers).
- No plan yet: empty state copy in the plan column.
