export type UserRole = 'Principal' | 'Admin' | 'Teacher' | 'Super Admin';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  teacherId: number | null;
}

export type Role = 'Principal' | 'Admin' | 'Teacher' | 'Super Admin';
export interface User { id: string; full_name: string; username: string; role: Role }

export interface Student { id: string; registration_number: string; full_name: string; gender: 'Male' | 'Female'; date_of_birth: string; parent_name: string; parent_name_2?: string; parent_contact: string; parent_contact_2?: string; own_contact?: string; medium: 'Sinhala' | 'Tamil'; current_grade: string; current_class_id?: string; class_name?: string; joined_date: string; status: 'Active' | 'Alumni' | 'Inactive'; graduation_year?: string }
export interface Teacher { id: string; full_name: string; contact: string; username: string; assigned_class?: string; assigned_class_ids?: string[]; role: Role; address?: string; created_at?: string }
export interface SchoolClass { id: string; grade: string; medium: 'Sinhala' | 'Tamil'; gender_type: 'Mixed' | 'Boys' | 'Girls'; academic_year_id: string; teacher_id?: string; is_active: boolean; name?: string; total_students?: number; teacher_name?: string }
export interface PromotionRule { id: string; from_class_id: string; male_to_class_id: string; female_to_class_id: string; academic_year_id: string; from_class_name?: string; male_to_class_name?: string; female_to_class_name?: string }
export interface PromotionRow { student_id: string; student_name: string; gender: string; current_class: string; target_class: string | null; action: 'PROMOTE' | 'GRADUATE' | 'NONE' }
export interface AuditLog { id: string; action: string; details: unknown; performed_by: string; created_at: string; user_name?: string }
export interface DashboardSummary { total_students: number; total_teachers: number; total_classes: number; current_academic_year: string; total_alumnis: number; total_present: number; total_absent: number; overall_percentage: number; date: string; classes_submitted: number; classes_total: number; classes: { class_id: string; class_name: string; present: number; absent: number; percentage: number; submitted: boolean }[] }
export interface AttendanceReport { sundays: string[]; students: { student_id: string; student_name: string; registration_number: string; attendance: Record<string, 'Present' | 'Absent'>; present_count: number; percentage: number }[]; summary: Record<string, { present: number; total: number }> }
export type RootStackParams = { Login: undefined; Main: undefined };
export type MainTabParams = { DashboardTab: undefined; AttendanceTab: undefined; StudentsTab: undefined; ClassesTab: undefined; MoreTab: undefined };
export type AppStackParams = {
  Dashboard: undefined; AttendanceHome: undefined; MarkAttendance: { classId?: string; date?: string } | undefined; AttendanceHistory: { classId?: string } | undefined;
  Students: undefined; StudentDetail: { id: string }; StudentForm: { id?: string } | undefined; Alumni: undefined;
  Classes: undefined; ClassForm: { id?: string } | undefined; More: undefined; AcademicYear: undefined; PromotionRules: undefined; PromotionPreview: undefined;
  AuditLogs: undefined; Teachers: undefined; TeacherDetail: { id: string }; Profile: undefined; Settings: undefined;
};
