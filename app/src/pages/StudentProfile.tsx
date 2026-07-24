import { useState, useEffect } from 'react';
import { ArrowLeft, User, Calendar, BookOpen, Phone, GraduationCap, CheckCircle2, XCircle, FileText, Pencil, Trash2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { format, parseISO } from 'date-fns';
import api from '@/lib/apiClient';
import type { Student } from '@/types';
import StudentAchievements from '@/components/StudentAchievements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface StudentAttendance {
  id: string;
  attendance_date: string;
  class_name: string;
  status: 'Present' | 'Absent';
  is_locked: boolean;
}

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    Promise.all([
      api.get<Student>(`/students/${id}`),
      api.get<StudentAttendance[]>(`/attendance/student/${id}`)
    ])
      .then(([studentData, historyData]) => {
        setStudent(studentData);
        setHistory(historyData);
      })
      .catch(() => addToast('error', 'Failed to load student profile'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>;
  }

  const handleDelete = async () => {
    try {
      await api.delete(`/students/${id}`);
      setDeleteDialog(false);
      addToast('success', 'Student deleted successfully');
      navigate('/students');
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to delete student');
    }
  };

  if (!student) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Student not found</h2>
        <button onClick={() => navigate('/students')} className="mt-4 text-emerald-600 hover:underline">Return to Student List</button>
      </div>
    );
  }

  const presentCount = history.filter(r => r.status === 'Present').length;
  const attendanceRate = history.length > 0 ? Math.round((presentCount / history.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Student Profile</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/students/edit/${id}`)} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg transition-colors text-sm font-medium">
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button onClick={() => setDeleteDialog(true)} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors text-sm font-medium">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-emerald-50 dark:bg-emerald-900/20" />
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-white dark:border-slate-900 bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-300 mb-4 mt-8">
              <User className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{student.full_name}</h3>
            <p className="text-sm font-mono text-slate-500 dark:text-slate-400 mt-1">{student.registration_number}</p>
            
            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <div className={`w-2 h-2 rounded-full ${student.status === 'Active' ? 'bg-emerald-500' : student.status === 'Alumni' ? 'bg-blue-500' : 'bg-slate-400'}`} />
              {student.status}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 text-left">
              {student.status !== 'Alumni' && (
              <div className="flex items-center gap-3 text-sm">
                <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Current Class</p>
                  <p className="font-medium text-slate-900 dark:text-white">{student.class_name || 'Unassigned'}</p>
                </div>
              </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Date of Birth</p>
                  <p className="font-medium text-slate-900 dark:text-white">{format(parseISO(student.date_of_birth), 'MMM dd, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Joined Date</p>
                  <p className="font-medium text-slate-900 dark:text-white">{format(parseISO(student.joined_date), 'MMM dd, yyyy')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Contact Information</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-sm">
                <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Parent/Guardian</p>
                  <p className="font-medium text-slate-900 dark:text-white">{student.parent_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Parent's Number</p>
                  <p className="font-medium text-slate-900 dark:text-white">{student.parent_contact}</p>
                </div>
              </div>
              {student.parent_contact_2 && (
                <div className="flex items-start gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {student.parent_name_2 ? `${student.parent_name_2}'s Number` : "Secondary Number"}
                    </p>
                    <p className="font-medium text-slate-900 dark:text-white">{student.parent_contact_2}</p>
                  </div>
                </div>
              )}
              {student.status === 'Alumni' && (
                <div className="flex items-start gap-3 text-sm">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Own Contact</p>
                    <p className="font-medium text-slate-900 dark:text-white">{student.own_contact || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Attendance History */}
        <div className="lg:col-span-2 space-y-6">
          {student.status !== 'Alumni' && (
            <>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 sm:p-4 shadow-sm text-center">
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Total Sundays</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">{history.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 sm:p-4 shadow-sm text-center">
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Present</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{presentCount}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 sm:p-4 shadow-sm text-center relative overflow-hidden">
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${attendanceRate}%` }} />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Attendance Rate</p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{attendanceRate}%</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Attendance</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                  {history.slice(0, 5).map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {record.status === 'Present' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {format(parseISO(record.attendance_date), 'MMMM dd, yyyy')}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Class: {record.class_name}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        record.status === 'Present' 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' 
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {record.status}
                      </span>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No attendance records found for this student.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Student Report */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
              <FileText className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Student Report</h3>
            </div>
            <div className="p-4">
              <StudentAchievements studentId={id!} />
            </div>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>Are you sure you want to soft delete this student? They will be marked as Inactive.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setDeleteDialog(false)} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
