from typing import Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, Response
import asyncpg

from app.database import get_db
from app.auth import get_current_user
from app.models import UserProfile, AcademicYearResponse, AttendanceSummary

router = APIRouter()


@router.get("/bootstrap")
async def dashboard_bootstrap(
    attendance_date: Optional[str] = None,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
    response: Response = None,
):
    """
    Single-request bootstrap: User + Academic Year + Dashboard Summary.
    Uses CTEs to collapse 8 queries into 2 DB round-trips.
    """
    from app.cache import (
        cache_get, cache_set, get_current_year_id,
        TOTAL_STUDENTS, TOTAL_TEACHERS, TOTAL_CLASSES, CURRENT_YEAR, TOTAL_ALUMNIS,
    )

    if not attendance_date:
        today = date.today()
        days_since_sunday = (today.weekday() + 1) % 7
        attendance_date = str(today if days_since_sunday == 0 else today.replace(
            day=today.day - days_since_sunday))

    parsed_date = datetime.strptime(
        attendance_date, "%Y-%m-%d").date() if isinstance(attendance_date, str) else attendance_date

    year_id = await get_current_year_id(db)

    # Check all caches upfront
    cached_students = cache_get(TOTAL_STUDENTS)
    cached_teachers = cache_get(TOTAL_TEACHERS)
    cached_classes = cache_get(TOTAL_CLASSES)
    cached_year_label = cache_get(CURRENT_YEAR)
    cached_alumnis = cache_get(TOTAL_ALUMNIS)
    all_counts_cached = all(v is not None for v in [
        cached_students, cached_teachers, cached_classes, cached_year_label, cached_alumnis
    ])

    async with db.acquire() as conn:
        # ── First: resolve teacher_id from admin_users (may be NULL) ──
        admin_row = await conn.fetchrow(
            "SELECT teacher_id FROM admin_users WHERE id = $1",
            user["id"],
        )
        teacher_id = admin_row["teacher_id"] if admin_row else None

        # ── CTE Query 1: Teacher profile (optional) + Academic year + counts ──
        if all_counts_cached:
            if teacher_id:
                meta_row = await conn.fetchrow(
                    """
                    WITH teacher AS (
                        SELECT t.id, t.full_name, t.username, t.contact, t.address, t.role,
                               ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS assigned_class
                        FROM teachers t
                        LEFT JOIN classes c ON c.teacher_id = t.id AND c.academic_year_id = $2
                        WHERE t.id = $1
                    ),
                    acad_year AS (
                        SELECT id, year_label, start_date, end_date, is_current, created_at
                        FROM academic_years WHERE id = $2
                    )
                    SELECT
                        t.id AS t_id, t.full_name, t.username, t.contact, t.address, t.role, t.assigned_class,
                        ay.id AS ay_id, ay.year_label, ay.start_date, ay.end_date, ay.is_current, ay.created_at,
                        0::BIGINT AS student_count, 0::BIGINT AS teacher_count,
                        0::BIGINT AS class_count, ''::TEXT AS year_label_count, 0::BIGINT AS alumni_count
                    FROM teacher t, acad_year ay
                    """,
                    teacher_id, year_id,
                )
            else:
                meta_row = await conn.fetchrow(
                    """
                    SELECT id, year_label, start_date, end_date, is_current, created_at,
                           0::BIGINT AS student_count, 0::BIGINT AS teacher_count,
                           0::BIGINT AS class_count, ''::TEXT AS year_label_count, 0::BIGINT AS alumni_count
                    FROM academic_years WHERE id = $1
                    """,
                    year_id,
                )
        else:
            if teacher_id:
                meta_row = await conn.fetchrow(
                    """
                    WITH teacher AS (
                        SELECT t.id, t.full_name, t.username, t.contact, t.address, t.role,
                               ('Grade ' || c.grade || ' ' || c.medium::TEXT || ' ' || c.gender_type::TEXT) AS assigned_class
                        FROM teachers t
                        LEFT JOIN classes c ON c.teacher_id = t.id AND c.academic_year_id = $2
                        WHERE t.id = $1
                    ),
                    acad_year AS (
                        SELECT id, year_label, start_date, end_date, is_current, created_at
                        FROM academic_years WHERE id = $2
                    ),
                    cnt_students AS (SELECT COUNT(*) AS n FROM students WHERE status = 'Active'),
                    cnt_teachers AS (SELECT COUNT(*) AS n FROM teachers WHERE status = 'Active'),
                    cnt_classes  AS (SELECT COUNT(*) AS n FROM classes WHERE academic_year_id = $2),
                    cnt_alumnis  AS (SELECT COUNT(*) AS n FROM students WHERE status = 'Alumni')
                    SELECT
                        t.id AS t_id, t.full_name, t.username, t.contact, t.address, t.role, t.assigned_class,
                        ay.id AS ay_id, ay.year_label, ay.start_date, ay.end_date, ay.is_current, ay.created_at,
                        cs.n AS student_count, ct.n AS teacher_count, cc.n AS class_count,
                        ay.year_label AS year_label_count, ca.n AS alumni_count
                    FROM teacher t, acad_year ay, cnt_students cs, cnt_teachers ct, cnt_classes cc, cnt_alumnis ca
                    """,
                    teacher_id, year_id,
                )
            else:
                meta_row = await conn.fetchrow(
                    """
                    WITH acad_year AS (
                        SELECT id, year_label, start_date, end_date, is_current, created_at
                        FROM academic_years WHERE id = $1
                    ),
                    cnt_students AS (SELECT COUNT(*) AS n FROM students WHERE status = 'Active'),
                    cnt_teachers AS (SELECT COUNT(*) AS n FROM teachers WHERE status = 'Active'),
                    cnt_classes  AS (SELECT COUNT(*) AS n FROM classes WHERE academic_year_id = $1),
                    cnt_alumnis  AS (SELECT COUNT(*) AS n FROM students WHERE status = 'Alumni')
                    SELECT
                        ay.id AS ay_id, ay.year_label, ay.start_date, ay.end_date, ay.is_current, ay.created_at,
                        cs.n AS student_count, ct.n AS teacher_count, cc.n AS class_count,
                        ay.year_label AS year_label_count, ca.n AS alumni_count
                    FROM acad_year ay, cnt_students cs, cnt_teachers ct, cnt_classes cc, cnt_alumnis ca
                    """,
                    year_id,
                )

        # ── Query 2: Per-class attendance (single aggregate query) ──
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

    # ── Assemble response ──
    # Build user profile from teacher data if available, otherwise from admin_users
    has_teacher = teacher_id is not None and meta_row is not None and "t_id" in meta_row.keys()
    if has_teacher:
        user_profile = UserProfile(
            id=str(meta_row["t_id"]),
            full_name=meta_row["full_name"],
            username=meta_row["username"],
            contact=meta_row["contact"],
            address=meta_row["address"],
            role=meta_row["role"],
            assigned_class=meta_row["assigned_class"],
        )
    else:
        user_profile = UserProfile(
            id=user["id"],
            full_name=user["full_name"],
            username="",
            contact="",
            address="",
            role=user["role"],
            assigned_class=None,
        )

    academic_year = AcademicYearResponse(
        id=str(meta_row["ay_id"]),
        year_label=meta_row["year_label"],
        start_date=meta_row["start_date"],
        end_date=meta_row["end_date"],
        is_current=meta_row["is_current"],
        created_at=meta_row["created_at"],
    )

    # Resolve counts from cache or from the CTE result
    total_students = cached_students if cached_students is not None else meta_row["student_count"]
    total_teachers = cached_teachers if cached_teachers is not None else meta_row["teacher_count"]
    total_classes = cached_classes if cached_classes is not None else meta_row["class_count"]
    current_year = cached_year_label if cached_year_label is not None else (meta_row["year_label_count"] or "")
    total_alumnis = cached_alumnis if cached_alumnis is not None else meta_row["alumni_count"]

    # Update caches
    if cached_students is None:
        cache_set(TOTAL_STUDENTS, total_students)
    if cached_teachers is None:
        cache_set(TOTAL_TEACHERS, total_teachers)
    if cached_classes is None:
        cache_set(TOTAL_CLASSES, total_classes)
    if cached_year_label is None:
        cache_set(CURRENT_YEAR, current_year)
    if cached_alumnis is None:
        cache_set(TOTAL_ALUMNIS, total_alumnis)

    # Derive attendance stats
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

    summary = AttendanceSummary(
        total_students=total_students, total_teachers=total_teachers,
        total_classes=total_classes, current_academic_year=current_year,
        total_alumnis=total_alumnis,
        total_present=present, total_absent=absent,
        overall_percentage=pct, date=attendance_date,
        classes_submitted=classes_submitted, classes_total=total_classes,
        classes=classes_data,
    )

    # Cache-Control: browser can skip this request for 30s on back-navigation
    if response:
        response.headers["Cache-Control"] = "private, max-age=30"

    return {
        "user": user_profile,
        "academic_year": academic_year,
        "summary": summary,
    }
