from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import date, date as dt_date
import asyncpg

from app.database import get_db
from app.auth import get_current_user, require_admin
from app.models import AttendanceBulkSubmit, AttendanceSummary, ClassAttendanceStatus

router = APIRouter()


@router.get("")
async def list_attendance(
    class_id: Optional[str] = None,
    attendance_date: Optional[dt_date] = None,
    student_id: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    query = """
        SELECT a.*, s.full_name AS student_name, s.registration_number,
               ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS class_name,
               t.full_name AS marked_by_name
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN classes c ON a.class_id = c.id
        JOIN teachers t ON a.marked_by = t.id
        WHERE 1=1
    """
    count_q = "SELECT COUNT(*) FROM attendance a WHERE 1=1"
    params, count_params, idx = [], [], 1
    filters = ""

    if class_id:
        filters += f" AND a.class_id = ${idx}"
        params.append(class_id)
        count_params.append(class_id)
        idx += 1
    if attendance_date:
        filters += f" AND a.attendance_date = ${idx}"
        params.append(attendance_date)
        count_params.append(attendance_date)
        idx += 1
    if student_id:
        filters += f" AND a.student_id = ${idx}"
        params.append(student_id)
        count_params.append(student_id)
        idx += 1

    query += filters + \
        f" ORDER BY a.attendance_date DESC, s.full_name LIMIT ${idx} OFFSET ${idx + 1}"
    count_q += filters
    total = await db.fetchval(count_q, *count_params)
    params.extend([page_size, (page - 1) * page_size])
    rows = await db.fetch(query, *params)

    items = [
        {
            "id": str(r["id"]), "student_id": str(r["student_id"]),
            "student_name": r["student_name"], "registration_number": r["registration_number"],
            "class_id": str(r["class_id"]), "class_name": r["class_name"],
            "attendance_date": str(r["attendance_date"]), "status": r["status"],
            "marked_by": str(r["marked_by"]), "marked_by_name": r["marked_by_name"],
            "is_locked": r["is_locked"],
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": max(1, -(-total // page_size))}


@router.get("/class-history")
async def class_attendance_history(
    class_id: Optional[str] = None,
    month: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    base_q = """
        FROM attendance a
        JOIN classes c ON a.class_id = c.id
        JOIN teachers t ON a.marked_by = t.id
        WHERE 1=1
    """
    filters, params, idx = "", [], 1
    if class_id:
        filters += f" AND a.class_id = ${idx}"
        params.append(class_id)
        idx += 1
    if month:
        filters += f" AND to_char(a.attendance_date, 'YYYY-MM') = ${idx}"
        params.append(month)
        idx += 1

    count_q = f"SELECT COUNT(*) FROM (SELECT DISTINCT a.attendance_date, a.class_id {base_q} {filters}) sub"
    total = await db.fetchval(count_q, *params)

    query = f"""
        SELECT a.attendance_date, a.class_id,
               ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS class_name,
               SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present,
               SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
               MAX(t.full_name) AS marked_by_name,
               BOOL_AND(a.is_locked) AS submitted
        {base_q} {filters}
        GROUP BY a.attendance_date, a.class_id, c.grade, c.medium, c.gender_type
        ORDER BY a.attendance_date DESC, class_name
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    params.extend([page_size, (page - 1) * page_size])
    rows = await db.fetch(query, *params)

    items = []
    for r in rows:
        p, a = r["present"], r["absent"]
        items.append({
            "id": f"{r['class_id']}_{r['attendance_date']}",
            "date": str(r["attendance_date"]),
            "class_id": str(r["class_id"]),
            "className": r["class_name"],
            "present": p,
            "absent": a,
            "percentage": round((p / (p + a)) * 100, 1) if p + a > 0 else 0,
            "submitted": r["submitted"],
            "submittedBy": r["marked_by_name"],
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": max(1, -(-total // page_size))}


@router.post("/bulk")
async def submit_attendance_bulk(
    body: AttendanceBulkSubmit,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Validate: date must be a Sunday
    d = body.date
    if d.weekday() != 6:  # Python: Monday=0, Sunday=6
        raise HTTPException(
            status_code=400, detail="Attendance date must be a Sunday")

    # Validate: not a future date
    if d > date.today():
        raise HTTPException(
            status_code=400, detail="Cannot mark attendance for a future Sunday")

    # Delete existing records for re-submission
    await db.execute(
        "DELETE FROM attendance WHERE class_id = $1 AND attendance_date = $2",
        body.class_id, d,
    )

    # Bulk insert
    async with db.acquire() as conn:
        async with conn.transaction():
            for rec in body.records:
                await conn.execute(
                    """INSERT INTO attendance (student_id, class_id, attendance_date, status, marked_by, is_locked)
                       VALUES ($1, $2, $3, $4::attendance_status, $5, TRUE)
                       ON CONFLICT (student_id, attendance_date)
                       DO UPDATE SET class_id = $2, status = $4::attendance_status, marked_by = $5, is_locked = TRUE""",
                    rec.student_id, body.class_id, d, rec.status, user["id"],
                )

    # Audit
    present = sum(1 for r in body.records if r.status == "Present")
    absent = len(body.records) - present
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ATTENDANCE_SUBMITTED",
        {"class_id": body.class_id, "date": str(
            d), "present": present, "absent": absent},
        user["id"],
    )

    return {"message": "Attendance submitted", "present": present, "absent": absent, "total": len(body.records)}


@router.get("/status/{attendance_date}", response_model=list[ClassAttendanceStatus])
async def attendance_status_for_date(
    attendance_date: dt_date,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    from app.cache import get_current_year_id
    year_id = await get_current_year_id(db)

    # Single query with LEFT JOIN instead of N+1 per-class queries
    rows = await db.fetch(
        """SELECT c.id AS class_id, c.grade, c.medium, c.gender_type,
                  COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present,
                  COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent,
                  COUNT(a.id) AS total
           FROM classes c
           LEFT JOIN (
               SELECT att.class_id, att.status, att.id 
               FROM attendance att
               JOIN students st ON att.student_id = st.id
               WHERE att.attendance_date = $1 AND st.current_class_id = att.class_id
           ) a ON a.class_id = c.id
           WHERE c.academic_year_id = $2
           GROUP BY c.id, c.grade, c.medium, c.gender_type
           ORDER BY c.medium, c.grade, c.gender_type""",
        attendance_date, year_id,
    )

    result = []
    for r in rows:
        class_name = f"Grade {r['grade']} {r['medium']} {r['gender_type']}"
        total = r["total"]
        result.append(ClassAttendanceStatus(
            class_id=str(r["class_id"]), class_name=class_name,
            submitted=total > 0, present=r["present"], absent=r["absent"],
            percentage=round((r["present"] / total) * 100, 1) if total > 0 else 0.0,
        ))
    return result


@router.get("/summary")
async def attendance_summary(
    attendance_date: Optional[str] = None,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    import asyncio
    from datetime import datetime
    from app.cache import (
        cache_get, cache_set, get_current_year_id,
        TOTAL_STUDENTS, TOTAL_TEACHERS, TOTAL_CLASSES, CURRENT_YEAR, TOTAL_ALUMNIS,
    )

    if not attendance_date:
        # Find the most recent Sunday
        today = date.today()
        days_since_sunday = (today.weekday() + 1) % 7
        attendance_date = str(today if days_since_sunday == 0 else today.replace(
            day=today.day - days_since_sunday))

    # Parse attendance_date string into a date object for asyncpg
    parsed_date = datetime.strptime(
        attendance_date, "%Y-%m-%d").date() if isinstance(attendance_date, str) else attendance_date

    # Get cached academic year ID upfront — avoids subqueries in every SQL below
    year_id = await get_current_year_id(db)

    # Use a single connection to prevent pool exhaustion
    async with db.acquire() as conn:
        cached_students = cache_get(TOTAL_STUDENTS)
        cached_teachers = cache_get(TOTAL_TEACHERS)
        cached_classes = cache_get(TOTAL_CLASSES)
        cached_year = cache_get(CURRENT_YEAR)
        cached_alumnis = cache_get(TOTAL_ALUMNIS)

        total_classes = cached_classes if cached_classes is not None else await conn.fetchval(
            "SELECT COUNT(*) FROM classes WHERE academic_year_id = $1", year_id)
        total_students = cached_students if cached_students is not None else await conn.fetchval(
            "SELECT COUNT(*) FROM students WHERE status = 'Active'")
        total_teachers = cached_teachers if cached_teachers is not None else await conn.fetchval(
            "SELECT COUNT(*) FROM teachers WHERE status = 'Active'")
        current_year = cached_year if cached_year is not None else (await conn.fetchval(
            "SELECT year_label FROM academic_years WHERE id = $1", year_id) or "")
        total_alumnis = cached_alumnis if cached_alumnis is not None else await conn.fetchval(
            "SELECT COUNT(*) FROM students WHERE status = 'Alumni'")

        # Per-class attendance data — single query that gives us everything we need
        class_att_rows = await conn.fetch(
            """SELECT c.id AS class_id, c.grade, c.medium, c.gender_type,
                      COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present,
                      COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0) AS absent,
                      COUNT(a.id) AS total
               FROM classes c
               LEFT JOIN (
                   SELECT att.class_id, att.status, att.id 
                   FROM attendance att
                   JOIN students st ON att.student_id = st.id
                   WHERE att.attendance_date = $1 AND st.current_class_id = att.class_id
               ) a ON a.class_id = c.id
               WHERE c.academic_year_id = $2
               GROUP BY c.id, c.grade, c.medium, c.gender_type
               ORDER BY c.medium, c.grade, c.gender_type""",
            parsed_date, year_id,
        )

    # Populate from cache or fresh results, and update cache
    if cached_classes is None:
        cache_set(TOTAL_CLASSES, total_classes)
    if cached_students is None:
        cache_set(TOTAL_STUDENTS, total_students)
    if cached_teachers is None:
        cache_set(TOTAL_TEACHERS, total_teachers)
    if cached_year is None:
        cache_set(CURRENT_YEAR, current_year)
    if cached_alumnis is None:
        cache_set(TOTAL_ALUMNIS, total_alumnis)

    # Derive overall stats + per-class data from the single query result
    # This replaces 2 separate DB queries (overall_att + classes_submitted)
    present = 0
    absent = 0
    classes_submitted = 0
    classes_data = []
    for r in class_att_rows:
        class_name = f"Grade {r['grade']} {r['medium']} {r['gender_type']}"
        c_present, c_absent, c_total = r["present"], r["absent"], r["total"]
        c_pct = round((c_present / c_total) * 100, 1) if c_total > 0 else 0.0
        present += c_present
        absent += c_absent
        if c_total > 0:
            classes_submitted += 1
        classes_data.append({
            "class_id": str(r["class_id"]),
            "class_name": class_name,
            "present": c_present,
            "absent": c_absent,
            "percentage": c_pct,
            "submitted": c_total > 0,
        })

    total_att = present + absent
    pct = round((present / total_att) * 100, 1) if total_att > 0 else 0.0

    return AttendanceSummary(
        total_students=total_students, total_teachers=total_teachers,
        total_classes=total_classes, current_academic_year=current_year,
        total_alumnis=total_alumnis,
        total_present=present, total_absent=absent,
        overall_percentage=pct, date=attendance_date,
        classes_submitted=classes_submitted, classes_total=total_classes,
        classes=classes_data,
    )


@router.patch("/{att_id}/unlock")
async def unlock_attendance(
    att_id: str,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(require_admin),
):
    result = await db.execute("UPDATE attendance SET is_locked = FALSE WHERE id = $1", att_id)
    if result == "UPDATE 0":
        raise HTTPException(
            status_code=404, detail="Attendance record not found")
    await db.execute(
        "INSERT INTO audit_logs (action, details, performed_by) VALUES ($1, $2, $3)",
        "ATTENDANCE_UNLOCKED", {"attendance_id": att_id}, user["id"],
    )
    return {"message": "Attendance unlocked"}


@router.get("/student/{student_id}")
async def student_attendance_history(
    student_id: str,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    rows = await db.fetch(
        """SELECT a.*, ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS class_name
           FROM attendance a 
           JOIN classes c ON a.class_id = c.id
           JOIN academic_years ay ON c.academic_year_id = ay.id
           WHERE a.student_id = $1 AND ay.is_current = TRUE
           ORDER BY a.attendance_date DESC""",
        student_id,
    )
    return [
        {
            "id": str(r["id"]), "attendance_date": str(r["attendance_date"]),
            "class_name": r["class_name"], "status": r["status"], "is_locked": r["is_locked"],
        }
        for r in rows
    ]


@router.get("/report")
async def attendance_report(
    class_id: str,
    mode: str = Query(..., description="'monthly' or 'yearly'"),
    month: Optional[str] = None,
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    from calendar import monthrange
    from datetime import date, timedelta, datetime

    today = date.today()
    if mode == "monthly":
        if not month:
            raise HTTPException(status_code=400, detail="month is required for monthly mode")
        try:
            year_str, m_str = month.split("-")
            year, m = int(year_str), int(m_str)
            start_date = date(year, m, 1)
            _, last_day = monthrange(year, m)
            end_date = date(year, m, last_day)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid month format, use YYYY-MM")
    elif mode == "yearly":
        year_row = await db.fetchrow("SELECT start_date FROM academic_years WHERE is_current = TRUE")
        if not year_row:
            raise HTTPException(status_code=400, detail="No current academic year found")
        start_date = year_row["start_date"]
        end_date = today
    else:
        raise HTTPException(status_code=400, detail="mode must be 'monthly' or 'yearly'")

    sundays = []
    current = start_date
    while current <= end_date:
        if current.weekday() == 6:
            sundays.append(current)
        current += timedelta(days=1)
        
    sundays_str = [s.strftime("%Y-%m-%d") for s in sundays]

    students_rows = await db.fetch(
        """
        SELECT DISTINCT s.id, s.full_name, s.registration_number 
        FROM students s
        LEFT JOIN attendance a ON a.student_id = s.id 
            AND a.class_id = $1 AND a.attendance_date >= $2 AND a.attendance_date <= $3
        WHERE (s.current_class_id = $1 AND s.status = 'Active')
           OR (a.id IS NOT NULL)
        ORDER BY s.full_name
        """,
        class_id, start_date, end_date
    )

    att_rows = await db.fetch(
        "SELECT student_id, attendance_date, status FROM attendance WHERE class_id = $1 AND attendance_date >= $2 AND attendance_date <= $3",
        class_id, start_date, end_date
    )

    att_map = {}
    for r in att_rows:
        sid = str(r["student_id"])
        if sid not in att_map:
            att_map[sid] = {}
        att_map[sid][str(r["attendance_date"])] = r["status"]

    students_data = []
    for s in students_rows:
        sid = str(s["id"])
        student_att = att_map.get(sid, {})
        present = sum(1 for d in sundays_str if student_att.get(d) == "Present")
        marked_total = sum(1 for d in sundays_str if d in student_att)
        pct = round((present / marked_total) * 100, 1) if marked_total > 0 else 0.0

        students_data.append({
            "student_id": sid,
            "student_name": s["full_name"],
            "registration_number": s["registration_number"],
            "attendance": student_att,
            "present_count": present,
            "percentage": pct
        })

    summary = {}
    for d in sundays_str:
        present_count = sum(1 for s in students_data if s["attendance"].get(d) == "Present")
        summary[d] = {
            "present": present_count,
            "total": len(students_data)
        }

    return {
        "sundays": sundays_str,
        "students": students_data,
        "summary": summary
    }

