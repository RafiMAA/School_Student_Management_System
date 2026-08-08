from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import asyncpg

from app.database import get_db
from app.auth import get_current_user, require_admin
from app.models import TeacherCreate, TeacherUpdate, TeacherResponse, PasswordReset
from app.cache import cache_invalidate, TOTAL_TEACHERS

router = APIRouter()


def _row_to_response(r, assigned_class=None, assigned_class_ids=None) -> TeacherResponse:
    return TeacherResponse(
        id=str(r["id"]), full_name=r["full_name"], contact=r["contact"], address=r.get("address"),
        email=r["username"], role=r["role"],
        assigned_class=assigned_class,
        assigned_class_ids=assigned_class_ids,
        created_at=r["created_at"],
    )


@router.get("", response_model=list[TeacherResponse])
async def list_teachers(
    search: Optional[str] = None,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    from app.cache import get_current_year_id
    year_id = await get_current_year_id(db)

    query = """
        SELECT t.id, t.full_name, t.contact, t.address, t.username, t.role, t.created_at,
               STRING_AGG('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT, ', ' ORDER BY c.grade, c.medium, c.gender_type) AS assigned_class_name,
               ARRAY_AGG(c.id::TEXT) FILTER (WHERE c.id IS NOT NULL) AS assigned_class_ids
        FROM teachers t
        LEFT JOIN classes c ON c.teacher_id = t.id
            AND c.academic_year_id = $1
        WHERE 1=1
    """
    params = [year_id]
    idx = 2
    if search:
        query += f" AND t.full_name ILIKE ${idx}"
        params.append(f"%{search}%"); idx += 1
        
    query += " GROUP BY t.id"
    query += " ORDER BY t.full_name"
    rows = await db.fetch(query, *params)

    return [_row_to_response(r, r.get("assigned_class_name"), r.get("assigned_class_ids")) for r in rows]
@router.get("/{teacher_id}", response_model=TeacherResponse)
async def get_teacher(
    teacher_id: str,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    from app.cache import get_current_year_id
    year_id = await get_current_year_id(db)

    query = """
        SELECT t.id, t.full_name, t.contact, t.address, t.username, t.role, t.created_at,
               STRING_AGG('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT, ', ' ORDER BY c.grade, c.medium, c.gender_type) AS assigned_class_name,
               ARRAY_AGG(c.id::TEXT) FILTER (WHERE c.id IS NOT NULL) AS assigned_class_ids
        FROM teachers t
        LEFT JOIN classes c ON c.teacher_id = t.id
            AND c.academic_year_id = $2
        WHERE t.id = $1
        GROUP BY t.id
    """
    row = await db.fetchrow(query, teacher_id, year_id)
    if not row:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    return _row_to_response(row, row.get("assigned_class_name"), row.get("assigned_class_ids"))


from supabase import create_client, Client
from app.config import get_settings

def get_supabase_admin() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise ValueError("Supabase URL and Service Role Key must be configured")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)

@router.post("", response_model=TeacherResponse, status_code=201)
async def create_teacher(
    body: TeacherCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    if body.role == "Principal":
        raise HTTPException(status_code=403, detail="Cannot create a Principal account")

    existing = await db.fetchrow("SELECT id FROM teachers WHERE username = $1", body.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already taken")

    try:
        supabase = get_supabase_admin()
        auth_response = supabase.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"full_name": body.full_name}
        })
        auth_user_id = auth_response.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create auth user: {str(e)}")

    async with db.acquire() as conn:
        async with conn.transaction():
            # Insert into teachers
            row = await conn.fetchrow(
                """INSERT INTO teachers (full_name, contact, address, username, password_hash, role)
                   VALUES ($1, $2, $3, $4, $5, $6::teacher_role) RETURNING *""",
                body.full_name, body.contact, body.address, body.email, 'supabase-managed', body.role,
            )
            
            # Insert into admin_users
            await conn.execute(
                """INSERT INTO admin_users (id, full_name, role, teacher_id, is_active)
                   VALUES ($1, $2, $3, $4, TRUE)""",
                auth_user_id, body.full_name, body.role, row["id"]
            )

            if body.assigned_classes:
                await conn.execute(
                    "UPDATE classes SET teacher_id = $1 WHERE id = ANY($2::uuid[]) AND academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE)",
                    row["id"], body.assigned_classes
                )
            await conn.execute(
                "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
                "TEACHER_ADDED", {"name": body.full_name, "email": body.email}, user.get("teacher_id"),
            )

    cache_invalidate(TOTAL_TEACHERS)
    return _row_to_response(row)


@router.patch("/{teacher_id}", response_model=TeacherResponse)
async def update_teacher(
    teacher_id: str, body: TeacherUpdate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    target_user = await db.fetchrow("SELECT role, username FROM teachers WHERE id = $1", teacher_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Teacher not found")

    update_data = body.model_dump(exclude_unset=True)
    assigned_classes = update_data.pop("assigned_classes", None)

    updates, params, idx = [], [], 1
    for field, value in update_data.items():
        if value is not None:
            if field == "role":
                if target_user["role"] == "Principal":
                    raise HTTPException(status_code=403, detail="Cannot modify the Principal's role")
                if target_user["username"] == "rafimaa.23":
                    raise HTTPException(status_code=403, detail="Cannot modify Abdul Rafi's role")
                if value == "Principal":
                    raise HTTPException(status_code=403, detail="Cannot assign the Principal role")
                updates.append(f"{field} = ${idx}::teacher_role")
            else:
                updates.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1

    if not updates and assigned_classes is None:
        raise HTTPException(status_code=400, detail="No fields to update")

    if updates:
        params.append(teacher_id)
        row = await db.fetchrow(f"UPDATE teachers SET {', '.join(updates)} WHERE id = ${idx} RETURNING *", *params)
        if not row:
            raise HTTPException(status_code=404, detail="Teacher not found")
    else:
        row = await db.fetchrow("SELECT * FROM teachers WHERE id = $1", teacher_id)
        if not row:
            raise HTTPException(status_code=404, detail="Teacher not found")

    if assigned_classes is not None:
        await db.execute(
            "UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1 AND academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE)",
            teacher_id
        )
        if assigned_classes:
            await db.execute(
                "UPDATE classes SET teacher_id = $1 WHERE id = ANY($2::uuid[]) AND academic_year_id = (SELECT id FROM academic_years WHERE is_current = TRUE)",
                teacher_id, assigned_classes
            )

    audit_details = {"teacher_id": teacher_id}
    if body.role:
        audit_details["new_role"] = body.role

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "TEACHER_UPDATED", audit_details, user.get("teacher_id"),
    )
    return _row_to_response(row)


@router.delete("/{teacher_id}")
async def delete_teacher(
    teacher_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    target_user = await db.fetchrow("SELECT role, username FROM teachers WHERE id = $1", teacher_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    if target_user["role"] == "Principal":
        raise HTTPException(status_code=403, detail="Cannot delete the Principal account")
    if target_user["username"] == "rafimaa.23":
        raise HTTPException(status_code=403, detail="Cannot delete Abdul Rafi account")

    current_year = await db.fetchrow("SELECT id, start_date, end_date FROM academic_years WHERE is_current = TRUE")
    if current_year:
        # Check if assigned to any class this year
        has_class = await db.fetchval(
            "SELECT 1 FROM classes WHERE teacher_id = $1 AND academic_year_id = $2 LIMIT 1",
            teacher_id, current_year["id"]
        )
        if has_class:
            raise HTTPException(status_code=400, detail="Cannot delete teacher: Assigned to a class in the current academic year.")
            
        # Check if marked any attendance this year
        has_attendance = await db.fetchval(
            """SELECT 1 FROM attendance a 
               JOIN classes c ON a.class_id = c.id 
               WHERE a.marked_by = $1 AND c.academic_year_id = $2 LIMIT 1""",
            teacher_id, current_year["id"]
        )
        if has_attendance:
            raise HTTPException(status_code=400, detail="Cannot delete teacher: Has marked attendance in the current academic year.")
            
        # Check if performed any audit actions this year
        query = "SELECT 1 FROM audit_logs WHERE performed_by = $1 AND performed_at >= $2"
        params = [teacher_id, current_year["start_date"]]
        if current_year["end_date"]:
            query += " AND performed_at <= $3"
            params.append(current_year["end_date"])
        query += " LIMIT 1"
        has_audit = await db.fetchval(query, *params)
        if has_audit:
            raise HTTPException(status_code=400, detail="Cannot delete teacher: Has performed system actions during the current academic year.")

    admin_user = await db.fetchrow("SELECT id FROM admin_users WHERE teacher_id = $1", teacher_id)

    async with db.acquire() as conn:
        async with conn.transaction():
            if admin_user:
                # Delete admin_users first due to ON DELETE RESTRICT from auth.users
                await conn.execute("DELETE FROM admin_users WHERE teacher_id = $1", teacher_id)

            result = await conn.execute("DELETE FROM teachers WHERE id = $1", teacher_id)
            if result == "DELETE 0":
                raise HTTPException(status_code=404, detail="Teacher not found")
            
            await conn.execute(
                "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
                "TEACHER_DELETED", {"teacher_id": teacher_id}, user.get("teacher_id"),
            )

    if admin_user:
        try:
            supabase = get_supabase_admin()
            supabase.auth.admin.delete_user(str(admin_user["id"]))
        except Exception as e:
            # We already deleted the DB rows, so log the auth error but don't fail the request completely
            print(f"Warning: Failed to delete auth user {admin_user['id']}: {str(e)}")

    cache_invalidate(TOTAL_TEACHERS)
    return {"message": "Teacher deleted successfully"}


@router.post("/{teacher_id}/reset-password")
async def reset_password(
    teacher_id: str, body: PasswordReset,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    admin_user = await db.fetchrow("SELECT id FROM admin_users WHERE teacher_id = $1", teacher_id)
    if not admin_user:
        raise HTTPException(status_code=404, detail="Cannot reset password: Teacher does not have a linked login account.")

    try:
        supabase = get_supabase_admin()
        supabase.auth.admin.update_user_by_id(str(admin_user["id"]), {"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to reset password: {str(e)}")

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "PASSWORD_RESET", {"teacher_id": teacher_id}, user.get("teacher_id"),
    )
    return {"message": "Password reset successfully"}
