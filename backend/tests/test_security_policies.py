import io
import unittest
import zipfile
from datetime import date

from fastapi import HTTPException
from pydantic import ValidationError

from app.models import AttendanceBulkSubmit
from app.security_policies import (
    MAX_UPLOAD_BYTES,
    can_manage_role,
    validate_upload,
    would_remove_last_super_admin,
)


class RoleHierarchyTests(unittest.TestCase):
    def test_admin_can_manage_teachers_and_admins(self):
        self.assertTrue(can_manage_role("Admin", "Teacher"))
        self.assertTrue(can_manage_role("Admin", "Admin"))
        self.assertFalse(can_manage_role("Admin", "Principal"))
        self.assertFalse(can_manage_role("Admin", "Super Admin"))

    def test_principal_cannot_manage_principal_or_super_admin(self):
        self.assertTrue(can_manage_role("Principal", "Teacher"))
        self.assertTrue(can_manage_role("Principal", "Admin"))
        self.assertFalse(can_manage_role("Principal", "Principal"))
        self.assertFalse(can_manage_role("Principal", "Super Admin"))

    def test_super_admin_cannot_create_or_replace_principal(self):
        self.assertTrue(can_manage_role("Super Admin", "Super Admin"))
        self.assertFalse(can_manage_role("Super Admin", "Principal"))

    def test_last_super_admin_cannot_be_demoted_or_deleted(self):
        self.assertTrue(would_remove_last_super_admin("Super Admin", "Admin", 0))
        self.assertTrue(would_remove_last_super_admin("Super Admin", None, 0))

    def test_super_admin_can_handover_when_another_exists(self):
        self.assertFalse(would_remove_last_super_admin("Super Admin", "Admin", 1))
        self.assertFalse(would_remove_last_super_admin("Super Admin", None, 1))
        self.assertFalse(would_remove_last_super_admin("Admin", "Teacher", 0))


class AttendancePayloadTests(unittest.TestCase):
    def test_requires_at_least_one_record(self):
        with self.assertRaises(ValidationError):
            AttendanceBulkSubmit(class_id="class-a", date=date.today(), records=[])

    def test_limits_submission_size(self):
        records = [
            {"student_id": f"student-{index}", "status": "Present"}
            for index in range(501)
        ]
        with self.assertRaises(ValidationError):
            AttendanceBulkSubmit(class_id="class-a", date=date.today(), records=records)

    def test_accepts_valid_attendance_payload(self):
        payload = AttendanceBulkSubmit(
            class_id="class-a",
            date=date.today(),
            records=[{"student_id": "student-a", "status": "Absent"}],
        )
        self.assertEqual(payload.records[0].status, "Absent")


class UploadValidationTests(unittest.TestCase):
    def test_rejects_empty_and_oversized_uploads(self):
        with self.assertRaises(HTTPException):
            validate_upload(b"", "students.csv")
        with self.assertRaises(HTTPException):
            validate_upload(b"x" * (MAX_UPLOAD_BYTES + 1), "students.csv")

    def test_rejects_fake_xlsx(self):
        with self.assertRaises(HTTPException):
            validate_upload(b"not-a-zip", "students.xlsx")

    def test_accepts_structurally_valid_small_xlsx_archive(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types />")
            archive.writestr("xl/workbook.xml", "<workbook />")
        validate_upload(stream.getvalue(), "students.xlsx")


if __name__ == "__main__":
    unittest.main()
