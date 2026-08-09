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

    row = await db.fetchrow(
        """
        SELECT t.id, t.full_name, t.username, t.contact, t.address, t.role,
               ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS assigned_class
        FROM teachers t
        LEFT JOIN classes c ON c.teacher_id = t.id AND c.academic_year_id = $2
        WHERE t.id = $1
        """,
        user["id"], year_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")

    return UserProfile(
        id=str(row["id"]),
        full_name=row["full_name"],
        username=row["username"],
        contact=row["contact"],
        address=row["address"],
        role=row["role"],
        assigned_class=row["assigned_class"],
    )


@router.put("/profile", response_model=UserProfile)
async def update_profile(
    body: ProfileUpdateRequest,
    user: dict = Depends(get_current_user),
    db: asyncpg.Pool = Depends(get_db),
):
    """Update the current user's profile. Password changes go through Supabase Auth directly."""
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
        existing = await db.fetchval("SELECT id FROM teachers WHERE username = $1 AND id != $2", body.username, user["id"])
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        updates.append(f"username = ${idx}")
        values.append(body.username)
        idx += 1

    # Note: password changes are now handled by supabase.auth.updateUser()
    # on the frontend. We no longer accept password updates via this endpoint.

    if not updates:
        # No changes — return current profile
        from app.cache import get_current_year_id
        year_id = await get_current_year_id(db)
        row = await db.fetchrow(
            """SELECT t.id, t.full_name, t.username, t.contact, t.address, t.role,
                      ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS assigned_class
               FROM teachers t
               LEFT JOIN classes c ON c.teacher_id = t.id AND c.academic_year_id = $2
               WHERE t.id = $1""",
            user["id"], year_id,
        )
        return UserProfile(
            id=str(row["id"]), full_name=row["full_name"], username=row["username"],
            contact=row["contact"], address=row["address"], role=row["role"],
            assigned_class=row["assigned_class"],
        )

    values.append(user["id"])
    query = f"UPDATE teachers SET {', '.join(updates)} WHERE id = ${idx} RETURNING id, full_name, username, contact, address, role"

    row = await db.fetchrow(query, *values)

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "PROFILE_UPDATED",
        {"updates": [k.split(" =")[0] for k in updates]},
        user["id"]
    )

    # Fetch assigned_class separately
    from app.cache import get_current_year_id
    year_id = await get_current_year_id(db)
    assigned_class = await db.fetchval(
        "SELECT ('Grade ' || grade || ' ' || medium::TEXT || ' ' || gender_type::TEXT) FROM classes WHERE teacher_id = $1 AND academic_year_id = $2",
        row["id"], year_id,
    )

    return UserProfile(
        id=str(row["id"]),
        full_name=row["full_name"],
        username=row["username"],
        contact=row["contact"],
        address=row["address"],
        role=row["role"],
        assigned_class=assigned_class,
    )
