import unittest
import base64

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.routes.notification_routes import derive_vapid_public_key, group_missing_classes_by_teacher


class NotificationTargetTests(unittest.TestCase):
    def test_derives_browser_public_key_from_raw_vapid_private_key(self):
        private_key = ec.generate_private_key(ec.SECP256R1())
        private_value = private_key.private_numbers().private_value.to_bytes(32, "big")
        encoded_private = base64.urlsafe_b64encode(private_value).rstrip(b"=").decode()
        expected_public = base64.urlsafe_b64encode(
            private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        ).rstrip(b"=").decode()

        self.assertEqual(derive_vapid_public_key(encoded_private), expected_public)

    def test_rejects_invalid_vapid_private_key(self):
        self.assertEqual(derive_vapid_public_key("not-a-private-key"), "")

    def test_groups_only_assigned_missing_classes(self):
        missing = [
            {"teacher_id": "teacher-a", "class_name": "Grade 8 Sinhala Boys"},
            {"teacher_id": "teacher-a", "class_name": "Grade 9 Sinhala Girls"},
            {"teacher_id": "teacher-b", "class_name": "Grade 10 Tamil Mixed"},
            {"teacher_id": None, "class_name": "Grade 11 Tamil Boys"},
        ]
        self.assertEqual(group_missing_classes_by_teacher(missing), {
            "teacher-a": ["Grade 8 Sinhala Boys", "Grade 9 Sinhala Girls"],
            "teacher-b": ["Grade 10 Tamil Mixed"],
        })

    def test_submitted_classes_are_not_added_by_the_rule(self):
        # The database query supplies only missing classes. An empty result must
        # therefore produce no teacher notifications.
        self.assertEqual(group_missing_classes_by_teacher([]), {})


if __name__ == "__main__":
    unittest.main()
