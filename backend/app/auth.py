"""Authentication utilities for verifying Supabase JWTs and role-based access control.

Supabase Auth handles user registration, login, and token issuance.
This module verifies the JWTs and maps users to their admin_users profile
for role-based authorization.

Verification strategy:
  1. Try local HS256 verification with the legacy JWT secret (fast, no network).
  2. If that fails (e.g. Supabase migrated to ES256 signing keys), call
     Supabase's /auth/v1/user endpoint to verify the token remotely.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import httpx
import asyncpg

from app.config import get_settings
from app.database import get_db

security = HTTPBearer()


def _try_local_decode(token: str) -> dict | None:
    """Try to verify a JWT locally using the legacy HS256 secret.
    Returns the payload dict on success, or None if verification fails.
    """
    settings = get_settings()
    if not settings.supabase_jwt_secret or settings.supabase_jwt_secret == "change-me-to-your-supabase-jwt-secret":
        return None
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        return None


async def _verify_via_supabase_api(token: str) -> dict:
    """Verify a token by calling Supabase's Auth API.
    Works regardless of the signing algorithm (HS256, ES256, etc.).
    Returns a dict with at least {"sub": "<user-uuid>"}.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed and remote verification is not configured.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    data = resp.json()
    user_id = data.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"sub": user_id}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    """Extract user identity from Supabase JWT and verify admin_users profile.

    Returns {"id": uuid_str, "role": str, "full_name": str, "is_active": bool}.
    Raises 401 if token is invalid or user is not an active admin.
    """
    token = credentials.credentials

    # Strategy 1: Try fast local HS256 verification
    payload = _try_local_decode(token)

    # Strategy 2: Fall back to remote Supabase API verification
    if payload is None:
        payload = await _verify_via_supabase_api(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Look up admin profile — this ensures the user is an authorized admin
    row = await db.fetchrow(
        "SELECT id, full_name, role, is_active, teacher_id FROM admin_users WHERE id = $1",
        user_id,
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this system.",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated.",
        )

    return {
        "id": str(row["id"]),
        "role": row["role"],
        "full_name": row["full_name"],
        "email": payload.get("email", ""),
        "teacher_id": str(row["teacher_id"]) if row["teacher_id"] else None,
    }


def require_role(*roles: str):
    """Dependency factory that requires the user to have one of the specified roles."""
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(roles)}",
            )
        return user
    return checker


# Convenience dependencies
require_admin = require_role("Principal", "Admin", "Super Admin")
require_principal = require_role("Principal")
require_super_admin = require_role("Super Admin")
require_any_auth = require_role("Principal", "Admin", "Teacher", "Super Admin")
