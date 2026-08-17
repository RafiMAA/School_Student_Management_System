import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/contexts/ToastContext';
import { useApp } from '@/contexts/AppContext';
import api from '@/lib/apiClient';
import type { Teacher, Class } from '@/types';

const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

export default function CreateClass() {
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

  useEffect(() => {
    api.get<Teacher[]>('/teachers')
      .then(data => setTeachers(data))
      .catch(() => addToast('error', 'Failed to load teachers'));
  }, [addToast]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<Class[]>('/classes'),
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.grade) errs.grade = 'Grade is required';
    if (!form.medium) errs.medium = 'Medium is required';
    if (!form.genderType) errs.genderType = 'Gender type is required';
    
    // Check for Mixed vs Boys/Girls conflicts
    const sameClasses = classes.filter(c => c.grade.toString() === form.grade && c.medium === form.medium);
    for (const c of sameClasses) {
      if (form.genderType === 'Mixed' && (c.gender_type === 'Boys' || c.gender_type === 'Girls')) {
        errs.genderType = 'Cannot create Mixed class when Boys/Girls classes exist';
        break;
      }
      if ((form.genderType === 'Boys' || form.genderType === 'Girls') && c.gender_type === 'Mixed') {
        errs.genderType = 'Cannot create Boys/Girls classes when Mixed class exists';
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
      await api.post('/classes', {
        grade: parseInt(form.grade),
        medium: form.medium,
        gender_type: form.genderType,
        teacher_id: form.teacherId || null,
      });
      addToast('success', 'Class created successfully');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      navigate('/classes');
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to create class');
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/classes')} className="pwa-create-class-back p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New Class</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Academic Year</label>
            <input type="text" value={currentAcademicYear} disabled className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Assign Teacher (Optional)</label>
            <select value={form.teacherId} onChange={e => handleChange('teacherId', e.target.value)} className={inputClass('teacherId', !form.teacherId)}>
              <option value="" className="text-slate-500">No teacher assigned</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id} className="text-slate-900 dark:text-white">{t.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors active:scale-95">
            <Save className="w-4 h-4" /> {submitting ? 'Creating...' : 'Create Class'}
          </button>
        </div>
      </form>
    </div>
  );
}
