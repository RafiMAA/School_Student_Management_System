import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { Student } from '@/types';
import { usePwaUi } from '@/hooks/use-pwa-ui';

const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export default function StudentList() {
  const pwaUi = usePwaUi();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [mediumFilter, setMediumFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [statusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  
  const [page, setPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const buildUrl = () => {
    let url = `/students?page=${pwaUi ? 1 : page}&page_size=${pwaUi ? 100 : 10}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (gradeFilter) url += `&grade=${gradeFilter}`;
    if (mediumFilter) url += `&medium=${mediumFilter}`;
    if (genderFilter) url += `&gender=${genderFilter}`;
    if (statusFilter !== 'all') url += `&status=${statusFilter}`;
    // Exclude Alumni from default student list unless specifically requested
    else url += `&status=Active`;
    return url;
  };

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['students', pwaUi ? 1 : page, pwaUi, search, gradeFilter, mediumFilter, genderFilter, statusFilter],
    queryFn: () => api.get<{items: Student[], total: number, total_pages: number}>(buildUrl()),
  });

  useEffect(() => {
    if (error) addToast('error', 'Failed to load students');
  }, [error, addToast]);

  const students = data?.items || [];
  const totalRecords = data?.total || 0;
  const totalPages = data?.total_pages || 1;

  const handleFilterChange = (setter: Dispatch<SetStateAction<string>>, val: string) => {
    setter(val);
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/students/${id}`);
      setDeleteDialog(null);
      addToast('success', 'Student deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (err: unknown) {
      const apiError = err as { data?: { detail?: string } };
      addToast('error', apiError.data?.detail || 'Failed to delete student');
    }
  };

  if (pwaUi) {
    return (
      <div className="pwa-students-native">
        <header className="pwa-students-heading">
          <div>
            <h1>Students</h1>
            <p>{totalRecords} active students</p>
          </div>
          <div className="pwa-students-actions">
            <button type="button" className="import" onClick={() => navigate('/classes/import')}>
              <UploadCloud /> <span>Import</span>
            </button>
            <button type="button" className="add" onClick={() => navigate('/students/add')}>
              <Plus /> <span>Add</span>
            </button>
          </div>
        </header>

        <section className="pwa-students-controls">
          <label className="pwa-student-search">
            <span>Search</span>
            <div>
              <Search />
              <input
                type="search"
                placeholder="Student name"
                value={search}
                onChange={event => handleFilterChange(setSearch, event.target.value)}
              />
            </div>
          </label>
          <div className="pwa-student-filter-grid">
            <label>
              <span>Gender</span>
              <select value={genderFilter} onChange={event => handleFilterChange(setGenderFilter, event.target.value)}>
                <option value="">All genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label>
              <span>Medium</span>
              <select value={mediumFilter} onChange={event => handleFilterChange(setMediumFilter, event.target.value)}>
                <option value="">All mediums</option>
                <option value="Sinhala">Sinhala</option>
                <option value="Tamil">Tamil</option>
              </select>
            </label>
          </div>
        </section>

        <section className="pwa-student-card" aria-live="polite">
          {loading ? (
            <div className="pwa-student-loading"><span /></div>
          ) : students.length === 0 ? (
            <p className="pwa-student-empty">No students found</p>
          ) : students.map(student => (
            <button type="button" key={student.id} className="pwa-student-row" onClick={() => navigate(`/students/${student.id}`)}>
              <span className="pwa-student-copy">
                <strong>{student.full_name}</strong>
                <small>{student.class_name || `Grade ${student.current_grade}`} · {student.gender}</small>
              </span>
              <span className="pwa-student-medium">{student.medium}</span>
            </button>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or reg no..."
            value={search}
            onChange={e => handleFilterChange(setSearch, e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <button
          onClick={() => navigate('/students/add')}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <select value={gradeFilter} onChange={e => handleFilterChange(setGradeFilter, e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">All Grades</option>
            {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          <select value={mediumFilter} onChange={e => handleFilterChange(setMediumFilter, e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">All Mediums</option>
            <option value="Sinhala">Sinhala</option>
            <option value="Tamil">Tamil</option>
          </select>
          <select value={genderFilter} onChange={e => handleFilterChange(setGenderFilter, e.target.value)} className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none">
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Gender</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Grade</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Class</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Medium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto" /></td></tr>
              ) : students.map(student => (
                <tr key={student.id} onClick={() => navigate(`/students/${student.id}`)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{student.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{student.gender}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{student.current_grade}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{student.class_name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{student.medium}</td>
                </tr>
              ))}
              {!loading && students.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 dark:text-slate-400">Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, totalRecords)} of {totalRecords}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-xs border rounded hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Prev</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`px-3 py-1 text-xs border rounded ${page === i + 1 ? 'bg-emerald-600 text-white border-emerald-600' : 'hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'}`}>{i + 1}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-xs border rounded hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>Are you sure you want to soft delete this student? They will be marked as Inactive.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setDeleteDialog(null)} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300">Cancel</button>
            <button onClick={() => deleteDialog && handleDelete(deleteDialog)} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
