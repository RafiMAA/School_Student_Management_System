import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Trash2, KeyRound, Shield, User as UserIcon, Phone, BookOpen, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { Teacher, Class } from '@/types';

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showReset, setShowReset] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  
  const [editForm, setEditForm] = useState({ fullName: '', contact: '', address: '', assignedClassId: '' });
  const [resetPassword, setResetPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: teacher, isLoading, error } = useQuery({
    queryKey: ['teacher', id],
    queryFn: () => api.get<Teacher>(`/teachers/${id}`),
    enabled: !!id,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<Class[]>('/classes'),
  });

  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load teacher profile');
      navigate('/admin/teachers');
    }
  }, [error, addToast, navigate]);

  const handleResetPassword = async () => {
    if (!resetPassword || !id) return;
    setSubmitting(true);
    try {
      await api.post(`/teachers/${id}/reset-password`, { new_password: resetPassword });
      addToast('success', 'Password reset successfully');
      setShowReset(false);
      setResetPassword('');
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editForm.fullName) return;
    setSubmitting(true);
    try {
      await api.patch(`/teachers/${id}`, {
        full_name: editForm.fullName,
        contact: editForm.contact,
        address: editForm.address,
        assigned_classes: editForm.assignedClassId ? [editForm.assignedClassId] : []
      });
      addToast('success', 'Teacher details updated successfully');
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ['teacher', id] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to update teacher details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await api.delete(`/teachers/${id}`);
      addToast('success', 'Teacher deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      navigate('/admin/teachers');
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to remove teacher');
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!id || !teacher || newRole === teacher.role) return;
    setSubmitting(true);
    try {
      await api.patch(`/teachers/${id}`, { role: newRole });
      addToast('success', `Role updated to ${newRole}`);
      queryClient.invalidateQueries({ queryKey: ['teacher', id] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = () => {
    if (!teacher) return;
    setEditForm({
      fullName: teacher.full_name,
      contact: teacher.contact || '',
      address: teacher.address || '',
      assignedClassId: (teacher.assigned_class_ids && teacher.assigned_class_ids.length > 0) ? teacher.assigned_class_ids[0] : ''
    });
    setShowEdit(true);
  };

  if (isLoading || !teacher) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" /></div>;
  }

  const roleBadge = (role: string) => {
    if (role === 'Super Admin') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400';
    if (role === 'Principal') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400';
    if (role === 'Admin') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400';
    return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
  };

  const isViewingUserSuperAdmin = user?.role === 'Super Admin';
  const hasAdminAccess = ['Principal', 'Admin', 'Super Admin'].includes(user?.role || '');
  const isProtectedUser = teacher.role === 'Principal' || teacher.email === 'rafimaa.23@example.com';
  const canModify = hasAdminAccess && 
                    !isProtectedUser && 
                    (teacher.role !== 'Super Admin' || isViewingUserSuperAdmin);
  const isSelf = user?.id === teacher.id;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/teachers')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View and manage teacher details and access.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl font-bold">
              {teacher.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{teacher.full_name}</h1>
              <span className={`inline-block px-2.5 py-0.5 rounded-lg border text-xs font-semibold ${roleBadge(teacher.role)}`}>
                {teacher.role}
              </span>
            </div>
          </div>
          
          {hasAdminAccess && (
            <div className="flex flex-wrap gap-3">
              {canModify && (
                <button onClick={() => setShowReset(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors">
                  <KeyRound className="w-4 h-4" /> Reset Password
                </button>
              )}
              <button onClick={openEdit} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors">
                <Pencil className="w-4 h-4" /> Edit
              </button>
              {canModify && !isSelf && (
                <button onClick={() => setShowDelete(true)} className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="p-6 sm:p-8 border-r border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-500" /> Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Email Address</p>
                <p className="font-medium text-slate-900 dark:text-white font-mono">{teacher.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Contact Number</p>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <p className="font-medium text-slate-900 dark:text-white">{teacher.contact || 'Not provided'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Address</p>
                <p className="font-medium text-slate-900 dark:text-white">{teacher.address || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Date Added</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <p className="font-medium text-slate-900 dark:text-white">
                    {teacher.created_at ? format(new Date(teacher.created_at), 'PPP') : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 bg-slate-50 dark:bg-slate-800/20">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-500" /> School Assignment
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Assigned Class (Current Year)</p>
                {teacher.assigned_class ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium rounded-lg text-sm border border-emerald-200 dark:border-emerald-800">
                    <BookOpen className="w-4 h-4" /> {teacher.assigned_class}
                  </div>
                ) : (
                  <p className="font-medium text-slate-600 dark:text-slate-400 italic">Unassigned</p>
                )}
              </div>

              {hasAdminAccess && (
                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" /> System Permissions
                  </h4>
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">System Role</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Controls the user's access level in the system.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select 
                        disabled={!canModify || submitting}
                        value={teacher.role}
                        onChange={(e) => {
                          if (canModify) handleRoleChange(e.target.value);
                        }}
                        className={`text-sm font-medium border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 min-w-[140px] ${!canModify ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer'}`}
                      >
                        <option value="Teacher">Teacher</option>
                        <option value="Admin">Admin</option>
                        {(isViewingUserSuperAdmin || teacher.role === 'Super Admin') && <option value="Super Admin">Super Admin</option>}
                        {teacher.role === 'Principal' && <option value="Principal">Principal</option>}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Reset the password for {teacher.full_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">New Password</label>
              <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setShowReset(false)} className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={handleResetPassword} disabled={!resetPassword || submitting} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">Reset Password</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Full Name *</label>
              <input type="text" value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Contact Number</label>
              <input type="text" value={editForm.contact} onChange={e => setEditForm({...editForm, contact: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
              <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
            </div>
            {hasAdminAccess && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Assign Class</label>
                <select 
                  value={editForm.assignedClassId} 
                  onChange={e => setEditForm({...editForm, assignedClassId: e.target.value})} 
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
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">Save Changes</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Teacher</DialogTitle>
            <DialogDescription>Are you sure you want to permanently delete {teacher.full_name}?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button onClick={() => setShowDelete(false)} disabled={submitting} className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={handleDelete} disabled={submitting} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">Delete</button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}
