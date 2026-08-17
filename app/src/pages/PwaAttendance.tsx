import { BarChart3, CheckSquare, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PwaAttendance() {
  const navigate = useNavigate();
  const actions = [
    { title: 'Mark Attendance', text: 'Record or update a Sunday register', icon: CheckSquare, href: '/attendance/mark', tone: 'green' },
    { title: 'Attendance History', text: 'Monthly and yearly student reports', icon: BarChart3, href: '/attendance/history', tone: 'blue' },
  ];

  return (
    <div className="pwa-native-page pwa-attendance-home">
      <div className="pwa-page-heading">
        <h1>Attendance</h1>
        <p>Weekly attendance tools</p>
      </div>
      <div className="pwa-action-list">
        {actions.map(({ title, text, icon: Icon, href, tone }) => (
          <button key={href} type="button" className="pwa-action-card" onClick={() => navigate(href)}>
            <span className={`pwa-action-icon ${tone}`}><Icon /></span>
            <span className="pwa-action-copy"><strong>{title}</strong><small>{text}</small></span>
            <ChevronRight className="pwa-chevron" />
          </button>
        ))}
      </div>
    </div>
  );
}
