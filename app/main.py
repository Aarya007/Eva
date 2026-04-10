import logging
import sys
from pathlib import Path

# Project root (parent of `app/`) so `import app...` works when running `python main.py` from app/
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from dotenv import load_dotenv

# Load .env before any app imports
load_dotenv(_REPO_ROOT / "app" / ".env")
load_dotenv(_REPO_ROOT / "app" / "api" / ".env", override=True)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router
from app.core.auth import get_current_user
from app.services.supabase_store import SupabasePersistError, is_persistence_enabled

logger = logging.getLogger(__name__)

_PERSIST_LOG_BODY_MAX = 2000


def _truncate_for_log(s: str, max_len: int = _PERSIST_LOG_BODY_MAX) -> str:
    if len(s) <= max_len:
        return s
    return f"{s[:max_len]}... [truncated]"


app = FastAPI()

if not is_persistence_enabled():
    logger.warning(
        "Supabase persistence is disabled: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
        "(e.g. in app/api/.env). Profile data is kept only in process memory until restart."
    )


@app.exception_handler(SupabasePersistError)
async def supabase_persist_handler(request: Request, exc: SupabasePersistError):
    body = getattr(exc, "response_text", "") or ""
    logger.error(
        "Supabase persist failed path=%s detail=%s response_text=%s",
        request.url.path,
        str(exc),
        _truncate_for_log(body),
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Failed to persist profile data"},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "Eva AI Backend Running",
        "persistence_enabled": is_persistence_enabled(),
    }


@app.get("/health")
def health():
    """Liveness and whether Supabase env is configured (no secrets)."""
    return {
        "status": "ok",
        "persistence_enabled": is_persistence_enabled(),
    }


@app.get(
    "/test-auth",
    tags=["dev"],
    summary="Decode JWT and return sub (development only)",
    include_in_schema=False,
)
def test_auth(request: Request):
    """Development-only: verify Bearer token resolves to user_id. Do not rely on this in production."""
    user_id = get_current_user(request)
    return {"user_id": user_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)