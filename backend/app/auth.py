"""Authentication utilities for verifying Supabase JWTs and role-based access control.

Supabase Auth handles user registration, login, and token issuance.
This module verifies the JWTs and maps users to their admin_users profile
for role-based authorization.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import asyncpg

from app.config import get_settings
from app.database import get_db

security = HTTPBearer()


def decode_token(token: str) -> dict:
    """Decode and verify a Supabase-issued JWT."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: asyncpg.Pool = Depends(get_db),
) -> dict:
    """Extract user identity from Supabase JWT and verify admin_users profile.

    Returns {"id": uuid_str, "role": str, "full_name": str, "is_active": bool}.
    Raises 401 if token is invalid or user is not an active admin.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Look up admin profile — this ensures the user is an authorized admin
    row = await db.fetchrow(
        "SELECT id, full_name, role, is_active FROM admin_users WHERE id = $1",
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
