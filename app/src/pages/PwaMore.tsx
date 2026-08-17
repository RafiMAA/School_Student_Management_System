import { Award, ChevronRight, FileText, GitBranch, GraduationCap, Settings, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function PwaMore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = ['Principal', 'Admin', 'Super Admin'].includes(user?.role || '');
  const isSuperAdmin = user?.role === 'Super Admin';
  const initials = (user?.fullName || 'User').split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const items = [
    { title: 'My Profile', text: 'Personal details', href: '/profile', icon: UserCircle, show: true },
    { title: 'Teachers', text: 'Staff accounts and assignments', href: '/admin/teachers', icon: GraduationCap, show: true },
    { title: 'Alumni', text: 'Graduated students', href: '/students/alumni', icon: Award, show: true },
    { title: 'Promotion Rules', text: 'Configure class progression', href: '/academic-year/rules', icon: GitBranch, show: isSuperAdmin },
    { title: 'Audit Logs', text: 'Review system activity', href: '/admin/audit-logs', icon: FileText, show: isAdmin },
    { title: 'Settings', text: 'Appearance, security and session', href: '/settings', icon: Settings, show: true },
  ];

  return (
    <div className="pwa-native-page pwa-more-page">
      <div className="pwa-page-heading"><h1>More</h1><p>Administration and account</p></div>
      <section className="pwa-profile-card">
        <div className="pwa-avatar">{initials}</div>
        <h2>{user?.fullName || 'User'}</h2>
        <p>{user?.role || 'Guest'}</p>
      </section>
      <section className="pwa-menu-card">
        {items.filter(item => item.show).map(({ title, text, href, icon: Icon }) => (
          <button type="button" key={href} onClick={() => navigate(href)}>
            <span className="pwa-menu-icon"><Icon /></span>
            <span><strong>{title}</strong><small>{text}</small></span>
            <ChevronRight className="pwa-chevron" />
          </button>
        ))}
      </section>
    </div>
  );
}
