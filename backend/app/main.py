from contextlib import asynccontextmanager
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import get_settings
from app.database import get_pool, close_pool
from app.routes import (
    auth_routes,
    academic_year_routes,
    class_routes,
    student_routes,
    attendance_routes,
    report_routes,
    import_routes,
    promotion_routes,
    teacher_routes,
    audit_routes,
    dashboard_routes,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB pool
    pool = await get_pool()

    # Repair role mismatches created before teacher role updates also changed
    # admin_users. This is idempotent and leaves unlinked system users alone.
    await pool.execute(
        """
        UPDATE admin_users AS au
        SET role = t.role::text, updated_at = NOW()
        FROM teachers AS t
        WHERE au.teacher_id = t.id
          AND au.role IS DISTINCT FROM t.role::text
        """
    )
    yield
    # Shutdown: close DB pool
    await close_pool()


app = FastAPI(
    title="Ahadiya School Management System API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Middleware stack (order matters: outermost first) ──

# 1. Response timing — adds X-Response-Time header so we can measure real latency
@app.middleware("http")
async def add_response_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Response-Time"] = f"{elapsed_ms}ms"
    response.headers["Server-Timing"] = f"total;dur={elapsed_ms}"
    return response

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Response-Time", "Server-Timing"],
)

# 3. Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Register routers
app.include_router(auth_routes.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dashboard_routes.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(academic_year_routes.router, prefix="/api/academic-years", tags=["Academic Years"])
app.include_router(class_routes.router, prefix="/api/classes", tags=["Classes"])
app.include_router(student_routes.router, prefix="/api/students", tags=["Students"])
app.include_router(attendance_routes.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(report_routes.router, prefix="/api/reports", tags=["Reports"])
app.include_router(import_routes.router, prefix="/api/import", tags=["Import"])
app.include_router(promotion_routes.router, prefix="/api/promotion", tags=["Promotion"])
app.include_router(teacher_routes.router, prefix="/api/teachers", tags=["Teachers"])
app.include_router(audit_routes.router, prefix="/api/audit-logs", tags=["Audit Logs"])


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok", "service": "ahadiya-backend"}
