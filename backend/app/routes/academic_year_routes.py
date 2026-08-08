from fastapi import APIRouter, Depends, HTTPException, Response
import asyncpg

from app.database import get_db
from app.auth import get_current_user, require_super_admin
from app.models import AcademicYearCreate, AcademicYearResponse, AcademicYearUpdateLabel

router = APIRouter()


def _row_to_response(row) -> AcademicYearResponse:
    return AcademicYearResponse(
        id=str(row["id"]),
        year_label=row["year_label"],
        start_date=row["start_date"],
        end_date=row["end_date"],
        is_current=row["is_current"],
        created_at=row["created_at"],
    )


@router.get("", response_model=list[AcademicYearResponse])
async def list_academic_years(
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    rows = await db.fetch("SELECT * FROM academic_years ORDER BY year_label DESC")
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=AcademicYearResponse, status_code=201)
async def create_academic_year(
    body: AcademicYearCreate,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    existing = await db.fetchrow(
        "SELECT id FROM academic_years WHERE year_label = $1", body.year_label
    )
    if existing:
        raise HTTPException(status_code=409, detail="Academic year already exists")

    row = await db.fetchrow(
        """INSERT INTO academic_years (year_label, start_date)
           VALUES ($1, $2) RETURNING *""",
        body.year_label, body.start_date,
    )
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ACADEMIC_YEAR_CREATED", {"year_label": body.year_label}, user.get("teacher_id"),
    )
    return _row_to_response(row)


@router.get("/current", response_model=AcademicYearResponse)
async def get_current_year(
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
    response: Response = None,
):
    row = await db.fetchrow("SELECT * FROM academic_years WHERE is_current = TRUE")
    if not row:
        raise HTTPException(status_code=404, detail="No current academic year set")
    if response:
        response.headers["Cache-Control"] = "private, max-age=300"  # 5 min — rarely changes
    return _row_to_response(row)


@router.patch("/current/label", response_model=AcademicYearResponse)
async def update_current_year_label(
    body: AcademicYearUpdateLabel,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    from app.cache import cache_invalidate, CURRENT_YEAR, CURRENT_YEAR_ID
    row = await db.fetchrow(
        "UPDATE academic_years SET year_label = $1 WHERE is_current = TRUE RETURNING *",
        body.year_label,
    )
    if not row:
        raise HTTPException(status_code=404, detail="No current academic year set")
    
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ACADEMIC_YEAR_UPDATED", {"new_label": body.year_label}, user.get("teacher_id"),
    )
    cache_invalidate(CURRENT_YEAR, CURRENT_YEAR_ID)
    return _row_to_response(row)



@router.patch("/{year_id}/set-current", response_model=AcademicYearResponse)
async def set_current_year(
    year_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    async with db.acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE academic_years SET is_current = FALSE WHERE is_current = TRUE")
            row = await conn.fetchrow(
                "UPDATE academic_years SET is_current = TRUE WHERE id = $1 RETURNING *", year_id
            )
            if not row:
                raise HTTPException(status_code=404, detail="Academic year not found")
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ACADEMIC_YEAR_SET_CURRENT", {"year_id": year_id}, user.get("teacher_id"),
    )
    # Invalidate all caches that depend on the current academic year
    from app.cache import cache_invalidate, cache_invalidate_prefix, CURRENT_YEAR, CURRENT_YEAR_ID, TOTAL_CLASSES, USER_PREFIX
    cache_invalidate(CURRENT_YEAR, CURRENT_YEAR_ID, TOTAL_CLASSES)
    cache_invalidate_prefix(USER_PREFIX)  # assigned_class depends on year
    return _row_to_response(row)


@router.patch("/{year_id}/close", response_model=AcademicYearResponse)
async def close_year(
    year_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_super_admin),
):
    from datetime import date
    row = await db.fetchrow(
        "UPDATE academic_years SET end_date = $1 WHERE id = $2 RETURNING *",
        date.today(), year_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Academic year not found")
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ACADEMIC_YEAR_CLOSED", {"year_id": year_id}, user.get("teacher_id"),
    )
    return _row_to_response(row)
