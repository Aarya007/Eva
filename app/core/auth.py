import logging
from typing import Optional

from jose import JWTError, jwt
from fastapi import HTTPException, Request

from app.core.config import EVA_DEBUG_AUTH, SUPABASE_JWT_SECRET

logger = logging.getLogger(__name__)


def _debug(msg: str) -> None:
    if EVA_DEBUG_AUTH:
        print(f"[eva debug] {msg}", flush=True)


def _auth_debug_header(auth_header: Optional[str]) -> None:
    if not EVA_DEBUG_AUTH:
        return
    present = bool(auth_header)
    bearer = auth_header.startswith("Bearer ") if auth_header else False
    print(
        f"[eva debug] AUTH_HEADER present={present} starts_with_Bearer={bearer}",
        flush=True,
    )


def _auth_debug_token(token: str) -> None:
    if not EVA_DEBUG_AUTH:
        return
    tail = token[-4:] if len(token) >= 4 else "****"
    print(f"[eva debug] TOKEN len={len(token)} ...{tail}", flush=True)


def get_current_user(request: Request) -> str:
    path = request.url.path
    auth_header = request.headers.get("Authorization")
    _auth_debug_header(auth_header)

    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("auth: missing or non-Bearer Authorization header path=%s", path)
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not SUPABASE_JWT_SECRET:
        logger.error(
            "auth: SUPABASE_JWT_SECRET is not set — set JWT Secret from "
            "Supabase Dashboard → Project Settings → API"
        )
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured on the server",
        )

    token = auth_header.split(" ", 1)[1].strip()
    _auth_debug_token(token)
    if not token:
        logger.warning("auth: empty Bearer token path=%s", path)
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        print(f"[eva auth] JWT decode failed: {e!r}", flush=True)
        logger.warning("auth: JWT decode failed path=%s error=%s", path, e)
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        ) from e
    except Exception as e:
        print(f"[eva auth] JWT decode failed: {e!r}", flush=True)
        logger.exception("auth: unexpected error during JWT decode path=%s", path)
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        ) from e

    sub = payload.get("sub")
    if EVA_DEBUG_AUTH:
        print(f"[eva debug] DECODED_USER sub={sub!r}", flush=True)
    if isinstance(sub, str) and sub.strip():
        uid = sub.strip()
        _debug(f"auth: OK user_id={uid} path={path}")
        return uid

    logger.warning("auth: JWT decoded but sub missing or invalid path=%s", path)
    raise HTTPException(status_code=401, detail="Invalid token payload")
