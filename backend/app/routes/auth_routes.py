"""Auth routes — profile management only.

Login and token refresh are now handled by Supabase Auth directly.
These routes handle:
  - GET /me — fetch the current user's profile
  - PUT /profile — update profile details (name, contact, address, username)
"""

from fastapi import APIRouter, Depends, HTTPException
import asyncpg

from app.database import get_db
from app.auth import get_current_user
from app.models import UserProfile, ProfileUpdateRequest

router = APIRouter()


@router.get("/me", response_model=UserProfile)
async def get_me(
    user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Fetch the full user profile using the Supabase user UUID."""
    from app.cache import get_current_year_id
    year_id = await get_current_year_id(db)

    # Resolve teacher_id from admin_users
    admin_row = await db.fetchrow(
        "SELECT teacher_id, full_name, role FROM admin_users WHERE id = $1",
        user["id"]
    )
    if not admin_row:
        raise HTTPException(status_code=404, detail="User profile not found")

    teacher_id = admin_row["teacher_id"]

    if teacher_id:
        row = await db.fetchrow(
            """
            SELECT t.id, t.full_name, t.username, t.contact, t.address, t.role,
                   ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS assigned_class
            FROM teachers t
            LEFT JOIN classes c ON c.teacher_id = t.id AND c.academic_year_id = $2
            WHERE t.id = $1
            """,
            teacher_id, year_id,
        )
        if row:
            return UserProfile(
                id=str(row["id"]),
                full_name=row["full_name"],
                username=row["username"],
                contact=row["contact"],
                address=row["address"],
                role=row["role"],
                assigned_class=row["assigned_class"],
            )

    # Fallback for Super Admins / Admins without a linked teacher profile
    return UserProfile(
        id=user["id"],
        full_name=admin_row["full_name"],
        username="",
        contact="",
        address="",
        role=admin_row["role"],
        assigned_class=None,
    )


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    body: ProfileUpdateRequest,
    user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Update the current user's profile. Password changes go through Supabase Auth directly."""
    admin_row = await db.fetchrow(
        "SELECT teacher_id FROM admin_users WHERE id = $1",
        user["id"]
    )
    if not admin_row:
        raise HTTPException(status_code=404, detail="User not found")
        
    teacher_id = admin_row["teacher_id"]

    # 1. Update admin_users if full_name is provided
    if body.full_name is not None:
        await db.execute(
            "UPDATE admin_users SET full_name = $1 WHERE id = $2",
            body.full_name, user["id"]
        )

    # 2. Update teachers table if the user has a linked teacher profile
    if teacher_id:
        updates = []
        values = []
        idx = 1

        if body.full_name is not None:
            updates.append(f"full_name = ${idx}")
            values.append(body.full_name)
            idx += 1
        if body.contact is not None:
            updates.append(f"contact = ${idx}")
            values.append(body.contact)
            idx += 1
        if body.address is not None:
            updates.append(f"address = ${idx}")
            values.append(body.address)
            idx += 1
        if body.username is not None:
            # Check uniqueness
            existing = await db.fetchval("SELECT id FROM teachers WHERE username = $1 AND id != $2", body.username, teacher_id)
            if existing:
                raise HTTPException(status_code=400, detail="Username already taken")
            updates.append(f"username = ${idx}")
            values.append(body.username)
            idx += 1

        if updates:
            values.append(teacher_id)
            await db.execute(f"UPDATE teachers SET {', '.join(updates)} WHERE id = ${idx}", *values)

    # Audit logging
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "PROFILE_UPDATED",
        {"updates": [k for k, v in body.model_dump().items() if v is not None]},
        user["id"]
    )

    # Return the updated profile via get_me
    return await get_me(user, db)
