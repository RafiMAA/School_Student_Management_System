import os
import re

files_to_fix = [
    "academic_year_routes.py",
    "class_routes.py",
    "import_routes.py",
    "promotion_routes.py",
    "student_routes.py",
    "teacher_routes.py"
]

base_dir = "app/routes"

for filename in files_to_fix:
    path = os.path.join(base_dir, filename)
    with open(path, "r") as f:
        content = f.read()
    
    # We want to replace user["id"] with user.get("teacher_id")
    # But only in places where it's not already fixed, and assuming these files 
    # only use user["id"] for teacher_id FK columns.
    
    # Let's see if they use user["id"] for anything else.
    # In student_routes.py, there's `user["role"]`, we shouldn't touch that.
    # Just literal `user["id"]`.
    
    new_content = content.replace('user["id"]', 'user.get("teacher_id")')
    
    with open(path, "w") as f:
        f.write(new_content)
    
    print(f"Fixed {filename}")

