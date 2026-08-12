import { useState, useEffect } from 'react';
import { Search, Clock, User, ShieldAlert, Download } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { format, parseISO } from 'date-fns';
import api from '@/lib/apiClient';
import { exportCsv } from '@/lib/csvExport';

interface AuditLog {
  id: string;
  action: string;
  details: Record<string, any>;
  performed_by: string;
  performer_name: string;
  performed_at: string;
}

export default function AuditLogs() {
  const { addToast } = useToast();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    setLoading(true);
    let url = `/audit-logs?page=${page}&page_size=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    api.get<{items: AuditLog[], total: number, total_pages: number}>(url)
      .then(res => {
        setLogs(res.items);
        setTotalRecords(res.total);
        setTotalPages(res.total_pages);
      })
      .catch(() => addToast('error', 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [page, search, addToast]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const formatAction = (action: string) => {
    return action.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900';
    if (action.includes('ADD') || action.includes('CREATE')) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900';
    if (action.includes('LOGIN')) return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-900';
    return 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  };

  const handleExportExcel = async () => {
    try {
      let url = `/audit-logs?page=1&page_size=1000`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const res = await api.get<{items: AuditLog[] }>(url);
      
      const headers = ['Timestamp', 'User', 'Action', 'Details'];
      const rows = res.items.map(log => [
        format(parseISO(log.performed_at), 'yyyy-MM-dd HH:mm:ss'),
        log.performer_name,
        formatAction(log.action),
        Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : 'No additional details'
      ]);

      exportCsv(`Audit_Logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`, [headers, ...rows]);
      
      addToast('success', 'Audit logs exported successfully');
    } catch (err) {
      addToast('error', 'Failed to export audit logs');
    }
  };

  // Smart pagination: show limited page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
            System Audit Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Track all administrative actions performed within the system.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action or user..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Timestamp</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" /></td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {format(parseISO(log.performed_at), 'MMM dd, yyyy HH:mm:ss')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      {log.performer_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getActionColor(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-mono text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 max-h-24 overflow-y-auto">
                      {Object.keys(log.details).length > 0 
                        ? JSON.stringify(log.details, null, 2).replace(/[\{\}"]/g, '') 
                        : 'No additional details'}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : logs.map((log) => (
          <div key={log.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[140px]">{log.performer_name}</span>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getActionColor(log.action)}`}>
                {formatAction(log.action)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3 shrink-0" />
              {format(parseISO(log.performed_at), 'MMM dd, yyyy HH:mm:ss')}
            </div>
            {Object.keys(log.details).length > 0 && (
              <div className="mt-2 font-mono text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 max-h-20 overflow-y-auto">
                {JSON.stringify(log.details, null, 2).replace(/[\{\}"]/g, '')}
              </div>
            )}
          </div>
        ))}
        {!loading && logs.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
            No audit logs found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalRecords)} of {totalRecords}</p>
          <div className="flex gap-1 flex-wrap justify-center">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Prev</button>
            {getPageNumbers().map((p, idx) => (
              typeof p === 'string' 
                ? <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-xs text-slate-400">...</span>
                : <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 text-xs border rounded-lg ${page === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
