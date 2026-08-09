import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, CheckCircle, XCircle, Eye } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/apiClient';

interface SummaryData {
  total_students: number;
  total_teachers: number;
  total_classes: number;
  current_academic_year: string;
  total_alumnis: number;
  total_present: number;
  total_absent: number;
  overall_percentage: number;
  date: string;
  classes_submitted: number;
  classes_total: number;
  classes: { class_id: string; class_name: string; present: number; absent: number; percentage: number; submitted: boolean }[];
}

interface BootstrapData {
  user: any;
  academic_year: { year_label: string };
  summary: SummaryData;
}
function StatCard({ title, value, icon: Icon, color, onClick }: { title: string; value: string | number; icon: React.ElementType; color: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    emerald: 'border-t-emerald-500', blue: 'border-t-blue-500', amber: 'border-t-amber-500', slate: 'border-t-slate-500',
  };
  const iconColorMap: Record<string, string> = {
    emerald: 'text-emerald-600 bg-emerald-50', blue: 'text-blue-600 bg-blue-50', amber: 'text-amber-600 bg-amber-50', slate: 'text-slate-600 bg-slate-50',
  };
  return (
    <div onClick={onClick} className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 ${colorMap[color]} border-t-4 p-4 sm:p-5 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5' : ''}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div className="order-2 sm:order-1">
          <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-tight">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5 sm:mt-1">{value}</p>
        </div>
        <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 order-1 sm:order-2 ${iconColorMap[color]}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}

function CircularProgress({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#059669' : percentage >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{percentage}%</span>
        <span className="text-xs text-slate-500">Present</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: summary, isLoading: loading, error } = useQuery({
    queryKey: ['dashboard-bootstrap'],
    queryFn: async () => {
      const data = await api.get<BootstrapData>('/dashboard/bootstrap');
      // Pre-seed React Query cache so AppContext doesn't fire a separate /current request
      queryClient.setQueryData(['current-academic-year'], data.academic_year);
      // Persist to localStorage for instant hydration on next page load
      localStorage.setItem('ahadiya_academic_year', JSON.stringify(data.academic_year));
      
      return data.summary;
    },
  });

  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load dashboard data');
    }
  }, [error, addToast]);



  const handleProtectedNavigation = (path: string) => {
    if (user?.role === 'Principal' || user?.role === 'Admin' || user?.role === 'Super Admin') {
      navigate(path);
    } else {
      addToast('error', 'Only admin can access this');
    }
  };

  const handleViewDetails = (classId: string) => {
    navigate(`/attendance/history?class_id=${classId}`);
  };



  if (loading || !summary) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>;
  }

  const getPercentageColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (pct >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Students" value={summary.total_students} icon={Users} color="emerald" onClick={() => navigate('/students')} />
        <StatCard title="Total Teachers" value={summary.total_teachers} icon={GraduationCap} color="blue" onClick={() => handleProtectedNavigation('/admin/teachers')} />
        <StatCard title="Total Classes" value={summary.total_classes} icon={BookOpen} color="amber" onClick={() => handleProtectedNavigation('/classes')} />
        <StatCard title="Total Alumnis" value={summary?.total_alumnis || 0} icon={Users} color="slate" onClick={() => navigate('/students/alumni')} />
      </div>

      {/* Attendance Summary + Completion Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">This Sunday's Attendance</h3>
          <div className="flex items-center gap-6">
            <CircularProgress percentage={summary.overall_percentage} />
            <div className="space-y-3 flex-1">
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Present</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{summary.total_present}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">Absent</span>
                <span className="text-lg font-bold text-red-700 dark:text-red-400">{summary.total_absent}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{summary.date}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sunday Attendance Status</h3>
            <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full">
              {summary.classes_submitted} of {summary.classes_total} classes submitted
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-4">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${summary.classes_total > 0 ? (summary.classes_submitted / summary.classes_total) * 100 : 0}%` }} />
          </div>
          <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-3">
            {[...summary.classes]
              .sort((a, b) => {
                const getGender = (name: string) => name.includes('Mixed') ? 1 : name.includes('Boys') ? 2 : name.includes('Girls') ? 3 : 4;
                const getMedium = (name: string) => name.includes('Sinhala') ? 1 : name.includes('Tamil') ? 2 : 3;
                const getGrade = (name: string) => { const match = name.match(/Grade (\d+)/); return match ? parseInt(match[1]) : 0; };
                
                if (getMedium(a.class_name) !== getMedium(b.class_name)) return getMedium(a.class_name) - getMedium(b.class_name);
                if (getGender(a.class_name) !== getGender(b.class_name)) return getGender(a.class_name) - getGender(b.class_name);
                return getGrade(a.class_name) - getGrade(b.class_name);
              })
              .map(cls => {
              const shortName = cls.class_name
                .replace(/Grade\s/i, 'G')
                .replace(/Sinhala/i, 'Sin')
                .replace(/English/i, 'Eng')
                .replace(/Tamil/i, 'Tam')
                .replace(/Mixed/i, 'Mix')
                .replace(/Boys/i, 'B')
                .replace(/Girls/i, 'G');

              return (
                <div 
                  key={cls.class_id}
                  title={`${cls.class_name} - ${cls.submitted ? cls.percentage + '% Present' : 'Not submitted'}`}
                  onClick={() => navigate(`/attendance/mark?class_id=${cls.class_id}&date=${summary.date}`)}
                  className={`px-2 py-1.5 rounded-lg flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer transition-all hover:scale-105 border ${
                    cls.submitted 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' 
                      : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
                  }`}
                >
                  {cls.submitted ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="text-[11px] font-bold whitespace-nowrap">{shortName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Class Attendance Status Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Class Attendance Status</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {summary.classes.filter(c => c.submitted).map(cls => (
            <div key={cls.class_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{cls.class_name}</h4>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getPercentageColor(cls.percentage)}`}>{cls.percentage}%</span>
              </div>
              <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span>Present: <strong className="text-emerald-600 dark:text-emerald-400">{cls.present}</strong></span>
                <span>Absent: <strong className="text-red-600 dark:text-red-400">{cls.absent}</strong></span>
              </div>
              <button onClick={() => handleViewDetails(cls.class_id)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors">
                <Eye className="w-3.5 h-3.5" /> View Details
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
