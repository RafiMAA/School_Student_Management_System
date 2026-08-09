import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  X,
  
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  MoreVertical
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import AppearanceModal from './AppearanceModal';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    name: 'Attendance',
    icon: ClipboardCheck,
    children: [
      { name: 'Mark Attendance', href: '/attendance/mark' },
      { name: 'Attendance History', href: '/attendance/history' },
    ],
  },
  {
    name: 'Students',
    icon: Users,
    children: [
      { name: 'Student List', href: '/students' },
      { name: 'Add Student', href: '/students/add' },
      { name: 'Import via Excel', href: '/classes/import' },
      { name: 'Alumni', href: '/students/alumni' },
    ],
  },
  {
    name: 'Classes',
    icon: BookOpen,
    allowedRoles: ['Principal', 'Admin', 'Super Admin'],
    children: [
      { name: 'Class List', href: '/classes' },
      { name: 'Create Class', href: '/classes/create' },
    ],
  },
  {
    name: 'Academic Year',
    icon: GraduationCap,
    allowedRoles: ['Super Admin'],
    children: [
      { name: 'Manage Year', href: '/academic-year/manage' },
      { name: 'Promotion Rules', href: '/academic-year/rules' },
      { name: 'Promotion Preview', href: '/academic-year/preview' },
    ],
  },
  {
    name: 'Administration',
    icon: ShieldCheck,
    allowedRoles: ['Principal', 'Admin', 'Super Admin'],
    children: [
      { name: 'Teachers', href: '/admin/teachers' },
      { name: 'Audit Logs', href: '/admin/audit-logs' },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isMobileSidebarOpen, setMobileSidebarOpen } = useApp();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    if (logout) logout();
    navigate('/login');
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isGroupActive = (item: typeof navigation[0]) => {
    if (!item.children) return false;
    return item.children.some(child => location.pathname === child.href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0">
          <img src="/logo.svg" alt="Ahadiya School" className="w-8 h-8 object-contain" />
        </div>
        <div className="min-w-0">
          <h2 className="text-white font-semibold text-sm tracking-tight whitespace-nowrap">Al-Meera Ahadiya School</h2>
          <p className="text-slate-300 text-[11px] whitespace-nowrap">Ahadiya Management System</p>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="lg:hidden ml-auto text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navigation.filter(item => !('allowedRoles' in item) || (user && item.allowedRoles?.includes(user.role))).map((item) => {
          if (!item.children) {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href!}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive(item.href!)
                    ? 'bg-slate-800 text-white border-l-4 border-emerald-500'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                {item.name}
              </NavLink>
            );
          }

          const Icon = item.icon;
          const isExpanded = expandedGroups.includes(item.name) || isGroupActive(item);

          return (
            <div key={item.name}>
              <button
                onClick={() => toggleGroup(item.name)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isGroupActive(item)
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                } hover:bg-slate-800`}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                <span className="flex-1 text-left">{item.name}</span>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700 pl-3">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.href}
                      onClick={() => setMobileSidebarOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                        isActive(child.href)
                          ? 'bg-slate-800 text-white border-l-4 border-emerald-500'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {child.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-slate-700 relative" ref={dropdownRef}>
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold uppercase shrink-0">
              {user?.fullName?.substring(0, 2) || 'US'}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-white text-sm font-medium truncate">{user?.fullName || 'User'}</p>
              <p className="text-slate-400 text-xs">{user?.role || 'Guest'}</p>
            </div>
          </div>
          <MoreVertical className="w-4 h-4 text-slate-500 shrink-0" />
        </button>

        {dropdownOpen && (
          <div className="absolute bottom-[calc(100%-8px)] left-4 right-4 mb-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button onClick={() => { setDropdownOpen(false); navigate('/profile'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
              <User className="w-4 h-4" /> My Profile
            </button>
            <button onClick={(e) => { e.stopPropagation(); setAppearanceModalOpen(true); setDropdownOpen(false); }} className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} Appearance
              </div>
              <span className="text-xs text-slate-500 capitalize">{theme}</span>
            </button>
            <button onClick={() => { setDropdownOpen(false); navigate('/settings'); setMobileSidebarOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <div className="border-t border-slate-700 mt-1 pt-1">
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 lg:hidden ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:bg-slate-900">
        {sidebarContent}
      </aside>
      <AppearanceModal isOpen={appearanceModalOpen} onClose={() => setAppearanceModalOpen(false)} />
    </>
  );
}
