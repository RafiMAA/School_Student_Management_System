from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import asyncpg

from app.database import get_db
from app.auth import get_current_user, require_admin
from app.models import (
    StudentCreate, StudentUpdate, StudentResponse, StudentTransfer, StudentGraduate, AlumniCreate, AchievementCreate, AchievementResponse
)
from app.cache import cache_invalidate, TOTAL_STUDENTS

router = APIRouter()


def _row_to_response(r) -> StudentResponse:
    return StudentResponse(
        id=str(r["id"]), registration_number=r["registration_number"],
        full_name=r["full_name"], gender=r["gender"],
        date_of_birth=r["date_of_birth"], parent_name=r["parent_name"], parent_name_2=r.get("parent_name_2"),
        parent_contact=r["parent_contact"], parent_contact_2=r.get("parent_contact_2"), own_contact=r.get("own_contact"), medium=r["medium"],
        current_grade=r["current_grade"],
        current_class_id=str(r["current_class_id"]) if r.get("current_class_id") else None,
        class_name=r.get("class_name"), status=r["status"],
        joined_date=r["joined_date"], graduation_year=r.get("graduation_year"),
        created_at=r["created_at"],
    )


async def _generate_reg_number(db: asyncpg.Pool, medium: str, year: str) -> str:
    prefix = "SIN" if medium == "Sinhala" else "TAM"
    last = await db.fetchval(
        "SELECT registration_number FROM students WHERE registration_number LIKE $1 ORDER BY registration_number DESC LIMIT 1",
        f"{prefix}-{year}-%",
    )
    if last:
        seq = int(last.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}-{year}-{str(seq).zfill(3)}"


@router.get("", response_model=dict)
async def list_students(
    grade: Optional[int] = None,
    class_id: Optional[str] = None,
    medium: Optional[str] = None,
    gender: Optional[str] = None,
    status: Optional[str] = Query(default=None),
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    query = """
        SELECT s.*,
               ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS class_name
        FROM students s
        LEFT JOIN classes c ON s.current_class_id = c.id
        WHERE 1=1
    """
    count_query = "SELECT COUNT(*) FROM students s WHERE 1=1"
    params = []
    count_params = []
    idx = 1

    filters = ""
    if grade:
        filters += f" AND s.current_grade = ${idx}"
        params.append(grade); count_params.append(grade); idx += 1
    if class_id:
        filters += f" AND s.current_class_id = ${idx}"
        params.append(class_id); count_params.append(class_id); idx += 1
    if medium:
        filters += f" AND s.medium = ${idx}::medium_type"
        params.append(medium); count_params.append(medium); idx += 1
    if gender:
        filters += f" AND s.gender = ${idx}::gender_enum"
        params.append(gender); count_params.append(gender); idx += 1
    if status:
        filters += f" AND s.status = ${idx}::student_status"
        params.append(status); count_params.append(status); idx += 1
    if search:
        filters += f" AND (s.full_name ILIKE ${idx} OR s.registration_number ILIKE ${idx})"
        params.append(f"%{search}%"); count_params.append(f"%{search}%"); idx += 1

    query += filters
    count_query += filters

    total = await db.fetchval(count_query, *count_params)
    offset = (page - 1) * page_size
    query += f" ORDER BY s.full_name LIMIT ${idx} OFFSET ${idx + 1}"
    params.extend([page_size, offset])

    rows = await db.fetch(query, *params)
    items = [_row_to_response(r) for r in rows]
    total_pages = max(1, -(-total // page_size))

    return {"items": [i.model_dump() for i in items], "total": total, "page": page, "page_size": page_size, "total_pages": total_pages}


@router.post("", response_model=StudentResponse, status_code=201)
async def create_student(
    body: StudentCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    current_year = await db.fetchval("SELECT year_label FROM academic_years WHERE is_current = TRUE")
    if not current_year:
        raise HTTPException(status_code=400, detail="No current academic year set")

    reg_number = await _generate_reg_number(db, body.medium, current_year)

    row = await db.fetchrow(
        """INSERT INTO students (registration_number, full_name, gender, date_of_birth,
                parent_name, parent_name_2, parent_contact, parent_contact_2, medium, current_grade, current_class_id, joined_date)
           VALUES ($1, $2, $3::gender_enum, $4, $5, $6, $7, $8, $9::medium_type, $10, $11, $12) RETURNING *""",
        reg_number, body.full_name, body.gender, body.date_of_birth,
        body.parent_name, body.parent_name_2, body.parent_contact, body.parent_contact_2, body.medium,
        body.current_grade, body.current_class_id, body.joined_date,
    )

    class_name = None
    if row["current_class_id"]:
        c = await db.fetchrow("SELECT grade, medium, gender_type FROM classes WHERE id = $1", row["current_class_id"])
        if c:
            class_name = f"Grade {c['grade']} {c['medium']} {c['gender_type']}"

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "STUDENT_ADDED", {"name": body.full_name, "reg": reg_number}, user.get("teacher_id"),
    )

    cache_invalidate(TOTAL_STUDENTS)
    resp = _row_to_response(row)
    resp.class_name = class_name
    return resp


@router.post("/alumni", response_model=StudentResponse, status_code=201)
async def create_alumni(
    body: AlumniCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    current_year = await db.fetchval("SELECT year_label FROM academic_years WHERE is_current = TRUE")
    if not current_year:
        raise HTTPException(status_code=400, detail="No current academic year set")

    # Generate registration number based on current year or their graduation year? 
    # Usually based on the year they were registered, but we can just use the current year as a prefix 
    # or the graduation year. Let's use current_year to be consistent with normal generation logic.
    reg_number = await _generate_reg_number(db, body.medium, current_year)

    # For alumni, they don't have a current_grade or current_class_id. We'll set current_grade to 11 (max) just to satisfy the NOT NULL CHECK (current_grade >= 1 AND current_grade <= 11) constraint in the DB.
    row = await db.fetchrow(
        """INSERT INTO students (registration_number, full_name, gender, date_of_birth,
                parent_name, parent_name_2, parent_contact, parent_contact_2, own_contact, medium, current_grade, current_class_id, joined_date, status, graduation_year)
           VALUES ($1, $2, $3::gender_enum, $4, $5, $6, $7, $8, $9, $10::medium_type, 11, NULL, $11, 'Alumni', $12) RETURNING *""",
        reg_number, body.full_name, body.gender, body.date_of_birth,
        body.parent_name, body.parent_name_2, body.parent_contact, body.parent_contact_2, body.own_contact, body.medium,
        body.joined_date, body.graduation_year,
    )

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ALUMNI_ADDED", {"name": body.full_name, "reg": reg_number}, user.get("teacher_id"),
    )

    cache_invalidate(TOTAL_STUDENTS)
    from app.cache import TOTAL_ALUMNIS
    cache_invalidate(TOTAL_ALUMNIS)
    
    return _row_to_response(row)



@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: str,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    row = await db.fetchrow(
        """SELECT s.*,
                  ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS class_name
           FROM students s LEFT JOIN classes c ON s.current_class_id = c.id
           WHERE s.id = $1""",
        student_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")
    return _row_to_response(row)


@router.patch("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: str, body: StudentUpdate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    updates, params, idx = [], [], 1
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "gender":
                updates.append(f"{field} = ${idx}::gender_enum")
            elif field == "medium":
                updates.append(f"{field} = ${idx}::medium_type")
            else:
                updates.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(student_id)
    query = f"UPDATE students SET {', '.join(updates)} WHERE id = ${idx} RETURNING *"
    row = await db.fetchrow(query, *params)
    if not row:
        raise HTTPException(status_code=404, detail="Student not found")

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "STUDENT_UPDATED", {"student_id": student_id}, user.get("teacher_id"),
    )
    return _row_to_response(row)


@router.delete("/{student_id}")
async def delete_student(
    student_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    result = await db.execute(
        "UPDATE students SET status = 'Inactive' WHERE id = $1", student_id
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Student not found")

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "STUDENT_DELETED", {"student_id": student_id}, user.get("teacher_id"),
    )
    cache_invalidate(TOTAL_STUDENTS)
    return {"message": "Student set to inactive"}


@router.post("/{student_id}/transfer")
async def transfer_student(
    student_id: str, body: StudentTransfer,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    target = await db.fetchrow("SELECT grade, medium, gender_type FROM classes WHERE id = $1", body.target_class_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target class not found")

    await db.execute(
        "UPDATE students SET current_class_id = $1, current_grade = $2 WHERE id = $3",
        body.target_class_id, target["grade"], student_id,
    )

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "STUDENT_TRANSFERRED",
        {"student_id": student_id, "target_class": body.target_class_id},
        user.get("teacher_id"),
    )
    return {"message": "Student transferred"}


@router.post("/{student_id}/graduate")
async def graduate_student(
    student_id: str, body: StudentGraduate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    await db.execute(
        "UPDATE students SET status = 'Alumni', graduation_year = $1 WHERE id = $2",
        body.graduation_year, student_id,
    )

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "STUDENT_GRADUATED",
        {"student_id": student_id, "graduation_year": body.graduation_year},
        user.get("teacher_id"),
    )
    cache_invalidate(TOTAL_STUDENTS)
    return {"message": "Student graduated to alumni"}


# ============================================================
# Student Achievements
# ============================================================

@router.get("/{student_id}/achievements", response_model=list[AchievementResponse])
async def list_achievements(
    student_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """List all achievements for a student, grouped by academic year."""
    # Get current academic year id
    from app.cache import get_current_year_id
    current_year_id = await get_current_year_id(db)

    rows = await db.fetch(
        """SELECT sa.*, ay.year_label AS academic_year_label, t.full_name AS created_by_name
           FROM student_achievements sa
           JOIN academic_years ay ON sa.academic_year_id = ay.id
           LEFT JOIN teachers t ON sa.created_by = t.id
           WHERE sa.student_id = $1
           ORDER BY ay.start_date DESC, sa.created_at DESC""",
        student_id,
    )

    results = []
    for r in rows:
        can_delete = (
            str(r["academic_year_id"]) == str(current_year_id)
            and (str(r["created_by"]) == user.get("teacher_id") or user["role"] in ("Principal", "Admin"))
        )
        results.append(AchievementResponse(
            id=str(r["id"]),
            student_id=str(r["student_id"]),
            academic_year_id=str(r["academic_year_id"]),
            academic_year_label=r["academic_year_label"],
            grade=r["grade"],
            achievement_text=r["achievement_text"],
            created_by=str(r["created_by"]) if r["created_by"] else "",
            created_by_name=r["created_by_name"] or "Unknown",
            created_at=r["created_at"],
            can_delete=can_delete,
        ))
    return results


@router.post("/{student_id}/achievements", response_model=AchievementResponse, status_code=201)
async def add_achievement(
    student_id: str,
    body: AchievementCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Add an achievement for a student under the current academic year."""
    # Verify student exists
    student = await db.fetchrow("SELECT id, current_grade FROM students WHERE id = $1", student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get current academic year
    year = await db.fetchrow("SELECT id, year_label FROM academic_years WHERE is_current = TRUE")
    if not year:
        raise HTTPException(status_code=400, detail="No current academic year set")

    if not body.achievement_text.strip():
        raise HTTPException(status_code=400, detail="Achievement text cannot be empty")

    row = await db.fetchrow(
        """INSERT INTO student_achievements (student_id, academic_year_id, grade, achievement_text, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING *""",
        student_id, str(year["id"]), student["current_grade"], body.achievement_text.strip(), user.get("teacher_id"),
    )

    teacher_name = user["full_name"]

    return AchievementResponse(
        id=str(row["id"]),
        student_id=str(row["student_id"]),
        academic_year_id=str(row["academic_year_id"]),
        academic_year_label=year["year_label"],
        grade=row["grade"],
        achievement_text=row["achievement_text"],
        created_by=str(row["created_by"]),
        created_by_name=teacher_name,
        created_at=row["created_at"],
        can_delete=True,
    )


@router.delete("/{student_id}/achievements/{achievement_id}")
async def delete_achievement(
    student_id: str,
    achievement_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Delete an achievement — only allowed for achievements in the current academic year."""
    row = await db.fetchrow(
        "SELECT * FROM student_achievements WHERE id = $1 AND student_id = $2",
        achievement_id, student_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Achievement not found")

    # Check it belongs to the current academic year
    from app.cache import get_current_year_id
    current_year_id = await get_current_year_id(db)
    if str(row["academic_year_id"]) != str(current_year_id):
        raise HTTPException(status_code=403, detail="Cannot delete achievements from past academic years")

    # Check permission: author or admin
    if str(row["created_by"]) != user.get("teacher_id") and user["role"] not in ("Principal", "Admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own achievements")

    await db.execute("DELETE FROM student_achievements WHERE id = $1", achievement_id)
    return {"message": "Achievement deleted"}
