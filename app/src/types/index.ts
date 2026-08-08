export interface Student {
  id: string;
  registration_number: string;
  full_name: string;
  gender: 'Male' | 'Female';
  date_of_birth: string;
  parent_name: string;
  parent_name_2?: string;
  parent_contact: string;
  parent_contact_2?: string;
  own_contact?: string;
  medium: 'Sinhala' | 'Tamil';
  current_grade: string;
  current_class_id?: string;
  class_name?: string; // frontend convenience
  joined_date: string;
  status: 'Active' | 'Alumni' | 'Inactive';
  graduation_year?: string;
}

export interface Teacher {
  id: string;
  full_name: string;
  contact: string;
  username: string;
  assigned_class?: string;
  assigned_class_ids?: string[];
  role: 'Principal' | 'Admin' | 'Teacher' | 'Super Admin';
  address?: string;
  created_at?: string;
}

export interface Class {
  id: string;
  grade: string;
  medium: 'Sinhala' | 'Tamil';
  gender_type: 'Mixed' | 'Boys' | 'Girls';
  academic_year_id: string;
  teacher_id?: string;
  is_active: boolean;
  name?: string; // frontend convenience
  total_students?: number;
  teacher_name?: string;
}

export interface AttendanceRecord {
  id: string;
  attendance_date: string;
  class_id: string;
  status: 'Present' | 'Absent';
  student_id: string;
  student_name?: string;
  registration_number?: string;
}

export interface AttendanceSummaryRow {
  id: string;
  date: string;
  class_id: string;
  className: string;
  present: number;
  absent: number;
  percentage: number;
  submitted: boolean;
  submittedBy?: string;
}

export interface PromotionRule {
  id: string;
  from_class_id: string;
  male_to_class_id: string;
  female_to_class_id: string;
  academic_year_id: string;
  from_class_name?: string;
  male_to_class_name?: string;
  female_to_class_name?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: any;
  performed_by: string;
  created_at: string;
  user_name?: string;
}

export type UserRole = 'Principal' | 'Admin' | 'Teacher' | 'Super Admin';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  teacherId: string | null;
}

export interface User {
  id: string;
  full_name: string;
  username: string;
  role: 'Principal' | 'Admin' | 'Teacher' | 'Super Admin';
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface PromotionPreviewRow {
  student_id: string;
  student_name: string;
  gender: string;
  current_class: string;
  target_class: string | null;
  action: 'PROMOTE' | 'GRADUATE' | 'NONE';
}

export interface StudentAchievement {
  id: string;
  student_id: string;
  academic_year_id: string;
  academic_year_label: string;
  grade: number;
  achievement_text: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  can_delete: boolean;
}
