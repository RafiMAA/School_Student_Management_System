import { BookOpen, Users, Pencil, Trash2, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { Class } from '@/types';

export default function ClassList() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const { data: classes = [], isLoading: loading, error } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<Class[]>('/classes'),
  });

  useEffect(() => {
    if (error) addToast('error', 'Failed to load classes');
  }, [error, addToast]);

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await api.delete(`/classes/${deleteDialog}`);
      addToast('success', 'Class deleted successfully');
      setDeleteDialog(null);
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to delete class');
    }
  };

  const typeBadge = (type: string) => {
    if (type === 'Mixed') return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400';
    if (type === 'Boys') return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
    return 'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400';
  };

  return (
    <div className="pwa-class-list space-y-4">
      <div className="pwa-only pwa-page-heading">
        <h1>Classes</h1>
        <p>{classes.length} active classes</p>
      </div>
      <div className="flex justify-end">
        <button onClick={() => navigate('/classes/create')} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors active:scale-95">
          <BookOpen className="w-4 h-4" /> Create Class
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {classes.map(cls => (
            <div key={cls.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1">{cls.name}</h3>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge(cls.gender_type)}`}>
                  {cls.gender_type}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Grade {cls.grade}</span>
                  <span className="mx-1">|</span>
                  <span>{cls.medium}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Users className="w-3.5 h-3.5" />
                  <span>{cls.total_students || 0} students</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{cls.teacher_name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => navigate(`/classes/edit/${cls.id}`)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => setDeleteDialog(cls.id)} className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {classes.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400">No classes found</div>
          )}
        </div>
      )}

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class</DialogTitle>
            <DialogDescription>Are you sure you want to delete this class? You cannot delete a class if there are students assigned to it.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setDeleteDialog(null)} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-300">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
