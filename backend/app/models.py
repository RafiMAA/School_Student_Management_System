"""Pydantic models for request/response schemas."""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date, datetime
from uuid import UUID


# ============================================================
# Auth
# ============================================================

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    role: str
    teacher_id: str
    full_name: str

class UserProfile(BaseModel):
    id: str
    full_name: str
    email: str
    contact: str
    address: Optional[str] = None
    role: str
    assigned_class: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


# ============================================================
# Academic Years
# ============================================================

class AcademicYearCreate(BaseModel):
    year_label: str
    start_date: date

class AcademicYearUpdateLabel(BaseModel):
    year_label: str

class AcademicYearResponse(BaseModel):
    id: str
    year_label: str
    start_date: date
    end_date: Optional[date] = None
    is_current: bool
    created_at: datetime


# ============================================================
# Classes
# ============================================================

class ClassCreate(BaseModel):
    grade: int = Field(ge=1, le=11)
    medium: Literal["Sinhala", "Tamil"]
    gender_type: Literal["Mixed", "Boys", "Girls"]
    teacher_id: Optional[str] = None

class ClassUpdate(BaseModel):
    grade: Optional[int] = Field(default=None, ge=1, le=11)
    medium: Optional[Literal["Sinhala", "Tamil"]] = None
    teacher_id: Optional[str] = None
    gender_type: Optional[Literal["Mixed", "Boys", "Girls"]] = None

class ClassResponse(BaseModel):
    id: str
    grade: int
    medium: str
    gender_type: str
    academic_year_id: str
    teacher_id: Optional[str] = None
    teacher_name: Optional[str] = None
    total_students: int = 0
    name: str  # computed: "Grade X Medium GenderType"
    created_at: datetime


# ============================================================
# Students
# ============================================================

class StudentCreate(BaseModel):
    full_name: str
    gender: Literal["Male", "Female"]
    date_of_birth: date
    parent_name: str
    parent_name_2: Optional[str] = None
    parent_contact: str
    parent_contact_2: Optional[str] = None
    medium: Literal["Sinhala", "Tamil"]
    current_grade: int = Field(ge=1, le=11)
    current_class_id: Optional[str] = None
    joined_date: date

class AlumniCreate(BaseModel):
    full_name: str
    gender: Literal["Male", "Female"]
    date_of_birth: date
    parent_name: str
    parent_name_2: Optional[str] = None
    parent_contact: str
    parent_contact_2: Optional[str] = None
    own_contact: Optional[str] = None
    medium: Literal["Sinhala", "Tamil"]
    joined_date: date
    graduation_year: str

class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[Literal["Male", "Female"]] = None
    date_of_birth: Optional[date] = None
    parent_name: Optional[str] = None
    parent_name_2: Optional[str] = None
    parent_contact: Optional[str] = None
    parent_contact_2: Optional[str] = None
    medium: Optional[Literal["Sinhala", "Tamil"]] = None
    current_grade: Optional[int] = Field(default=None, ge=1, le=11)
    current_class_id: Optional[str] = None
    own_contact: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    registration_number: str
    full_name: str
    gender: str
    date_of_birth: date
    parent_name: str
    parent_name_2: Optional[str] = None
    parent_contact: str
    parent_contact_2: Optional[str] = None
    own_contact: Optional[str] = None
    medium: str
    current_grade: int
    current_class_id: Optional[str] = None
    class_name: Optional[str] = None
    status: str
    joined_date: date
    graduation_year: Optional[str] = None
    created_at: datetime

class StudentTransfer(BaseModel):
    target_class_id: str

class StudentGraduate(BaseModel):
    graduation_year: str


# ============================================================
# Attendance
# ============================================================

class AttendanceRecord(BaseModel):
    student_id: str
    status: Literal["Present", "Absent"]

class AttendanceBulkSubmit(BaseModel):
    class_id: str
    date: date
    records: list[AttendanceRecord]

class AttendanceSummary(BaseModel):
    total_students: int
    total_teachers: int
    total_classes: int
    current_academic_year: str
    total_alumnis: int = 0
    total_present: int
    total_absent: int
    overall_percentage: float
    date: str
    classes_submitted: int
    classes_total: int
    classes: list[dict] = []  # per-class attendance data for dashboard grid

class ClassAttendanceStatus(BaseModel):
    class_id: str
    class_name: str
    submitted: bool
    present: int = 0
    absent: int = 0
    percentage: float = 0.0


# ============================================================
# Promotion
# ============================================================

class PromotionRuleCreate(BaseModel):
    from_class_id: str
    male_to_class_id: Optional[str] = None
    female_to_class_id: Optional[str] = None

class PromotionRuleUpdate(BaseModel):
    male_to_class_id: Optional[str] = None
    female_to_class_id: Optional[str] = None

class PromotionRuleResponse(BaseModel):
    id: str
    from_class_id: str
    from_class_name: str
    male_to_class_id: Optional[str] = None
    male_to_class_name: Optional[str] = None
    female_to_class_id: Optional[str] = None
    female_to_class_name: Optional[str] = None
    academic_year_id: str

class PromotionPreviewRow(BaseModel):
    student_id: str
    student_name: str
    gender: str
    current_class: str
    target_class: str
    action: Literal["PROMOTE", "GRADUATE"]

class PromotionExecute(BaseModel):
    academic_year_id: str
    start_date: Optional[str] = None

class PromotionResult(BaseModel):
    promoted: int
    graduated: int
    errors: list[str]


# ============================================================
# Teachers
# ============================================================

class TeacherCreate(BaseModel):
    full_name: str
    contact: str
    address: Optional[str] = None
    email: str
    password: str
    role: Literal["Principal", "Admin", "Teacher", "Super Admin"] = "Teacher"
    assigned_classes: Optional[list[str]] = None

class TeacherUpdate(BaseModel):
    full_name: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    role: Optional[Literal["Principal", "Admin", "Teacher", "Super Admin"]] = None
    assigned_classes: Optional[list[str]] = None

class TeacherResponse(BaseModel):
    id: str
    full_name: str
    contact: str
    address: Optional[str] = None
    email: str
    role: str
    assigned_class: Optional[str] = None
    assigned_class_ids: Optional[list[str]] = None
    created_at: datetime

class PasswordReset(BaseModel):
    new_password: str


# ============================================================
# Audit Logs
# ============================================================

class AuditLogResponse(BaseModel):
    id: str
    action: str
    details: dict
    performed_by: str
    performer_name: str
    performed_at: datetime


# ============================================================
# Import
# ============================================================

class ImportValidationError(BaseModel):
    row: int
    field: str
    message: str

class ImportResult(BaseModel):
    valid: int
    imported: int
    skipped: int
    errors: list[ImportValidationError]


# ============================================================
# Student Achievements
# ============================================================

class AchievementCreate(BaseModel):
    achievement_text: str

class AchievementResponse(BaseModel):
    id: str
    student_id: str
    academic_year_id: str
    academic_year_label: str
    grade: int
    achievement_text: str
    created_by: str
    created_by_name: str
    created_at: datetime
    can_delete: bool = False


# ============================================================
# Pagination wrapper
# ============================================================

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
