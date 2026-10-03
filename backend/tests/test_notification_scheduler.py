import asyncio
import unittest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.routes.notification_routes import COLOMBO, _notify_user, _DeliveryFailed
from app.services.notification_scheduler import due_reminder_phases, run_notification_scheduler


class ScheduleTests(unittest.TestCase):
    def test_sri_lanka_schedule_and_retry_boundaries(self):
        for phase, hour, minute in [('start', 8, 30), ('teacher_missing', 10, 25), ('admin_missing', 10, 40)]:
            now = datetime(2026, 10, 4, hour, minute, tzinfo=COLOMBO)
            self.assertEqual(due_reminder_phases(now), [phase])
            self.assertEqual(due_reminder_phases(now.astimezone(timezone.utc)), [phase])
        cases = [(8, 29, []), (8, 44, ['start']), (8, 45, []),
                 (10, 24, []), (10, 39, ['teacher_missing']), (10, 54, ['admin_missing']),
                 (10, 55, []), (14, 0, [])]
        for hour, minute, expected in cases:
            self.assertEqual(due_reminder_phases(datetime(2026, 10, 4, hour, minute, tzinfo=COLOMBO)), expected)

    def test_no_reminders_on_other_days(self):
        for day in [2, 3, 5]:
            self.assertEqual(due_reminder_phases(datetime(2026, 10, day, 8, 30, tzinfo=COLOMBO)), [])


class DeliveryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.conn = AsyncMock()
        self.transaction = AsyncMock()
        self.transaction.__aexit__.return_value = False
        self.conn.transaction = MagicMock(return_value=self.transaction)
        self.pool = MagicMock()
        self.pool.acquire.return_value.__aenter__ = AsyncMock(return_value=self.conn)
        self.pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)
        self.conn.fetch.return_value = [{'platform': 'expo'}, {'platform': 'web'}]
        self.conn.fetchval.return_value = 'dispatch-id'

    async def notify(self):
        return await _notify_user(self.pool, 'user-id', date(2026, 10, 4), 'start', 'Title', 'Body', {})

    async def test_duplicate_does_not_send(self):
        self.conn.fetchval.return_value = None
        with patch('app.routes.notification_routes._send', new_callable=AsyncMock) as send:
            self.assertFalse(await self.notify())
            send.assert_not_called()

    async def test_failure_rolls_back_claim_and_can_retry(self):
        with patch('app.routes.notification_routes._send', new_callable=AsyncMock, side_effect=TimeoutError):
            self.assertFalse(await self.notify())
        self.assertIs(self.transaction.__aexit__.call_args.args[0], _DeliveryFailed)
        with patch('app.routes.notification_routes._send', new_callable=AsyncMock, return_value=True):
            self.assertTrue(await self.notify())
        self.assertIsNone(self.transaction.__aexit__.call_args.args[0])

    async def test_one_accepted_device_commits_despite_another_failure(self):
        with patch('app.routes.notification_routes._send', new_callable=AsyncMock, side_effect=[True, TimeoutError()]):
            self.assertTrue(await self.notify())
        self.assertIsNone(self.transaction.__aexit__.call_args.args[0])

    async def test_shutdown_rolls_back_claim(self):
        started = asyncio.Event()

        async def blocked_send(*args):
            started.set()
            await asyncio.Event().wait()

        with patch('app.routes.notification_routes._send', side_effect=blocked_send):
            task = asyncio.create_task(self.notify())
            await started.wait()
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertIs(self.transaction.__aexit__.call_args.args[0], asyncio.CancelledError)

    async def test_scheduler_retries_after_error_and_stops_on_shutdown(self):
        clock = MagicMock()
        clock.now.return_value = datetime(2026, 10, 4, 8, 35, tzinfo=COLOMBO)
        with patch('app.services.notification_scheduler.datetime', clock), \
             patch('app.services.notification_scheduler.due_reminder_phases', return_value=['start']), \
             patch('app.services.notification_scheduler.dispatch_attendance_reminders', new_callable=AsyncMock, side_effect=[RuntimeError(), {'sent': 1}]) as dispatch, \
             patch('app.services.notification_scheduler.asyncio.sleep', new_callable=AsyncMock, side_effect=[None, asyncio.CancelledError]):
            with self.assertRaises(asyncio.CancelledError):
                await run_notification_scheduler(self.pool)
        self.assertEqual(dispatch.await_count, 2)


class SchedulerLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_startup_starts_scheduler_and_shutdown_stops_it_before_pool(self):
        from app.main import lifespan

        started = asyncio.Event()
        stopped = asyncio.Event()
        pool = object()

        async def scheduler(db):
            self.assertIs(db, pool)
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                stopped.set()

        async def close():
            self.assertTrue(stopped.is_set())

        with patch('app.main.get_pool', new_callable=AsyncMock, return_value=pool), \
             patch('app.main.close_pool', new_callable=AsyncMock, side_effect=close) as close_pool, \
             patch('app.main.get_settings', return_value=MagicMock(notification_scheduler_enabled=True)), \
             patch('app.main.run_notification_scheduler', side_effect=scheduler):
            async with lifespan(None):
                await asyncio.wait_for(started.wait(), timeout=1)
            close_pool.assert_awaited_once()

    async def test_disabled_scheduler_does_not_start(self):
        from app.main import lifespan

        with patch('app.main.get_pool', new_callable=AsyncMock), \
             patch('app.main.close_pool', new_callable=AsyncMock) as close_pool, \
             patch('app.main.get_settings', return_value=MagicMock(notification_scheduler_enabled=False)), \
             patch('app.main.run_notification_scheduler', new_callable=AsyncMock) as scheduler:
            async with lifespan(None):
                scheduler.assert_not_called()
            close_pool.assert_awaited_once()
