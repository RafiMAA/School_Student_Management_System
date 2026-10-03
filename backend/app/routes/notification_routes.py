import asyncio
import base64
import json
import logging
import secrets
from collections import defaultdict
from datetime import date, datetime
from typing import Literal
from zoneinfo import ZoneInfo

import asyncpg
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, load_pem_private_key

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import PushSubscriptionRequest, PushUnsubscribeRequest

logger = logging.getLogger(__name__)
router = APIRouter()
COLOMBO = ZoneInfo("Asia/Colombo")


def derive_vapid_public_key(private_key: str) -> str:
    """Return the browser-safe public key for a raw or PEM VAPID private key."""
    value = private_key.strip()
    if not value:
        return ""
    try:
        if "BEGIN" in value:
            key = load_pem_private_key(value.encode(), password=None)
        else:
            padded = value + "=" * (-len(value) % 4)
            raw = base64.urlsafe_b64decode(padded)
            if len(raw) != 32:
                return ""
            key = ec.derive_private_key(int.from_bytes(raw, "big"), ec.SECP256R1())
        public_bytes = key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        return base64.urlsafe_b64encode(public_bytes).rstrip(b"=").decode()
    except (TypeError, ValueError):
        return ""


def group_missing_classes_by_teacher(rows) -> dict:
    grouped = defaultdict(list)
    for row in rows:
        if row["teacher_id"]:
            grouped[row["teacher_id"]].append(row["class_name"])
    return dict(grouped)


@router.get("/config")
async def notification_config():
    settings = get_settings()
    public_key = derive_vapid_public_key(settings.vapid_private_key)
    configured = bool(public_key and settings.vapid_claim_email)
    return {
        "web_push_configured": configured,
        # A VAPID public key is intentionally public. The private key never
        # leaves the backend environment.
        "vapid_public_key": public_key if configured else None,
    }


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
            timeout=15,
        )
        return True
    except Exception:
        return False


class _DeliveryFailed(Exception):
    pass


async def _notify_user(db, user_id, attendance_date, phase, title, body, data) -> bool:
    # Commit the deduplication record only after a provider accepts the push.
    # A failed send or process shutdown rolls back the claim, allowing retries.
    # The unique constraint also serializes concurrent backend workers.
    try:
        async with db.acquire() as conn:
            async with conn.transaction():
                subscriptions = await conn.fetch(
                    "SELECT id, platform, device_key, subscription FROM push_subscriptions WHERE user_id = $1 AND enabled = TRUE",
                    user_id,
                )
                if not subscriptions:
                    return False
                claimed = await conn.fetchval(
                    """INSERT INTO notification_dispatches (attendance_date, phase, user_id)
                       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id""",
                    attendance_date, phase, user_id,
                )
                if not claimed:
                    return False
                results = await asyncio.gather(
                    *(_send(s, title, body, data) for s in subscriptions),
                    return_exceptions=True,
                )
                if not any(result is True for result in results):
                    raise _DeliveryFailed()
        return True
    except _DeliveryFailed:
        logger.warning("Reminder delivery failed; will retry: phase=%s user=%s", phase, user_id)
        return False


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

    return await dispatch_attendance_reminders(db, phase, datetime.now(COLOMBO).date())


async def dispatch_attendance_reminders(db, phase: str, today: date):
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

    limit = asyncio.Semaphore(5)

    async def deliver(message):
        user_id, title, body, data = message
        async with limit:
            try:
                return await _notify_user(db, user_id, today, phase, title, body, data)
            except Exception:
                # Do not log provider exceptions, which can include device tokens.
                logger.error("Reminder dispatch failed: phase=%s user=%s", phase, user_id)
                return False

    sent = sum(await asyncio.gather(*(deliver(message) for message in messages)))
    return {"sent": sent, "missing_classes": len(missing)}
