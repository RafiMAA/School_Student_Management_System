import unittest

from app.routes.notification_routes import group_missing_classes_by_teacher


class NotificationTargetTests(unittest.TestCase):
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
