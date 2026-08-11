import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X, CheckCheck } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/apiClient';
import type { Class, Student } from '@/types';

export default function MarkAttendance() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const getLastSunday = () => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState(searchParams.get('date') || getLastSunday());
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get('class_id') || '');
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'Present' | 'Absent'>>({});
  const [validSundays, setValidSundays] = useState<string[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(false);

  useEffect(() => {
    api.get<Class[]>('/classes').then(setClasses).catch(() => addToast('error', 'Failed to load classes'));
    
    api.get<any>('/academic-years/current').then((year) => {
      const start = new Date(year.start_date);
      const today = new Date();
      const sundays: string[] = [];
      
      // Find the first Sunday on or after the start date
      let current = new Date(start);
      if (current.getDay() !== 0) {
        current.setDate(current.getDate() + (7 - current.getDay()));
      }
      
      while (current <= today) {
        sundays.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
        current.setDate(current.getDate() + 7);
      }
      
      setValidSundays(sundays.reverse()); // Show most recent first
      
      // If the selected date is not in the valid sundays and valid sundays is not empty, select the latest one
      if (sundays.length > 0 && !searchParams.get('date')) {
        setSelectedDate(sundays[0]);
      }
    }).catch(() => {
      console.error("Failed to load academic year");
    });
  }, [addToast, searchParams]);

  useEffect(() => {
    if (selectedClassId) {
      setLoadingStudents(true);
      
      const fetchStudents = api.get<Student[]>(`/classes/${selectedClassId}/students`);
      const fetchAttendance = api.get<any>(`/attendance?class_id=${selectedClassId}&attendance_date=${selectedDate}&page_size=100`)
        .catch(err => {
          console.error("Attendance fetch error", err);
          return { items: [] };
        });

      Promise.all([fetchStudents, fetchAttendance])
      .then(([studentData, attendanceResponse]) => {
        const studentsList = Array.isArray(studentData) ? studentData : [];
        setStudents(studentsList.filter(s => s.status === 'Active'));
        
        const records = attendanceResponse?.items || [];
        setExistingSubmission(records.length > 0);
        
        if (records.length > 0) {
          const map: Record<string, 'Present' | 'Absent'> = {};
          records.forEach((r: any) => {
            map[r.student_id] = r.status;
          });
          setAttendanceMap(map);
        } else {
          setAttendanceMap({});
        }
      })
      .catch((err) => {
        console.error("Student load error", err);
        addToast('error', 'Failed to load data');
        setExistingSubmission(false);
      })
      .finally(() => setLoadingStudents(false));
    } else {
      setStudents([]);
      setExistingSubmission(false);
    }
  }, [selectedClassId, selectedDate, addToast]);

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDate(e.target.value);
  };

  const allMarked = students.length > 0 && students.every(s => attendanceMap[s.id]);

  const handleToggle = (studentId: string, status: 'Present' | 'Absent') => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: 'Present' | 'Absent') => {
    const map: Record<string, 'Present' | 'Absent'> = {};
    students.forEach(s => { map[s.id] = status; });
    setAttendanceMap(map);
  };

  const handleSubmit = async () => {
    if (!allMarked) {
      addToast('error', 'Please mark attendance for all students');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/attendance/bulk', {
        class_id: selectedClassId,
        date: selectedDate,
        records: Object.entries(attendanceMap).map(([student_id, status]) => ({ student_id, status }))
      });
      addToast('success', 'Attendance submitted successfully');
      setExistingSubmission(true);
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(attendanceMap).filter(v => v === 'Present').length;
  const absentCount = Object.values(attendanceMap).filter(v => v === 'Absent').length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Sunday Date</label>
            <select
              value={selectedDate}
              onChange={handleDateChange}
              className="w-full max-w-full truncate px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              {validSundays.length === 0 && <option value={selectedDate}>{selectedDate}</option>}
              {validSundays.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
          <div className="flex-[2] min-w-0">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Class</label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className={`w-full max-w-full truncate px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${
                !selectedClassId ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
              }`}
            >
              <option value="" disabled className="text-slate-500">Select a class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id} className="text-slate-900 dark:text-white">{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedClassId && (
        <>
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              <button onClick={() => markAll('Present')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors">
                <CheckCheck className="w-3.5 h-3.5" /> Mark All Present
              </button>
              <button onClick={() => markAll('Absent')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <X className="w-3.5 h-3.5" /> Mark All Absent
              </button>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Present: {presentCount}</span>
              <span className="text-red-600 dark:text-red-400 font-medium">Absent: {absentCount}</span>
              <span className="text-slate-500 dark:text-slate-400">Total: {students.length}</span>
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3 w-12">#</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Student Name</th>
                    <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingStudents ? (
                    <tr><td colSpan={4} className="text-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto" /></td></tr>
                  ) : students.map((student, idx) => {
                    const status = attendanceMap[student.id];
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-sm text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                          <Link to={`/students/${student.id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">
                            {student.full_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleToggle(student.id, 'Present')}
                              title="Mark Present"
                              className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 min-h-[36px] min-w-[36px] ${
                                status === 'Present'
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-300'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggle(student.id, 'Absent')}
                              title="Mark Absent"
                              className={`flex items-center justify-center p-2 rounded-lg transition-all duration-200 min-h-[36px] min-w-[36px] ${
                                status === 'Absent'
                                  ? 'bg-red-500 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-red-300'
                              }`}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingStudents && students.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">No active students in this class</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !allMarked || students.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl shadow-sm transition-colors active:scale-[0.99] disabled:active:scale-100"
          >
            {submitting ? 'Submitting...' : (existingSubmission ? 'Update Attendance' : 'Submit Attendance')}
          </button>
        </>
      )}

      {!selectedClassId && (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
          <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Select a class and date to mark attendance</p>
        </div>
      )}
    </div>
  );
}
