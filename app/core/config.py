import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root or app/api/
base = Path(__file__).resolve().parent.parent
load_dotenv(base.parent / ".env")  # Eva/.env
load_dotenv(base / "api" / ".env")  # app/api/.env

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY_1")

# Supabase → Project Settings → API → JWT Secret (not the anon key).
# Must match exactly or get_current_user falls back to test_user and rows will not match real users.
SUPABASE_JWT_SECRET = (os.getenv("SUPABASE_JWT_SECRET") or "").strip()

# Backend-only: Project Settings → API → Project URL and service_role key (never expose to Vite).
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
SUPABASE_SERVICE_ROLE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()

# Set to 1 / true to print auth + memory traces (user_id, keys) — disable in production.
EVA_DEBUG_AUTH = os.getenv("EVA_DEBUG_AUTH", "").strip().lower() in ("1", "true", "yes")