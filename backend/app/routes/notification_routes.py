import asyncio
import json
import secrets
from collections import defaultdict
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

import asyncpg
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import PushSubscriptionRequest, PushUnsubscribeRequest

router = APIRouter()
COLOMBO = ZoneInfo("Asia/Colombo")


def group_missing_classes_by_teacher(rows) -> dict:
    grouped = defaultdict(list)
    for row in rows:
        if row["teacher_id"]:
            grouped[row["teacher_id"]].append(row["class_name"])
    return dict(grouped)


@router.post("/subscriptions")
async def subscribe(
    body: PushSubscriptionRequest,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if body.platform == "web" and not body.subscription:
        raise HTTPException(status_code=400, detail="Web push subscription is required")
    await db.execute(
        """INSERT INTO push_subscriptions (user_id, platform, device_key, subscription, enabled)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT (device_key) DO UPDATE
           SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
               subscription = EXCLUDED.subscription, enabled = TRUE, updated_at = NOW()""",
        user["id"], body.platform, body.device_key, body.subscription,
    )
    return {"enabled": True}


@router.post("/subscriptions/remove")
async def unsubscribe(
    body: PushUnsubscribeRequest,
    db: asyncpg.Pool = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    await db.execute(
        "DELETE FROM push_subscriptions WHERE user_id = $1 AND device_key = $2",
        user["id"], body.device_key,
    )
    return {"enabled": False}


async def _send(subscription: asyncpg.Record, title: str, body: str, data: dict) -> bool:
    if subscription["platform"] == "expo":
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                json={
                    "to": subscription["device_key"], "title": title, "body": body,
                    "sound": "default", "channelId": "attendance-reminders", "data": data,
                },
            )
        if not response.is_success:
            return False
        ticket = response.json().get("data", {})
        return ticket.get("status") == "ok"

    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_claim_email:
        return False
    from pywebpush import webpush
    try:
        await asyncio.to_thread(
            webpush,
            subscription_info=subscription["subscription"],
            data=json.dumps({"title": title, "body": body, "data": data}),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_claim_email},
        )
        return True
    except Exception:
        return False


async def _notify_user(db, user_id, attendance_date, phase, title, body, data) -> bool:
    subscriptions = await db.fetch(
        "SELECT id, platform, device_key, subscription FROM push_subscriptions WHERE user_id = $1 AND enabled = TRUE",
        user_id,
    )
    if not subscriptions:
        return False
    claimed = await db.fetchval(
        """INSERT INTO notification_dispatches (attendance_date, phase, user_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id""",
        attendance_date, phase, user_id,
    )
    if not claimed:
        return False
    results = await asyncio.gather(*(_send(s, title, body, data) for s in subscriptions))
    if not any(results):
        await db.execute("DELETE FROM notification_dispatches WHERE id = $1", claimed)
        return False
    return True


@router.post("/attendance-reminders/{phase}")
async def run_attendance_reminder(
    phase: Literal["start", "teacher_missing", "admin_missing"],
    x_cron_secret: str = Header(default=""),
    db: asyncpg.Pool = Depends(get_db),
):
    settings = get_settings()
    if not settings.notification_cron_secret or not secrets.compare_digest(
        x_cron_secret, settings.notification_cron_secret
    ):
        raise HTTPException(status_code=401, detail="Invalid scheduler secret")

    today = datetime.now(COLOMBO).date()
    if today.weekday() != 6:
        return {"sent": 0, "skipped": "Not Sunday"}

    missing = await db.fetch(
        """SELECT c.id, c.teacher_id,
                  ('Grade ' || c.grade || ' ' || c.medium::text || ' ' || c.gender_type::text) AS class_name
           FROM classes c
           JOIN academic_years ay ON ay.id = c.academic_year_id AND ay.is_current = TRUE
           WHERE c.is_active = TRUE
             AND NOT EXISTS (
                 SELECT 1 FROM attendance a
                 WHERE a.class_id = c.id AND a.attendance_date = $1
             )
           ORDER BY c.medium, c.grade, c.gender_type""",
        today,
    )

    messages = []
    if phase == "start":
        users = await db.fetch("SELECT id FROM admin_users WHERE is_active = TRUE")
        messages = [(u["id"], "Sunday attendance", "Please mark today’s student attendance.", {}) for u in users]
    elif phase == "teacher_missing":
        by_teacher = group_missing_classes_by_teacher(missing)
        for teacher_id, classes in by_teacher.items():
            user_id = await db.fetchval(
                "SELECT id FROM admin_users WHERE teacher_id = $1 AND is_active = TRUE", teacher_id
            )
            if user_id:
                names = ", ".join(classes)
                messages.append((user_id, "Attendance still pending", f"Please submit attendance for {names}.", {"classNames": classes}))
    elif missing:
        names = [row["class_name"] for row in missing]
        admins = await db.fetch(
            "SELECT id FROM admin_users WHERE is_active = TRUE AND role IN ('Admin', 'Principal', 'Super Admin')"
        )
        body = f"Attendance has not been submitted for: {', '.join(names)}."
        messages = [(u["id"], "Classes missing attendance", body, {"classNames": names}) for u in admins]

    sent = 0
    for user_id, title, body, data in messages:
        sent += int(await _notify_user(db, user_id, today, phase, title, body, data))
    return {"sent": sent, "missing_classes": len(missing)}
