import { useState } from 'react';
import { Upload, FileUp, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/apiClient';
import { saveAs } from 'file-saver';

interface ValidationResult {
  valid: number;
  imported: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
}

export default function ExcelImport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const template = await api.get<Blob>('/import/students/template');
      saveAs(template, 'student_import_template.xlsx');
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to download the Excel template');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        addToast('error', 'Please upload a valid .xlsx or .csv file');
      }
    }
  };

  const handleProcess = async (confirmed: boolean = false) => {
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    if (confirmed) {
      formData.append('confirmed', 'true');
    }

    try {
      const res = await api.upload<ValidationResult>('/import/students', formData);
      setResult(res);
      if (confirmed && res.errors.length === 0) {
        addToast('success', `${res.imported} students imported successfully`);
        queryClient.invalidateQueries({ queryKey: ['students'] });
        navigate('/students');
      } else {
        setStep(3);
      }
    } catch (err: any) {
      addToast('error', err?.data?.detail || 'Failed to process Excel file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Import Data via Excel</h2>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={downloading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> {downloading ? 'Preparing...' : 'Download Template'}
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            }`}>
              {s}
            </div>
            {s < 3 && (
              <div className={`w-16 sm:w-32 h-1 mx-2 rounded-full ${
                step > s ? 'bg-emerald-600' : 'bg-slate-100 dark:bg-slate-800'
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between px-2 sm:px-12 text-xs font-medium text-slate-500 mb-8 -mt-6">
        <span>Prepare</span>
        <span className="text-center">Upload</span>
        <span>Review</span>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Prepare Your Data</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please ensure your Excel file matches our template structure exactly.</p>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Required Template Format:</h4>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <strong>Row 1 (Headers):</strong> Full Name | Gender | Date of Birth | Parent/Guardian Name | Parent Contact | Secondary Name | Secondary Contact | Class | Joined Date
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <strong>Row 2+:</strong> Enter student data and choose Gender and Class from the provided dropdowns
                </li>
              </ul>
            </div>

            <button onClick={() => setStep(2)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors">
              I have prepared my file
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                file ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {file ? file.name : 'Drag & drop your Excel file here'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse from your computer'}
              </p>
              
              <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Browse Files
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.csv"
                  onChange={e => e.target.files?.length && setFile(e.target.files[0])}
                />
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Back
              </button>
              <button 
                onClick={() => handleProcess(false)} 
                disabled={!file || loading}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors"
              >
                {loading ? 'Processing...' : (
                  <>
                    <FileUp className="w-5 h-5" /> Validate & Review
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
            <div className="text-center mb-8">
              {result.errors.length === 0 ? (
                <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Validation Complete</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Found {result.valid} valid records. {result.errors.length > 0 && `${result.errors.length} rows have errors.`}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl overflow-hidden mb-6">
                <div className="px-4 py-3 bg-red-100/50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-900/30 font-medium text-red-800 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Please fix the following errors in your file and try again
                </div>
                <div className="max-h-60 overflow-y-auto p-4 space-y-2">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-600 dark:text-red-400 flex gap-4">
                      <span className="font-mono bg-red-100 dark:bg-red-900/40 px-2 rounded w-16 text-center shrink-0">Row {err.row}</span>
                      <span><strong>{err.field}</strong>: {err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => { setStep(2); setFile(null); setResult(null); }} 
                className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Upload New File
              </button>
              {result.errors.length === 0 && (
                <button 
                  onClick={() => handleProcess(true)}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-colors"
                >
                  {loading ? 'Importing...' : 'Confirm & Import All Data'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
