import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from app/ dir or app/api/ (api .env wins for overlapping keys)
base = Path(__file__).resolve().parent.parent
load_dotenv(base / ".env")  # app/.env
load_dotenv(base / "api" / ".env", override=True)  # app/api/.env

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY_1")

# Supabase → Project Settings → API → JWT Secret (not the anon key).
# Must match Supabase JWT secret or token verification fails.
SUPABASE_JWT_SECRET = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()

# Backend-only: Project Settings → API → Project URL and service_role key (never expose to Vite).
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
SUPABASE_SERVICE_ROLE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()

# Set to 1 / true to print auth + memory traces (user_id, keys) — disable in production.
EVA_DEBUG_AUTH = os.getenv("EVA_DEBUG_AUTH", "").strip().lower() in ("1", "true", "yes")

# Set to 1 / true to print Supabase REST URL, payload summary, status, response body (disable in production).
EVA_DEBUG_SUPABASE = os.getenv("EVA_DEBUG_SUPABASE", "").strip().lower() in ("1", "true", "yes")