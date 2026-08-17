import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Download, AlertTriangle, CheckCircle2, FileText, RotateCcw, Rocket } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/contexts/ToastContext';
import { useApp } from '@/contexts/AppContext';
import { exportCsv } from '@/lib/csvExport';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/apiClient';
import type { PromotionPreviewRow } from '@/types';

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

export default function PromotionPreview() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentAcademicYear } = useApp();
  const queryClient = useQueryClient();
  
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [undoDialog, setUndoDialog] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const { data: previewData = [], isLoading: loading, error } = useQuery({
    queryKey: ['promotion-preview'],
    queryFn: () => api.get<PromotionPreviewRow[]>('/promotion/preview'),
  });

  useEffect(() => {
    if (error) addToast('error', 'Failed to load promotion preview');
  }, [error, addToast]);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const years = await api.get<{id: string, year_label: string}[]>('/academic-years');
      const activeYearId = years.find(y => y.year_label === currentAcademicYear)?.id;
      if (!activeYearId) throw new Error('No active academic year found');
      
      const selected = new Date(startDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Allow any time today
      if (selected > today) {
        addToast('error', 'Start date cannot be in the future.');
        setExecuting(false);
        return;
      }

      const result = await api.post<{promoted: number, graduated: number, errors: string[]}>('/promotion/execute', {
        academic_year_id: activeYearId,
        start_date: startDate
      });
      
      setConfirmDialog(false);
      addToast('success', `Promotion complete: ${result.promoted} promoted, ${result.graduated} graduated.`);
      if (result.errors.length > 0) {
        addToast('error', `Completed with ${result.errors.length} errors. Check audit logs.`);
      }
      
      // Refresh preview to show it's empty now
      queryClient.invalidateQueries({ queryKey: ['promotion-preview'] });
      queryClient.invalidateQueries({ queryKey: ['current-academic-year'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (error: unknown) {
      addToast('error', getErrorDetail(error, 'Failed to execute promotion'));
    } finally {
      setExecuting(false);
    }
  };

  const handleUndo = async () => {
    setUndoing(true);
    try {
      const result = await api.post<{message: string}>('/promotion/execute/undo');
      setUndoDialog(false);
      addToast('success', result.message);
      
      queryClient.invalidateQueries({ queryKey: ['promotion-preview'] });
      queryClient.invalidateQueries({ queryKey: ['current-academic-year'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    } catch (error: unknown) {
      addToast('error', getErrorDetail(error, 'Failed to undo promotion'));
    } finally {
      setUndoing(false);
    }
  };

  const exportExcel = () => {
    if (!previewData || previewData.length === 0) return;
    
    const headers = ['Student Name', 'Gender', 'Current Class', 'Action', 'Target Class'];
    const rows = previewData.map(row => [
      row.student_name,
      row.gender,
      row.current_class,
      row.action,
      row.target_class
    ]);

    exportCsv(`Promotion_Preview_${currentAcademicYear}.csv`, [headers, ...rows]);
  };

  const exportPDF = () => {
    if (!previewData || previewData.length === 0) return;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(`Promotion Preview - ${currentAcademicYear}`, 14, 15);
    
    const headers = ['Student Name', 'Gender', 'Current Class', 'Action', 'Target Class'];
    const body = previewData.map(row => [
      row.student_name,
      row.gender,
      row.current_class,
      row.action,
      row.target_class
    ]);

    autoTable(doc, {
      startY: 25,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [16, 185, 129] } // emerald-500
    });
    
    doc.save(`Promotion_Preview_${currentAcademicYear}.pdf`);
  };

  const getActionBadge = (action: string) => {
    if (action === 'PROMOTE') return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400';
    if (action === 'GRADUATE') return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400';
    return 'bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Promotion Preview</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Review the changes before applying them to the database.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:ml-auto">
          <div className="flex gap-2">
            <button onClick={exportPDF} disabled={previewData.length === 0 || loading} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              <FileText className="w-4 h-4 text-red-500 shrink-0" /> <span>PDF</span>
            </button>
            <button onClick={exportExcel} disabled={previewData.length === 0 || loading} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              <Download className="w-4 h-4 text-emerald-500 shrink-0" /> <span>Excel</span>
            </button>
          </div>
          <div className="pwa-preview-compact-actions flex gap-2">
            <button 
              onClick={() => setUndoDialog(true)} 
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium rounded-lg transition-colors active:scale-95"
            >
              <RotateCcw className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Undo Last</span><span className="sm:hidden">Undo</span>
            </button>
            <button 
              onClick={() => setConfirmDialog(true)} 
              disabled={previewData.length === 0 || loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors active:scale-95"
            >
              <Play className="w-4 h-4 shrink-0" /> Execute
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{previewData.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Promote</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{previewData.filter(d => d.action === 'PROMOTE').length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Graduate</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{previewData.filter(d => d.action === 'GRADUATE').length}</p>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Student Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Gender</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Current Class</th>
                <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Target Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                 <tr><td colSpan={5} className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" /></td></tr>
              ) : previewData.map((row) => (
                <tr key={row.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                    <Link to={`/students/${row.student_id}`} className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">
                      {row.student_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{row.gender}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{row.current_class}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold tracking-wide ${getActionBadge(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">
                    {row.target_class}
                  </td>
                </tr>
              ))}
              {!loading && previewData.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                      <AlertTriangle className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No students available for promotion.</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Please ensure promotion rules are defined and there are active students.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : previewData.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
              <AlertTriangle className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">No students available for promotion.</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Please ensure promotion rules are defined and there are active students.</p>
          </div>
        ) : previewData.map((row) => (
          <div key={row.student_id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <Link to={`/students/${row.student_id}`} className="text-sm font-medium text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[60%]">
                {row.student_name}
              </Link>
              <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold tracking-wide shrink-0 ${getActionBadge(row.action)}`}>
                {row.action}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{row.gender}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>{row.current_class}</span>
              <span className="text-slate-300 dark:text-slate-600">→</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{row.target_class}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pwa-only pwa-preview-native-actions">
        <button
          type="button"
          className="execute"
          onClick={() => setConfirmDialog(true)}
          disabled={previewData.length === 0 || loading}
        >
          <Rocket aria-hidden="true" /> Execute Promotion
        </button>
        <button
          type="button"
          className="undo"
          onClick={() => setUndoDialog(true)}
          disabled={loading}
        >
          <RotateCcw aria-hidden="true" /> Undo Last Promotion
        </button>
      </div>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Confirm Execution
            </DialogTitle>
            <DialogDescription>
              This action will irreversibly update the database. It will promote students, update their current classes, and graduate Grade 11 students to alumni status.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 mt-4">
            <p className="text-sm text-red-800 dark:text-red-400 font-medium">Are you absolutely sure you want to proceed?</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">Make sure you have created the new academic year and set it as current before running this process.</p>
          </div>

          <div className="mt-2 space-y-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              New Academic Year Start Date
            </label>
            <input 
              type="date"
              value={startDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Must be today or a past date.</p>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4 mt-3">
            <p className="text-sm text-amber-800 dark:text-amber-400 font-medium flex items-center gap-1.5">
              <Download className="w-4 h-4" /> Recommended Action
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
              Please download the Promotion Preview as a PDF or Excel backup before executing. Once executed, the preview list will be cleared.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setConfirmDialog(false)} disabled={executing} className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleExecute} disabled={executing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
              {executing ? 'Executing...' : 'Yes, Execute Promotion'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={undoDialog} onOpenChange={setUndoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="w-5 h-5" /> Undo Last Promotion
            </DialogTitle>
            <DialogDescription>
              This will revert the most recent promotion. Students will be returned to their previous classes, and alumni from the last batch will be marked active again.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-800 dark:text-amber-400 font-medium">Warning</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
              Any attendance records or data created for the current (new) academic year will be permanently deleted. The system will be restored to the state of the previous academic year.
            </p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setUndoDialog(false)} disabled={undoing} className="px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handleUndo} disabled={undoing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
              {undoing ? 'Undoing...' : 'Yes, Undo Promotion'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
