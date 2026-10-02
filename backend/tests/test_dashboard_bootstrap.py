import unittest
from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app import cache
from app.auth import get_current_user
from app.database import get_db
from app.main import app
from app.routes import attendance_routes, dashboard_routes


class DashboardRegressionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        cache._cache.clear()
        self.conn = MagicMock()
        self.conn.fetch = AsyncMock(return_value=[])
        self.conn.fetchrow = AsyncMock(side_effect=self.fetchrow)
        self.db = MagicMock()
        self.db.acquire.return_value.__aenter__ = AsyncMock(return_value=self.conn)
        self.db.fetchval = AsyncMock(return_value='year-1')
        self.user = {'id': 'admin-1', 'full_name': 'Admin', 'role': 'Admin'}

    def tearDown(self):
        cache._cache.clear()

    async def fetchrow(self, query, *args):
        if 'FROM admin_users' in query:
            return {'teacher_id': None}
        # Model the column names returned by the cached and uncached SELECTs.
        year_key = 'ay_id' if 'AS ay_id' in query else 'id'
        return {
            year_key: 'year-1', 'year_label': '2026',
            'start_date': date(2026, 1, 1), 'end_date': None,
            'is_current': True, 'created_at': datetime(2026, 1, 1),
            'student_count': 10, 'teacher_count': 2, 'class_count': 1,
            'year_label_count': '2026', 'alumni_count': 0,
        }

    async def test_default_sunday_across_month_year_and_leap_boundaries(self):
        for today, expected in [
            (date(2026, 10, 2), date(2026, 9, 27)),
            (date(2026, 1, 1), date(2025, 12, 28)),
            (date(2024, 3, 1), date(2024, 2, 25)),
            (date(2026, 10, 4), date(2026, 10, 4)),
        ]:
            with self.subTest(today=today):
                with patch.object(dashboard_routes, 'date') as clock:
                    clock.today.return_value = today
                    result = await dashboard_routes.dashboard_bootstrap(db=self.db, user=self.user)
                self.assertEqual(result['summary'].date, str(expected))
                self.assertEqual(result['academic_year'].id, 'year-1')
                self.conn.fetch.assert_awaited_with(unittest.mock.ANY, expected, 'year-1')
                # The bootstrap populated the shared summary caches.
                with patch.object(attendance_routes, 'date') as clock:
                    clock.today.return_value = today
                    summary = await attendance_routes.attendance_summary(db=self.db, _user=self.user)
                self.assertEqual(summary.date, str(expected))
                self.conn.fetch.assert_awaited_with(unittest.mock.ANY, expected, 'year-1')

    async def test_repeat_admin_load_with_warm_cache(self):
        for _ in range(2):
            result = await dashboard_routes.dashboard_bootstrap(
                attendance_date='2026-09-20', db=self.db, user=self.user,
            )
            self.assertEqual(result['academic_year'].id, 'year-1')
            self.assertEqual(result['summary'].total_students, 10)
            self.assertEqual(result['summary'].date, '2026-09-20')


class CorsRegressionTests(unittest.TestCase):
    def test_unhandled_errors_keep_cors_for_allowed_origins_only(self):
        async def broken_db():
            raise RuntimeError('simulated database failure')

        api = app.app
        previous = api.dependency_overrides.copy()
        api.dependency_overrides[get_db] = broken_db
        api.dependency_overrides[get_current_user] = lambda: {'id': 'admin-1'}
        try:
            # No lifespan: these tests must never connect to the real database.
            client = TestClient(app, raise_server_exceptions=False)
            self.addCleanup(client.close)
            for origin, allowed in [
                ('https://ahadiya-student-management-system.vercel.app', True),
                ('https://ahadiya-student-management-system-preview.vercel.app', True),
                ('https://untrusted.example', False),
            ]:
                with self.subTest(origin=origin):
                    response = client.get('/api/dashboard/bootstrap', headers={'Origin': origin})
                    self.assertEqual(response.status_code, 500)
                    self.assertEqual(response.headers.get('access-control-allow-origin'), origin if allowed else None)
        finally:
            api.dependency_overrides = previous
