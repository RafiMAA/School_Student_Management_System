import { Moon, Sun, Menu, ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppearanceModal from './AppearanceModal';

const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/profile': 'My Profile',
  '/settings': 'Settings',
  '/attendance/mark': 'Mark Attendance',
  '/attendance/history': 'Attendance History',
  '/students': 'Student List',
  '/students/add': 'Add Student',
  '/students/alumni': 'Alumni',
  '/classes': 'Class List',
  '/classes/create': 'Create Class',
  '/classes/import': 'Import via Excel',
  '/academic-year/rules': 'Promotion Rules',
  '/academic-year/preview': 'Promotion Preview',
  '/admin/teachers': 'Teachers',
  '/admin/audit-logs': 'Audit Logs',
};

export default function Header() {
  const { setMobileSidebarOpen, currentAcademicYear } = useApp();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = breadcrumbMap[location.pathname] || 'Dashboard';

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{pageTitle}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Ahadiya Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden md:inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
          Academic Year {currentAcademicYear}
        </span>



        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in duration-150">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.fullName || 'User'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role || 'Guest'}</p>
              </div>
              <button onClick={() => { setDropdownOpen(false); navigate('/profile'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                <User className="w-4 h-4" /> My Profile
              </button>
              <button onClick={(e) => { e.stopPropagation(); setAppearanceModalOpen(true); setDropdownOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Appearance
                </div>
                <span className="text-xs text-slate-400 capitalize">{theme}</span>
              </button>
              <button onClick={() => { setDropdownOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                <Settings className="w-4 h-4" /> Settings
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 mt-1">
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
      <AppearanceModal isOpen={appearanceModalOpen} onClose={() => setAppearanceModalOpen(false)} />
    </>
  );
}
