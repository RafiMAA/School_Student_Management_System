import { Sun, Moon, Monitor, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppearanceModal({ isOpen, onClose }: AppearanceModalProps) {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-xs border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <h3 className="font-semibold text-slate-900 dark:text-white">Appearance</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-1">
          <button
            onClick={() => { setTheme('light'); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              theme === 'light' 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium' 
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Sun className="w-4 h-4" /> 
            <span>Light</span>
            {theme === 'light' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
          
          <button
            onClick={() => { setTheme('dark'); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              theme === 'dark' 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium' 
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Moon className="w-4 h-4" /> 
            <span>Dark</span>
            {theme === 'dark' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>

          <button
            onClick={() => { setTheme('system'); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              theme === 'system'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>System</span>
            {theme === 'system' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>
        </div>
      </div>
    </div>
  );
}
