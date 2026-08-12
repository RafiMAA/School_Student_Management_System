import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { Student } from '@/types';

const currentYear = new Date().getFullYear();
const graduationYears = Array.from({ length: 10 }, (_, index) => currentYear - index);
const alumniFieldClass = 'w-full min-w-0 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500';

export default function Alumni() {
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [page, setPage] = useState(1);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '', gender: 'Male' as 'Male' | 'Female', dateOfBirth: '',
    parentName: '', parentName2: '', parentContact: '', parentContact2: '', ownContact: '',
    medium: 'Sinhala' as 'Sinhala' | 'Tamil', joinedDate: '', graduationYear: ''
  });

  const buildUrl = () => {
    let url = `/students?status=Alumni&page=${page}&page_size=10`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return url;
  };

  const { data, isLoading: loading } = useQuery({
    queryKey: ['alumni', page, search],
    queryFn: () => api.get<{items: Student[], total: number, total_pages: number}>(buildUrl()),
  });

  const allAlumni = data?.items || [];
  const filtered = yearFilter ? allAlumni.filter(i => i.graduation_year === yearFilter) : allAlumni;
  // Sort by graduation year descending (most recently graduated first)
  const alumni = [...filtered].sort((a, b) => {
    const yearA = parseInt(a.graduation_year || '0');
    const yearB = parseInt(b.graduation_year || '0');
    return yearB - yearA;
  });
  const totalRecords = data?.total || 0;
  const totalPages = data?.total_pages || 1;

  const handleFilterChange = (setter: any, val: string) => {
    setter(val);
    setPage(1);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/students/alumni', {
        full_name: form.fullName,
        gender: form.gender,
        date_of_birth: form.dateOfBirth,
        parent_name: form.parentName,
        parent_name_2: form.parentName2 || undefined,
        parent_contact: form.parentContact,
        parent_contact_2: form.parentContact2 || undefined,
        own_contact: form.ownContact || undefined,
        medium: form.medium,
        joined_date: form.joinedDate,
        graduation_year: form.graduationYear
      });
      addToast('success', 'Alumni added successfully');
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ['alumni'] });
      setForm({
        fullName: '', gender: 'Male', dateOfBirth: '',
        parentName: '', parentName2: '', parentContact: '', parentContact2: '', ownContact: '',
        medium: 'Sinhala', joinedDate: '', graduationYear: ''
      });
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to add alumni');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search alumni..."
            value={search}
            onChange={e => handleFilterChange(setSearch, e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <select
          value={yearFilter}
          onChange={e => handleFilterChange(setYearFilter, e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="">All Years</option>
          {graduationYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
        </select>
        </div>
        <button onClick={() => setShowAdd(true)} className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Add Alumni
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3 w-1/4">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3 w-1/4">Gender</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3 w-1/4">Contact Number</th>
                <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3 w-1/4">Graduated Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto" /></td></tr>
              ) : alumni.map(student => (
                <tr key={student.id} onClick={() => navigate(`/students/${student.id}`)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{student.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{student.gender}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{student.own_contact || student.parent_contact}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                      {student.graduation_year || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && alumni.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No alumni found</td></tr>
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

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Add Alumni</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
              <input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className={alumniFieldClass} autoComplete="name" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Gender *</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value as any})} className={alumniFieldClass}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date of Birth *</label>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm({...form, dateOfBirth: e.target.value})} className={alumniFieldClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Parent's Name *</label>
              <input type="text" value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} className={alumniFieldClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Parent's Contact *</label>
              <input type="tel" value={form.parentContact} onChange={e => setForm({...form, parentContact: e.target.value})} className={alumniFieldClass} inputMode="tel" autoComplete="tel" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Secondary Contact Name</label>
              <input type="text" value={form.parentName2} onChange={e => setForm({...form, parentName2: e.target.value})} className={alumniFieldClass} placeholder="Enter parent's name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Secondary Contact</label>
              <input type="tel" value={form.parentContact2} onChange={e => setForm({...form, parentContact2: e.target.value})} className={alumniFieldClass} inputMode="tel" placeholder="e.g. 0771234567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Own Contact</label>
              <input type="tel" value={form.ownContact} onChange={e => setForm({...form, ownContact: e.target.value})} className={alumniFieldClass} inputMode="tel" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Medium *</label>
              <select value={form.medium} onChange={e => setForm({...form, medium: e.target.value as any})} className={alumniFieldClass}>
                <option value="Sinhala">Sinhala</option>
                <option value="Tamil">Tamil</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Joined Date *</label>
              <input type="date" value={form.joinedDate} onChange={e => setForm({...form, joinedDate: e.target.value})} className={alumniFieldClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Graduated Year *</label>
              <input type="text" value={form.graduationYear} onChange={e => setForm({...form, graduationYear: e.target.value.replace(/\D/g, '').slice(0, 4)})} className={alumniFieldClass} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="e.g. 2023" required />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:col-span-2 sm:mt-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="w-full px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 sm:w-auto">Cancel</button>
              <button type="submit" disabled={submitting} className="w-full px-4 py-2.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 sm:w-auto">{submitting ? 'Saving…' : 'Save Alumni'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
