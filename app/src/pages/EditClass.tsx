import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/contexts/ToastContext';
import { useApp } from '@/contexts/AppContext';
import api from '@/lib/apiClient';
import type { Teacher, Class } from '@/types';

const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export default function EditClass() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { currentAcademicYear } = useApp();
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState({
    grade: '',
    medium: '' as 'Sinhala' | 'Tamil' | '',
    genderType: '' as 'Mixed' | 'Boys' | 'Girls' | '',
    teacherId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: classes = [], isLoading: loadingClass } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<Class[]>('/classes'),
  });

  useEffect(() => {
    if (classes.length > 0) {
      const cls = classes.find(c => c.id === id);
      if (cls) {
        setForm({
          grade: cls.grade.toString(),
          medium: cls.medium,
          genderType: cls.gender_type,
          teacherId: cls.teacher_id || '',
        });
      } else {
        addToast('error', 'Class not found');
        navigate('/classes');
      }
    }
  }, [classes, id, navigate, addToast]);

  useEffect(() => {
    api.get<Teacher[]>('/teachers')
      .then(data => setTeachers(data))
      .catch(() => addToast('error', 'Failed to load teachers'));
  }, [addToast]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.grade) errs.grade = 'Grade is required';
    if (!form.medium) errs.medium = 'Medium is required';
    if (!form.genderType) errs.genderType = 'Gender type is required';
    
    // Check for Mixed vs Boys/Girls conflicts
    const sameClasses = classes.filter(c => c.grade.toString() === form.grade && c.medium === form.medium && c.id !== id);
    for (const c of sameClasses) {
      if (form.genderType === 'Mixed' && (c.gender_type === 'Boys' || c.gender_type === 'Girls')) {
        errs.genderType = 'Cannot change to Mixed class when Boys/Girls classes exist';
        break;
      }
      if ((form.genderType === 'Boys' || form.genderType === 'Girls') && c.gender_type === 'Mixed') {
        errs.genderType = 'Cannot change to Boys/Girls classes when Mixed class exists';
        break;
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.patch(`/classes/${id}`, {
        grade: parseInt(form.grade),
        medium: form.medium,
        gender_type: form.genderType,
        teacher_id: form.teacherId || null,
      });
      addToast('success', 'Class updated successfully');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      navigate('/classes');
    } catch (err: unknown) {
      const apiError = err as { data?: { detail?: string } };
      addToast('error', apiError.data?.detail || 'Failed to update class');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string, isPlaceholder: boolean = false) =>
    `w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none ${
      isPlaceholder ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
    } ${
      errors[field] ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200 dark:border-slate-700'
    }`;

  if (loadingClass) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="pwa-edit-class max-w-2xl mx-auto">
      <div className="pwa-edit-class-desktop-heading flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/classes')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Class Details</h2>
      </div>

      <div className="pwa-only pwa-page-heading pwa-edit-class-heading">
        <h1>Edit Class</h1>
        <p>Class structure and teacher assignment</p>
      </div>

      <form onSubmit={handleSubmit} className="pwa-edit-class-form bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
        <div className="pwa-edit-class-fields grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Grade <span className="text-red-500">*</span></label>
            <select value={form.grade} onChange={e => handleChange('grade', e.target.value)} className={inputClass('grade', !form.grade)}>
              <option value="" disabled className="text-slate-500">Select grade</option>
              {grades.map(g => <option key={g} value={g} className="text-slate-900 dark:text-white">Grade {g}</option>)}
            </select>
            {errors.grade && <p className="mt-1 text-xs text-red-500">{errors.grade}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Medium <span className="text-red-500">*</span></label>
            <select value={form.medium} onChange={e => handleChange('medium', e.target.value)} className={inputClass('medium', !form.medium)}>
              <option value="" disabled className="text-slate-500">Select medium</option>
              <option value="Sinhala" className="text-slate-900 dark:text-white">Sinhala</option>
              <option value="Tamil" className="text-slate-900 dark:text-white">Tamil</option>
            </select>
            {errors.medium && <p className="mt-1 text-xs text-red-500">{errors.medium}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Gender Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {(['Mixed', 'Boys', 'Girls'] as const).map(t => (
                <button key={t} type="button" onClick={() => handleChange('genderType', t)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  form.genderType === t ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                  {t}
                </button>
              ))}
            </div>
            {errors.genderType && <p className="mt-1 text-xs text-red-500">{errors.genderType}</p>}
          </div>

          <div className="pwa-edit-class-year">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Academic Year</label>
            <input type="text" value={currentAcademicYear} disabled className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"><span className="pwa-desktop-only">Assign Teacher (Optional)</span><span className="pwa-only">Assigned teacher</span></label>
            <select value={form.teacherId} onChange={e => handleChange('teacherId', e.target.value)} className={inputClass('teacherId', !form.teacherId)}>
              <option value="" className="text-slate-500">No teacher assigned</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id} className="text-slate-900 dark:text-white">{t.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pwa-edit-class-submit flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors active:scale-95">
            <Save className="w-4 h-4" /> {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
