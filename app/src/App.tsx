import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, ProtectedRoute, RoleProtectedRoute } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';

// Eagerly load hot-path pages (login + dashboard)
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';

// Lazy load everything else — these only download when the user navigates to them
const MarkAttendance = lazy(() => import('@/pages/MarkAttendance'));
const AttendanceHistory = lazy(() => import('@/pages/AttendanceHistory'));
const StudentList = lazy(() => import('@/pages/StudentList'));
const AddStudent = lazy(() => import('@/pages/AddStudent'));
const EditStudent = lazy(() => import('@/pages/EditStudent'));
const StudentProfile = lazy(() => import('@/pages/StudentProfile'));
const Alumni = lazy(() => import('@/pages/Alumni'));
const ClassList = lazy(() => import('@/pages/ClassList'));
const CreateClass = lazy(() => import('@/pages/CreateClass'));
const EditClass = lazy(() => import('@/pages/EditClass'));
const ExcelImport = lazy(() => import('@/pages/ExcelImport'));
const PromotionRules = lazy(() => import('@/pages/PromotionRules'));
const PromotionPreview = lazy(() => import('@/pages/PromotionPreview'));
const Teachers = lazy(() => import('@/pages/Teachers'));
const TeacherProfile = lazy(() => import('@/pages/TeacherProfile'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const PwaAttendance = lazy(() => import('@/pages/PwaAttendance'));
const PwaMore = lazy(() => import('@/pages/PwaMore'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/attendance" element={<PwaAttendance />} />
                  <Route path="/attendance/mark" element={<MarkAttendance />} />
                  <Route path="/attendance/history" element={<AttendanceHistory />} />
                  <Route path="/students" element={<StudentList />} />
                  <Route path="/students/add" element={<AddStudent />} />
                  <Route path="/students/edit/:id" element={<EditStudent />} />
                  <Route path="/students/alumni/:id" element={<StudentProfile />} />
                  <Route path="/students/:id" element={<StudentProfile />} />
                  <Route path="/students/alumni" element={<Alumni />} />
                  <Route path="/classes" element={<ClassList />} />
                  <Route path="/classes/create" element={<CreateClass />} />
                  <Route path="/classes/edit/:id" element={<EditClass />} />
                  <Route path="/classes/import" element={<ExcelImport />} />
                  <Route path="/academic-year/rules" element={<PromotionRules />} />
                  <Route path="/academic-year/preview" element={<PromotionPreview />} />
                  <Route path="/admin/teachers" element={<RoleProtectedRoute allowedRoles={['Principal', 'Admin', 'Teacher', 'Super Admin']}><Teachers /></RoleProtectedRoute>} />
                  <Route path="/admin/teachers/:id" element={<RoleProtectedRoute allowedRoles={['Principal', 'Admin', 'Super Admin']}><TeacherProfile /></RoleProtectedRoute>} />
                  <Route path="/admin/audit-logs" element={<RoleProtectedRoute allowedRoles={['Principal', 'Admin', 'Super Admin']}><AuditLogs /></RoleProtectedRoute>} />
                  <Route path="/more" element={<PwaMore />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}
