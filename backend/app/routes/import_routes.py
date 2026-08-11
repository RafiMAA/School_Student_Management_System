from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import asyncpg
import io

from app.database import get_db
from app.auth import require_admin
from app.services.excel_service import create_student_import_template, parse_and_validate_excel
from app.cache import cache_invalidate, TOTAL_STUDENTS

router = APIRouter()


def _class_name(row) -> str:
    return f"Grade {row['grade']} {row['medium']} {row['gender_type']}"


def _normalise_class_name(value: str) -> str:
    return " ".join(value.lower().split())


@router.get("/students/template")
async def download_student_template(
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(require_admin),
):
    """Download a workbook whose Class dropdown reflects the current year."""
    classes = await db.fetch(
        """SELECT c.grade, c.medium, c.gender_type
           FROM classes c
           JOIN academic_years ay ON ay.id = c.academic_year_id
           WHERE ay.is_current = TRUE
           ORDER BY c.medium, c.grade, c.gender_type"""
    )
    workbook = create_student_import_template([_class_name(row) for row in classes])
    return StreamingResponse(
        workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="student_import_template.xlsx"'},
    )


@router.post("/students")
async def import_students(
    file: UploadFile = File(...),
    confirmed: bool = Form(default=False),
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    if not file.filename.lower().endswith(('.xlsx', '.csv')):
        raise HTTPException(status_code=400, detail="Only .xlsx and .csv files are accepted")

    content = await file.read()
    result = parse_and_validate_excel(io.BytesIO(content), file.filename)

    current_year = await db.fetchrow(
        "SELECT id, year_label FROM academic_years WHERE is_current = TRUE"
    )
    if not current_year:
        raise HTTPException(status_code=400, detail="No current academic year")

    current_classes = await db.fetch(
        """SELECT id, grade, medium, gender_type
           FROM classes
           WHERE academic_year_id = $1
           ORDER BY medium, grade, gender_type""",
        current_year["id"],
    )
    classes_by_name = {
        _normalise_class_name(_class_name(cls)): cls for cls in current_classes
    }
    classes_by_id = {str(cls["id"]): cls for cls in current_classes}

    # Resolve the friendly Class dropdown value into trusted DB values. This is
    # performed during preview as well, so invalid/stale class names are caught
    # before confirmation.
    for row in result["rows"]:
        if not row.get("class_name"):
            continue
        selected_class = classes_by_id.get(row["class_name"]) or classes_by_name.get(
            _normalise_class_name(row["class_name"])
        )
        if not selected_class:
            message = f"Class '{row['class_name']}' is not available in the current academic year"
            row["errors"].append(message)
            result["errors"].append(
                {"row": row["row_num"], "field": "class", "message": message}
            )
            continue
        row["class_id"] = str(selected_class["id"])
        row["grade"] = selected_class["grade"]
        row["medium"] = selected_class["medium"]

    result["valid_count"] = sum(1 for row in result["rows"] if not row["errors"])

    if not confirmed:
        preview = {
            "valid": result["valid_count"],
            "errors": result["errors"],
            "preview": result["rows"],
            "class_name": "Multiple Classes",
            "class_id": "auto",
        }
        return preview

    current_year_id = current_year["id"]
    current_year_label = current_year["year_label"]

    imported, skipped = 0, 0
    imported_classes: set[str] = set()
    
    # Cache class resolutions: (grade, medium) -> class_id
    class_cache = {}
    
    # Get current max sequences for both mediums
    last_sin = await db.fetchval(
        "SELECT registration_number FROM students WHERE registration_number LIKE $1 ORDER BY registration_number DESC LIMIT 1",
        f"SIN-{current_year_label}-%",
    )
    last_tam = await db.fetchval(
        "SELECT registration_number FROM students WHERE registration_number LIKE $1 ORDER BY registration_number DESC LIMIT 1",
        f"TAM-{current_year_label}-%",
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
        resolved_class_id = row.get("class_id") or class_cache.get(cache_key)

        # Legacy sheets with Grade + Medium (but no Class column) retain their
        # previous Mixed-class resolution behaviour.
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
        reg = f"{prefix}-{current_year_label}-{str(seqs[medium]).zfill(3)}"
        
        try:
            await db.execute(
                """INSERT INTO students (registration_number, full_name, gender, date_of_birth,
                        parent_name, parent_name_2, parent_contact, parent_contact_2,
                        medium, current_grade, current_class_id, joined_date)
                   VALUES ($1, $2, $3::gender_enum, $4, $5, $6, $7, $8,
                           $9::medium_type, $10, $11::uuid, $12)""",
                reg, row["full_name"], row["gender"], row["date_of_birth"],
                row["parent_name"], row.get("parent_name_2"), row["parent_contact"],
                row.get("parent_contact_2"), medium, grade, resolved_class_id,
                row["joined_date"],
            )
            seqs[medium] += 1
            imported += 1
            imported_classes.add(
                row.get("class_name") or f"Grade {grade} {medium} Mixed"
            )
        except Exception as e:
            skipped += 1
            result["errors"].append({"row": row.get("row_num", "?"), "field": "db", "message": str(e)})

    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "EXCEL_IMPORT",
        {"classes": sorted(imported_classes), "imported": imported, "skipped": skipped, "filename": file.filename},
        user.get("teacher_id"),
    )

    if imported > 0:
        cache_invalidate(TOTAL_STUDENTS)

    return {
        "valid": result["valid_count"],
        "imported": imported,
        "skipped": skipped,
        "errors": result["errors"],
        "class_name": "Multiple Classes",
        "message": f"Successfully imported {imported} students",
    }
