from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import asyncpg

from app.database import get_db
from app.auth import get_current_user, require_admin
from app.models import ClassCreate, ClassUpdate, ClassResponse, StudentResponse
from app.cache import cache_invalidate, TOTAL_CLASSES

router = APIRouter()

CLASS_NAME_SQL = "('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT)"


def _row_to_response(row) -> ClassResponse:
    return ClassResponse(
        id=str(row["id"]),
        grade=row["grade"],
        medium=row["medium"],
        gender_type=row["gender_type"],
        academic_year_id=str(row["academic_year_id"]),
        teacher_id=str(row["teacher_id"]) if row.get("teacher_id") else None,
        teacher_name=row.get("teacher_name"),
        total_students=row.get("total_students", 0),
        name=f"Grade {row['grade']} {row['medium']} {row['gender_type']}",
        created_at=row["created_at"],
    )


@router.get("", response_model=list[ClassResponse])
async def list_classes(
    academic_year_id: Optional[str] = None,
    grade: Optional[int] = None,
    medium: Optional[str] = None,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    from app.cache import get_current_year_id

    query = """
        SELECT c.*, t.full_name AS teacher_name,
               COUNT(s.id) AS total_students
        FROM classes c
        LEFT JOIN teachers t ON c.teacher_id = t.id
        LEFT JOIN students s ON s.current_class_id = c.id AND s.status = 'Active'
        WHERE 1=1
    """
    params = []
    idx = 1

    if academic_year_id:
        query += f" AND c.academic_year_id = ${idx}"
        params.append(academic_year_id)
        idx += 1
    else:
        # Default: current academic year (cached)
        year_id = await get_current_year_id(db)
        query += f" AND c.academic_year_id = ${idx}"
        params.append(year_id)
        idx += 1

    if grade:
        query += f" AND c.grade = ${idx}"
        params.append(grade)
        idx += 1

    if medium:
        query += f" AND c.medium = ${idx}::medium_type"
        params.append(medium)
        idx += 1

    query += " GROUP BY c.id, t.full_name ORDER BY c.medium, c.grade, c.gender_type"
    rows = await db.fetch(query, *params)
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=ClassResponse, status_code=201)
async def create_class(
    body: ClassCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    current_year = await db.fetchrow("SELECT id FROM academic_years WHERE is_current = TRUE")
    if not current_year:
        raise HTTPException(status_code=400, detail="No current academic year set")

    existing_classes = await db.fetch(
        "SELECT gender_type FROM classes WHERE grade = $1 AND medium = $2::medium_type AND academic_year_id = $3",
        body.grade, body.medium, current_year["id"]
    )
    for c in existing_classes:
        if body.gender_type == "Mixed" and c["gender_type"] in ("Boys", "Girls"):
            raise HTTPException(status_code=400, detail="Cannot create a Mixed class when Boys/Girls classes already exist for this grade and medium")
        if body.gender_type in ("Boys", "Girls") and c["gender_type"] == "Mixed":
            raise HTTPException(status_code=400, detail="Cannot create Boys/Girls classes when a Mixed class already exists for this grade and medium")


    try:
        row = await db.fetchrow(
            """INSERT INTO classes (grade, medium, gender_type, academic_year_id, teacher_id)
               VALUES ($1, $2::medium_type, $3::gender_type_enum, $4, $5) RETURNING *""",
            body.grade, body.medium, body.gender_type, current_year["id"],
            body.teacher_id if body.teacher_id else None,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="This class already exists for the current year")

    teacher_name = None
    if body.teacher_id:
        t = await db.fetchrow("SELECT full_name FROM teachers WHERE id = $1", body.teacher_id)
        teacher_name = t["full_name"] if t else None

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "CLASS_CREATED",
        {"grade": body.grade, "medium": body.medium, "gender_type": body.gender_type},
        user.get("teacher_id"),
    )

    cache_invalidate(TOTAL_CLASSES)

    return ClassResponse(
        id=str(row["id"]), grade=row["grade"], medium=row["medium"],
        gender_type=row["gender_type"], academic_year_id=str(row["academic_year_id"]),
        teacher_id=str(row["teacher_id"]) if row["teacher_id"] else None,
        teacher_name=teacher_name, total_students=0,
        name=f"Grade {row['grade']} {row['medium']} {row['gender_type']}",
        created_at=row["created_at"],
    )


@router.patch("/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: str, body: ClassUpdate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    current_class = await db.fetchrow("SELECT * FROM classes WHERE id = $1", class_id)
    if not current_class:
        raise HTTPException(status_code=404, detail="Class not found")

    new_grade = body.grade if body.grade is not None else current_class["grade"]
    new_medium = body.medium if body.medium is not None else current_class["medium"]
    new_gender_type = body.gender_type if body.gender_type is not None else current_class["gender_type"]

    if new_grade != current_class["grade"] or new_medium != current_class["medium"] or new_gender_type != current_class["gender_type"]:
        existing_classes = await db.fetch(
            "SELECT gender_type FROM classes WHERE grade = $1 AND medium = $2::medium_type AND academic_year_id = $3 AND id != $4",
            new_grade, new_medium, current_class["academic_year_id"], class_id
        )
        for c in existing_classes:
            if new_gender_type == "Mixed" and c["gender_type"] in ("Boys", "Girls"):
                raise HTTPException(status_code=400, detail="Cannot change to Mixed class when Boys/Girls classes already exist for this grade and medium")
            if new_gender_type in ("Boys", "Girls") and c["gender_type"] == "Mixed":
                raise HTTPException(status_code=400, detail="Cannot change to Boys/Girls classes when a Mixed class already exists for this grade and medium")

    updates, params, idx = [], [], 1
    if body.grade is not None:
        updates.append(f"grade = ${idx}")
        params.append(body.grade)
        idx += 1
    if body.medium is not None:
        updates.append(f"medium = ${idx}::medium_type")
        params.append(body.medium)
        idx += 1
    if body.teacher_id is not None:
        updates.append(f"teacher_id = ${idx}")
        params.append(body.teacher_id if body.teacher_id else None)
        idx += 1
    if body.gender_type is not None:
        updates.append(f"gender_type = ${idx}::gender_type_enum")
        params.append(body.gender_type)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(class_id)
    query = f"UPDATE classes SET {', '.join(updates)} WHERE id = ${idx} RETURNING *"
    try:
        row = await db.fetchrow(query, *params)
        if not row:
            raise HTTPException(status_code=404, detail="Class not found")
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="This class already exists for the current year")

    teacher_name = None
    if row["teacher_id"]:
        t = await db.fetchrow("SELECT full_name FROM teachers WHERE id = $1", row["teacher_id"])
        teacher_name = t["full_name"] if t else None

    count = await db.fetchval("SELECT COUNT(*) FROM students WHERE current_class_id = $1 AND status = 'Active'", class_id)

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "CLASS_UPDATED", {"class_id": class_id}, user.get("teacher_id"),
    )

    return ClassResponse(
        id=str(row["id"]), grade=row["grade"], medium=row["medium"],
        gender_type=row["gender_type"], academic_year_id=str(row["academic_year_id"]),
        teacher_id=str(row["teacher_id"]) if row["teacher_id"] else None,
        teacher_name=teacher_name, total_students=count,
        name=f"Grade {row['grade']} {row['medium']} {row['gender_type']}",
        created_at=row["created_at"],
    )


@router.delete("/{class_id}")
async def delete_class(
    class_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    count = await db.fetchval(
        "SELECT COUNT(*) FROM students WHERE current_class_id = $1 AND status = 'Active'", class_id
    )
    if count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete class with {count} active students")

    result = await db.execute("DELETE FROM classes WHERE id = $1", class_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Class not found")

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "CLASS_DELETED", {"class_id": class_id}, user.get("teacher_id"),
    )
    cache_invalidate(TOTAL_CLASSES)
    return {"message": "Class deleted"}


@router.get("/{class_id}/students", response_model=list[StudentResponse])
async def list_class_students(
    class_id: str,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    rows = await db.fetch(
        """SELECT s.*,
                  ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS class_name
           FROM students s
           LEFT JOIN classes c ON s.current_class_id = c.id
           WHERE s.current_class_id = $1 AND s.status = 'Active'
           ORDER BY s.full_name""",
        class_id,
    )
    return [
        StudentResponse(
            id=str(r["id"]), registration_number=r["registration_number"],
            full_name=r["full_name"], gender=r["gender"],
            date_of_birth=r["date_of_birth"], parent_name=r["parent_name"],
            parent_contact=r["parent_contact"], medium=r["medium"],
            current_grade=r["current_grade"],
            current_class_id=str(r["current_class_id"]) if r["current_class_id"] else None,
            class_name=r.get("class_name"), status=r["status"],
            joined_date=r["joined_date"], graduation_year=r.get("graduation_year"),
            created_at=r["created_at"],
        )
        for r in rows
    ]
