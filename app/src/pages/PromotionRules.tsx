import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash2, GitMerge, Mars, Venus, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { Class, PromotionRule } from '@/types';

function getErrorDetail(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
    }
  }
  return fallback;
}

export default function PromotionRules() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  
  const [newRule, setNewRule] = useState(false);
  const [form, setForm] = useState({
    from_class_id: '',
    male_to_class_id: '',
    female_to_class_id: '',
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<Class[]>('/classes'),
  });

  const { data: rules = [], isLoading: loading, error } = useQuery({
    queryKey: ['promotion-rules'],
    queryFn: () => api.get<PromotionRule[]>('/promotion/rules'),
  });

  useEffect(() => {
    if (error) addToast('error', 'Failed to load promotion rules');
  }, [error, addToast]);

  const handleCreateRule = async () => {
    if (!form.from_class_id || (!form.male_to_class_id && !form.female_to_class_id)) {
      addToast('error', 'Please select source class and at least one target class');
      return;
    }
    try {
      await api.post('/promotion/rules', form);
      addToast('success', 'Rule created successfully');
      setNewRule(false);
      setForm({ from_class_id: '', male_to_class_id: '', female_to_class_id: '' });
      queryClient.invalidateQueries({ queryKey: ['promotion-rules'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-preview'] });
    } catch (error: unknown) {
      addToast('error', getErrorDetail(error, 'Failed to create rule'));
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.delete(`/promotion/rules/${id}`);
      addToast('success', 'Rule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['promotion-rules'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-preview'] });
    } catch (error: unknown) {
      addToast('error', getErrorDetail(error, 'Failed to delete rule'));
    }
  };

  const grade11Classes = classes.filter(c => parseInt(c.grade) === 11);

  return (
    <div className="pwa-promotion max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <section className="pwa-only pwa-promotion-native">
        <div className="pwa-promotion-native-heading">
          <div><h1>Promotion Rules</h1><p>Class progression at year end</p></div>
          <button type="button" onClick={() => setNewRule(true)}><Plus aria-hidden="true" /> Add</button>
        </div>

        <button type="button" className="pwa-promotion-preview" onClick={() => navigate('/academic-year/preview')}>
          <Rocket aria-hidden="true" /> Preview &amp; Execute
        </button>

        <div className="pwa-promotion-native-list">
          {loading ? (
            <div className="pwa-student-loading"><span /></div>
          ) : rules.length === 0 ? (
            <p className="pwa-student-empty">No promotion rules defined yet</p>
          ) : rules.map((rule) => {
            const boysOnly = rule.from_class_name?.includes('Boys');
            const girlsOnly = rule.from_class_name?.includes('Girls');
            return (
              <article className="pwa-promotion-rule-card" key={rule.id}>
                <p>FROM CLASS</p>
                <h2>{rule.from_class_name}</h2>
                <div className="pwa-promotion-targets">
                  {!girlsOnly && rule.male_to_class_id && (
                    <div className="pwa-promotion-target-row">
                      <span><Mars aria-hidden="true" /></span>
                      <div><strong>Boys</strong><small>{rule.male_to_class_name}</small></div>
                    </div>
                  )}
                  {!boysOnly && rule.female_to_class_id && (
                    <div className="pwa-promotion-target-row">
                      <span><Venus aria-hidden="true" /></span>
                      <div><strong>Girls</strong><small>{rule.female_to_class_name}</small></div>
                    </div>
                  )}
                </div>
                <button type="button" className="pwa-promotion-delete" onClick={() => handleDeleteRule(rule.id)}>
                  <Trash2 aria-hidden="true" /> Delete Rule
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <div className="pwa-promotion-desktop space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Promotion Rules</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Define how students transition between classes at year-end.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={() => navigate('/academic-year/preview')} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium rounded-lg transition-colors">
            <GitMerge className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Preview &</span> Execute
          </button>
          <button onClick={() => setNewRule(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors active:scale-95">
            <Plus className="w-4 h-4 shrink-0" /> Add Rule
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Rules</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
             <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
          ) : rules.map(rule => (
            <div key={rule.id} className="p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 min-w-0 flex-1">
                {/* From class */}
                <div className="min-w-0 sm:w-48 lg:w-64 shrink-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1">From Class</p>
                  <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white truncate">{rule.from_class_name}</p>
                </div>
                
                {/* Arrow */}
                <div className="hidden sm:flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 shrink-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
                
                {/* To class */}
                <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1 sm:block hidden">To Class(es)</p>
                  {(() => {
                    const isBoysClass = rule.from_class_name?.includes('Boys') || false;
                    const isGirlsClass = rule.from_class_name?.includes('Girls') || false;

                    if (isBoysClass && rule.male_to_class_id) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium">
                          <span className="sm:hidden text-slate-400">→</span> Boys: {rule.male_to_class_name}
                        </div>
                      );
                    }

                    if (isGirlsClass && rule.female_to_class_id) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium">
                          <span className="sm:hidden text-slate-400">→</span> Girls: {rule.female_to_class_name}
                        </div>
                      );
                    }

                    if (rule.male_to_class_id === rule.female_to_class_id && rule.male_to_class_id) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium">
                          <span className="sm:hidden text-slate-400">→</span> Mixed: {rule.male_to_class_name}
                        </div>
                      );
                    }

                    return (
                      <>
                        {rule.male_to_class_id && (
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium">
                            <span className="sm:hidden text-slate-400">→</span> Boys: {rule.male_to_class_name}
                          </div>
                        )}
                        {rule.female_to_class_id && (
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-medium">
                            <span className="sm:hidden text-slate-400">→</span> Girls: {rule.female_to_class_name}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <button onClick={() => handleDeleteRule(rule.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          ))}
          {!loading && rules.length === 0 && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No promotion rules defined yet. Click "Add Rule" to begin.
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-500 mb-2">Automatic Graduation (Grade 11)</h4>
        <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
          Students in Grade 11 do not need promotion rules. They will be automatically graduated to "Alumni" status during the execution phase.
        </p>
        <div className="flex flex-wrap gap-2">
          {grade11Classes.map(c => (
            <span key={c.id} className="inline-block px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium rounded">
              {c.name}
            </span>
          ))}
          {grade11Classes.length === 0 && (
            <span className="text-xs text-amber-600/70 dark:text-amber-500/50">No Grade 11 classes exist.</span>
          )}
        </div>
      </div>
      </div>

      {/* Add Rule Dialog */}
      <Dialog open={newRule} onOpenChange={setNewRule}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Promotion Rule</DialogTitle>
            <DialogDescription>Define how students map from one class to the next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From Class <span className="text-red-500">*</span></label>
              <select value={form.from_class_id} onChange={e => setForm({...form, from_class_id: e.target.value})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm outline-none">
                <option value="">Select source class...</option>
                {classes.filter(c => parseInt(c.grade) < 11 && !rules.find(r => r.from_class_id === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">Target Classes</label>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">For Male Students</label>
                  <select value={form.male_to_class_id} onChange={e => setForm({...form, male_to_class_id: e.target.value})} className="w-full px-3 py-2 border border-blue-200 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="">Select target...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-pink-600 dark:text-pink-400 font-medium mb-1">For Female Students</label>
                  <select value={form.female_to_class_id} onChange={e => setForm({...form, female_to_class_id: e.target.value})} className="w-full px-3 py-2 border border-pink-200 dark:border-pink-900/50 rounded-lg bg-pink-50 dark:bg-pink-900/10 text-sm outline-none text-slate-900 dark:text-white">
                    <option value="">Select target...</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 italic">
                * If you want all students from this class to go to the exact same class, select it for both Male and Female.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setNewRule(false)} className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleCreateRule} className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">Create Rule</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
