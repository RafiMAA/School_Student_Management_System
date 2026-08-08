import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { Teacher, Class } from '@/types';

export default function Teachers() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAdd, setShowAdd] = useState(false);
  
  const [form, setForm] = useState({
    fullName: '',
    contact: '',
    address: '',
    email: '',
    password: '',
    role: 'Teacher' as 'Principal' | 'Admin' | 'Teacher' | 'Super Admin',
    assignedClassId: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchTeachers = () => {
    setLoading(true);
    api.get<Teacher[]>('/teachers')
      .then(setTeachers)
      .catch(() => addToast('error', 'Failed to load teachers'))
      .finally(() => setLoading(false));
  };

  const fetchClasses = () => {
    api.get<Class[]>('/classes').then(setClasses).catch(console.error);
  };

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) {
      addToast('error', 'Please fill required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/teachers', {
        full_name: form.fullName,
        contact: form.contact,
        address: form.address,
        email: form.email,
        password: form.password,
        role: form.role,
        assigned_classes: form.assignedClassId ? [form.assignedClassId] : []
      });
      addToast('success', 'Teacher added successfully');
      setShowAdd(false);
      setForm({ fullName: '', contact: '', address: '', email: '', password: '', role: 'Teacher', assignedClassId: '' });
      fetchTeachers();
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to add teacher');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Teachers & Staff</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage school personnel and system access.</p>
        </div>
        {['Principal', 'Admin'].includes(user?.role || '') && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors active:scale-95">
            <Plus className="w-4 h-4" /> Add Teacher
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Assigned Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" /></td></tr>
              ) : teachers.map(t => (
                <tr key={t.id} onClick={() => navigate(`/admin/teachers/${t.id}`)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{t.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{t.contact || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{t.assigned_class || 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {['Principal', 'Admin'].includes(user?.role || '') && (
          <div className="bg-slate-900 text-slate-300 p-4 text-sm flex items-start gap-2 border-t border-slate-800">
            <div className="mt-0.5">ℹ️</div>
            <p>Click on a teacher's name to view their profile, manage permissions, or edit details.</p>
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Teacher/Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
              <input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email Address *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" required minLength={6} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Contact Number</label>
              <input type="text" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
              <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Role *</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value as any})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <option value="Teacher">Teacher</option>
                <option value="Admin">Admin</option>
                {user?.role === 'Principal' && (
                  <>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Principal">Principal</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Assign Class</label>
              <select 
                value={form.assignedClassId} 
                onChange={e => setForm({...form, assignedClassId: e.target.value})} 
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                <option value="">-- Unassigned --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    Grade {c.grade} {c.medium} {c.gender_type}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">Create</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
