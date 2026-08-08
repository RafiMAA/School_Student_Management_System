from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
import asyncpg
import io

from app.database import get_db
from app.auth import require_admin
from app.services.excel_service import parse_and_validate_excel
from app.cache import cache_invalidate, TOTAL_STUDENTS

router = APIRouter()


@router.post("/students")
async def import_students(
    file: UploadFile = File(...),
    class_id: Optional[str] = Form(default=None),
    confirmed: bool = Form(default=False),
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    if not file.filename.endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="Only .xlsx and .csv files are accepted")

    content = await file.read()
    result = parse_and_validate_excel(io.BytesIO(content), file.filename)

    if not confirmed:
        preview = {
            "valid": result["valid_count"],
            "errors": result["errors"],
            "preview": result["rows"],
            "class_name": "Multiple Classes",
            "class_id": "auto",
        }
        return preview

    current_year_id = await db.fetchval("SELECT id FROM academic_years WHERE is_current = TRUE")
    current_year = await db.fetchval("SELECT year_label FROM academic_years WHERE is_current = TRUE")
    if not current_year_id or not current_year:
        raise HTTPException(status_code=400, detail="No current academic year")

    imported, skipped = 0, 0
    
    # Cache class resolutions: (grade, medium) -> class_id
    class_cache = {}
    
    # Get current max sequences for both mediums
    last_sin = await db.fetchval(
        "SELECT registration_number FROM students WHERE registration_number LIKE $1 ORDER BY registration_number DESC LIMIT 1",
        f"SIN-{current_year}-%",
    )
    last_tam = await db.fetchval(
        "SELECT registration_number FROM students WHERE registration_number LIKE $1 ORDER BY registration_number DESC LIMIT 1",
        f"TAM-{current_year}-%",
    )
    
    seqs = {
        "Sinhala": int(last_sin.split("-")[-1]) + 1 if last_sin else 1,
        "Tamil": int(last_tam.split("-")[-1]) + 1 if last_tam else 1,
    }

    for row in result["rows"]:
        if row.get("errors"):
            skipped += 1
            continue
            
        grade = row["grade"]
        medium = row["medium"]
        cache_key = (grade, medium)
        
        resolved_class_id = class_cache.get(cache_key)
        
        if not resolved_class_id:
            gender_type = "Mixed"
            existing = await db.fetchrow(
                """SELECT id FROM classes
                   WHERE grade = $1 AND medium = $2::medium_type AND gender_type = $3::gender_type_enum
                   AND academic_year_id = $4""",
                grade, medium, gender_type, current_year_id,
            )
            if existing:
                resolved_class_id = str(existing["id"])
            else:
                new_cls = await db.fetchrow(
                    """INSERT INTO classes (grade, medium, gender_type, academic_year_id)
                       VALUES ($1, $2::medium_type, $3::gender_type_enum, $4)
                       RETURNING id""",
                    grade, medium, gender_type, current_year_id,
                )
                resolved_class_id = str(new_cls["id"])
            class_cache[cache_key] = resolved_class_id

        prefix = "SIN" if medium == "Sinhala" else "TAM"
        reg = f"{prefix}-{current_year}-{str(seqs[medium]).zfill(3)}"
        
        try:
            await db.execute(
                """INSERT INTO students (registration_number, full_name, gender, date_of_birth,
                        parent_name, parent_contact, medium, current_grade, current_class_id, joined_date)
                   VALUES ($1, $2, $3::gender_enum, $4, $5, $6, $7::medium_type, $8, $9::uuid, CURRENT_DATE)""",
                reg, row["full_name"], row["gender"], row["date_of_birth"],
                row["parent_name"], row["parent_contact"], medium,
                grade, resolved_class_id,
            )
            seqs[medium] += 1
            imported += 1
        except Exception as e:
            skipped += 1
            result["errors"].append({"row": row.get("row_num", "?"), "field": "db", "message": str(e)})

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "EXCEL_IMPORT",
        {"classes": [f"Grade {g} {m}" for g, m in class_cache.keys()], "imported": imported, "skipped": skipped, "filename": file.filename},
        user.get("teacher_id"),
    )

    if imported > 0:
        cache_invalidate(TOTAL_STUDENTS)

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": result["errors"],
        "class_name": "Multiple Classes",
        "message": f"Successfully imported {imported} students",
    }
