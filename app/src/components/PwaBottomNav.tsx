import { BookOpen, CalendarDays, Grid2X2, Users, Grip } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Dashboard', href: '/', icon: Grid2X2, match: (path: string) => path === '/' },
  { label: 'Attendance', href: '/attendance', icon: CalendarDays, match: (path: string) => path.startsWith('/attendance') },
  { label: 'Students', href: '/students', icon: Users, match: (path: string) => path.startsWith('/students') && !path.startsWith('/students/alumni') },
  { label: 'Classes', href: '/classes', icon: BookOpen, match: (path: string) => path.startsWith('/classes') },
  { label: 'More', href: '/more', icon: Grip, match: (path: string) => ['/more', '/profile', '/settings', '/students/alumni', '/academic-year', '/admin'].some(prefix => path.startsWith(prefix)) },
];

export default function PwaBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="pwa-bottom-nav" aria-label="Main navigation">
      {tabs.map(({ label, href, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <NavLink key={label} to={href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
