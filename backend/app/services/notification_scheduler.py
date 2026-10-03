"""Sunday reminders driven by the running backend, independently of HTTP traffic."""

import asyncio
import logging
from datetime import datetime, time, timedelta

from app.routes.notification_routes import COLOMBO, dispatch_attendance_reminders

# Inherit Uvicorn's configured handler so startup/status messages appear in Render logs.
logger = logging.getLogger("uvicorn.error.attendance_scheduler")
POLL_SECONDS = 30
RETRY_WINDOW = timedelta(minutes=15)
REMINDERS = (
    ("start", time(8, 30)),
    ("teacher_missing", time(10, 25)),
    ("admin_missing", time(10, 40)),
)


def due_reminder_phases(now: datetime) -> list[str]:
    """Retry/catch up within 15 minutes, never send hours-old reminders."""
    local = now.astimezone(COLOMBO)
    if local.weekday() != 6:
        return []
    return [
        phase for phase, scheduled_time in REMINDERS
        if timedelta(0) <= local - datetime.combine(local.date(), scheduled_time, COLOMBO) < RETRY_WINDOW
    ]


async def run_notification_scheduler(db):
    logger.info("Attendance scheduler started: Sundays 08:30, 10:25, 10:40 Asia/Colombo")
    while True:
        now = datetime.now(COLOMBO)
        for phase in due_reminder_phases(now):
            try:
                result = await dispatch_attendance_reminders(db, phase, now.date())
                logger.info("Attendance scheduler: date=%s phase=%s result=%s", now.date(), phase, result)
            except Exception as error:
                logger.error("Attendance scheduler will retry phase=%s error_type=%s", phase, type(error).__name__)
        await asyncio.sleep(POLL_SECONDS)
