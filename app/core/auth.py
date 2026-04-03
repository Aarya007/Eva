import logging

from jose import jwt
from fastapi import Request

from app.core.config import EVA_DEBUG_AUTH, SUPABASE_JWT_SECRET

logger = logging.getLogger(__name__)

_DEV_FALLBACK = "test_user"

_warned_missing_secret = False


def _debug(msg: str) -> None:
    if EVA_DEBUG_AUTH:
        print(f"[eva debug] {msg}", flush=True)


def get_current_user(request: Request) -> str:
    global _warned_missing_secret
    path = request.url.path
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        _debug(f"auth: no Bearer header path={path} → user_id={_DEV_FALLBACK}")
        return _DEV_FALLBACK

    if not SUPABASE_JWT_SECRET:
        if not _warned_missing_secret:
            logger.warning(
                "auth: SUPABASE_JWT_SECRET is not set — all requests use %r; "
                "set JWT Secret from Supabase Dashboard → Settings → API",
                _DEV_FALLBACK,
            )
            _warned_missing_secret = True
        _debug(f"auth: missing SUPABASE_JWT_SECRET path={path} → user_id={_DEV_FALLBACK}")
        return _DEV_FALLBACK

    try:
        token = auth_header.split(" ", 1)[1].strip()
        if not token:
            logger.warning("auth: Authorization Bearer token is empty path=%s", path)
            _debug(f"auth: empty token path={path} → user_id={_DEV_FALLBACK}")
            return _DEV_FALLBACK
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        sub = payload.get("sub")
        if isinstance(sub, str) and sub.strip():
            uid = sub.strip()
            _debug(f"auth: OK user_id={uid} path={path}")
            return uid
        logger.warning("auth: JWT decoded but sub missing or invalid path=%s", path)
    except Exception as e:
        logger.warning(
            "auth: JWT decode failed path=%s error=%s",
            path,
            type(e).__name__,
        )
        _debug(f"auth: decode failed path={path} err={type(e).__name__} → user_id={_DEV_FALLBACK}")

    _debug(f"auth: fallback path={path} → user_id={_DEV_FALLBACK}")
    return _DEV_FALLBACK
