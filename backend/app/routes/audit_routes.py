from fastapi import APIRouter, Depends, Query
from typing import Optional
import asyncpg

from app.database import get_db
from app.auth import require_admin
from app.models import AuditLogResponse

router = APIRouter()


@router.get("", response_model=dict)
async def list_audit_logs(
    action: Optional[str] = None,
    performed_by: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10000),
    db: asyncpg.Pool = Depends(get_db),
    _user: dict = Depends(require_admin),
):
    query = """
        SELECT al.*, t.full_name AS performer_name
        FROM audit_logs al
        JOIN teachers t ON al.performed_by = t.id
        WHERE 1=1
    """
    count_q = "SELECT COUNT(*) FROM audit_logs al WHERE 1=1"
    params, count_params, idx = [], [], 1
    filters = ""

    if action:
        filters += f" AND al.action = ${idx}"
        params.append(action); count_params.append(action); idx += 1
    if performed_by:
        filters += f" AND al.performed_by = ${idx}"
        params.append(performed_by); count_params.append(performed_by); idx += 1
    if date_from:
        filters += f" AND al.performed_at >= ${idx}::TIMESTAMPTZ"
        params.append(date_from); count_params.append(date_from); idx += 1
    if date_to:
        filters += f" AND al.performed_at <= (${idx}::DATE + INTERVAL '1 day')"
        params.append(date_to); count_params.append(date_to); idx += 1
    if search:
        filters += f" AND (al.details::TEXT ILIKE ${idx} OR t.full_name ILIKE ${idx})"
        params.append(f"%{search}%"); count_params.append(f"%{search}%"); idx += 1

    query += filters + f" ORDER BY al.performed_at DESC LIMIT ${idx} OFFSET ${idx + 1}"
    count_q += filters
    total = await db.fetchval(count_q, *count_params)
    params.extend([page_size, (page - 1) * page_size])
    rows = await db.fetch(query, *params)

    items = [
        {
            "id": str(r["id"]),
            "action": r["action"],
            "details": dict(r["details"]) if r["details"] else {},
            "performed_by": str(r["performed_by"]),
            "performer_name": r["performer_name"],
            "performed_at": r["performed_at"].isoformat(),
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": max(1, -(-total // page_size))}
