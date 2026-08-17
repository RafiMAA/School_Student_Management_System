import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const titles: Record<string, string> = {
  '/profile': 'My Profile',
  '/settings': 'Settings',
  '/attendance/mark': 'Mark Attendance',
  '/attendance/history': 'Attendance History',
  '/students/add': 'Add Student',
  '/students/alumni': 'Alumni',
  '/classes/create': 'Create Class',
  '/classes/import': 'Import Students',
  '/academic-year/rules': 'Promotion Rules',
  '/academic-year/preview': 'Promotion Preview',
  '/admin/teachers': 'Teachers & Staff',
  '/admin/audit-logs': 'Audit Logs',
};

const rootTabs = ['/', '/attendance', '/students', '/classes', '/more'];

export default function PwaHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (rootTabs.includes(pathname)) return null;

  let title = titles[pathname];
  if (!title && pathname.startsWith('/students/edit/')) title = 'Edit Student';
  if (!title && pathname.startsWith('/students/alumni/')) title = 'Alumni Profile';
  if (!title && pathname.startsWith('/students/')) title = 'Student Profile';
  if (!title && pathname.startsWith('/classes/edit/')) title = 'Edit Class';
  if (!title && pathname.startsWith('/admin/teachers/')) title = 'Teacher Profile';
  if (!title) return null;

  return (
    <header className="pwa-stack-header">
      <button type="button" onClick={() => navigate(-1)} aria-label="Go back">
        <ArrowLeft />
      </button>
      <h1>{title}</h1>
    </header>
  );
}
