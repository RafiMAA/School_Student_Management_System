import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, FileText, Download } from 'lucide-react';
import { format, parseISO, subMonths, addMonths } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/apiClient';
import { exportCsv } from '@/lib/csvExport';
import type { Class } from '@/types';
import { usePwaUi } from '@/hooks/use-pwa-ui';

interface AttendanceReportResponse {
  sundays: string[];
  students: {
    student_id: string;
    student_name: string;
    registration_number: string;
    attendance: Record<string, 'Present' | 'Absent'>;
    present_count: number;
    percentage: number;
  }[];
  summary: Record<string, { present: number; total: number }>;
}

export default function AttendanceHistory() {
  const pwaUi = usePwaUi();
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('class_id') || '';

  const { addToast } = useToast();
  const [selectedClass, setSelectedClass] = useState<string>(initialClassId);
  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<Class[]>('/classes'),
  });

  const classes = useMemo(() => classesData || [], [classesData]);
  const effectiveClass = selectedClass || classes[0]?.id || '';

  // Fetch report
  const monthStr = format(currentMonth, 'yyyy-MM');
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: ['attendance-report', effectiveClass, mode, monthStr],
    queryFn: () => {
      if (!effectiveClass) return null;
      let url = `/attendance/report?class_id=${effectiveClass}&mode=${mode}`;
      if (mode === 'monthly') url += `&month=${monthStr}`;
      return api.get<AttendanceReportResponse>(url);
    },
    enabled: !!effectiveClass,
  });

  useEffect(() => {
    if (error) {
      addToast('error', 'Failed to load attendance report');
    }
  }, [error, addToast]);

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!reportData?.students) return [];
    if (!searchQuery.trim()) return reportData.students;
    const lowerQuery = searchQuery.toLowerCase();
    return reportData.students.filter(s => 
      s.student_name.toLowerCase().includes(lowerQuery) || 
      s.registration_number.toLowerCase().includes(lowerQuery)
    );
  }, [reportData, searchQuery]);

  const sundays = reportData?.sundays || [];
  const summary = reportData?.summary || {};

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400', 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  const exportExcel = () => {
    if (!reportData) return;
    
    // Construct headers
    const headers = ['#', 'Student Name', 'Reg No.', ...sundays.map(d => format(parseISO(d), 'MMM dd')), 'Monthly %'];
    
    // Construct rows
    const rows = filteredStudents.map((s, i) => {
      const rowData: Array<string | number> = [
        i + 1,
        s.student_name,
        s.registration_number,
      ];
      sundays.forEach(date => {
        const status = s.attendance[date];
        rowData.push(status === 'Present' ? 'P' : status === 'Absent' ? 'A' : '-');
      });
      rowData.push(`${s.percentage}%`);
      return rowData;
    });

    // Summary row
    const summaryRow = ['-', 'Class Summary', '-'];
    sundays.forEach(date => {
      const daySum = summary[date];
      summaryRow.push(daySum ? `${daySum.present} / ${daySum.total}` : '-');
    });
    // Calculate avg %
    const totalPct = filteredStudents.reduce((acc, s) => acc + s.percentage, 0);
    const avgPct = filteredStudents.length ? Math.round(totalPct / filteredStudents.length) : 0;
    summaryRow.push(`${avgPct}% Avg`);
    
    rows.push(summaryRow);

    exportCsv(`Attendance_${effectiveClass}_${mode}.csv`, [headers, ...rows]);
  };

  const exportPDF = () => {
    if (!reportData) return;
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text(`Attendance Report - ${mode === 'monthly' ? format(currentMonth, 'MMMM yyyy') : 'Yearly'}`, 14, 15);
    
    const headers = ['#', 'Student Name', 'Reg No.', ...sundays.map(d => format(parseISO(d), 'MMM dd')), 'Monthly %'];
    
    const body = filteredStudents.map((s, i) => {
      const rowData: Array<string | number> = [
        i + 1,
        s.student_name,
        s.registration_number,
      ];
      sundays.forEach(date => {
        const status = s.attendance[date];
        rowData.push(status === 'Present' ? 'P' : status === 'Absent' ? 'A' : '-');
      });
      rowData.push(`${s.percentage}%`);
      return rowData;
    });

    autoTable(doc, {
      startY: 25,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] } // emerald-500
    });
    
    doc.save(`Attendance_${effectiveClass}_${mode}.pdf`);
  };

  if (pwaUi) {
    return (
      <div className="pwa-attendance-history">
        <div className="pwa-page-heading">
          <h1>Attendance History</h1>
          <p>Student attendance report</p>
        </div>

        <section className="pwa-history-controls">
          <label>
            <span>Class</span>
            <select value={effectiveClass} onChange={event => setSelectedClass(event.target.value)}>
              {classes.length === 0 && <option value="">Loading classes...</option>}
              {classes.map(schoolClass => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
            </select>
          </label>

          <div className="pwa-history-segment" role="group" aria-label="Report period">
            <button type="button" className={mode === 'monthly' ? 'is-active' : ''} onClick={() => setMode('monthly')}>Monthly</button>
            <button type="button" className={mode === 'yearly' ? 'is-active' : ''} onClick={() => setMode('yearly')}>Yearly</button>
          </div>

          {mode === 'monthly' && (
            <div className="pwa-history-month">
              <button type="button" onClick={handlePrevMonth} aria-label="Previous month"><ChevronLeft /></button>
              <strong>{format(currentMonth, 'MMMM yyyy')}</strong>
              <button type="button" onClick={handleNextMonth} aria-label="Next month"><ChevronRight /></button>
            </div>
          )}

          <label>
            <span>Search students</span>
            <input type="search" placeholder="Student name" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} />
          </label>
        </section>

        <section className="pwa-history-list" aria-live="polite">
          {isLoading ? (
            <div className="pwa-student-loading"><span /></div>
          ) : !effectiveClass ? (
            <p className="pwa-student-empty">Select a class to view attendance.</p>
          ) : filteredStudents.length === 0 ? (
            <p className="pwa-student-empty">No attendance records found</p>
          ) : filteredStudents.map(student => {
            const attendanceDates = Object.values(student.attendance).filter(Boolean).length;
            const percentageTone = student.percentage >= 80 ? 'good' : student.percentage >= 60 ? 'warn' : 'bad';
            return (
              <Link key={student.student_id} to={`/students/${student.student_id}`} className="pwa-history-row">
                <span className="pwa-history-avatar">{getInitials(student.student_name)}</span>
                <span className="pwa-history-copy">
                  <strong>{student.student_name}</strong>
                  <small>{student.present_count} present</small>
                  {mode === 'yearly' ? (
                    <small>{student.present_count} present out of {attendanceDates} attendance dates</small>
                  ) : (
                    <span className="pwa-history-days">
                      {sundays.map(date => {
                        const status = student.attendance[date];
                        return (
                          <span key={date}>
                            <small>{format(parseISO(date), 'dd')}</small>
                            <b className={status === 'Present' ? 'present' : status === 'Absent' ? 'absent' : ''}>
                              {status === 'Present' ? 'P' : status === 'Absent' ? 'A' : '–'}
                            </b>
                          </span>
                        );
                      })}
                    </span>
                  )}
                </span>
                <span className={`pwa-history-percent ${percentageTone}`}>{student.percentage}%</span>
              </Link>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        
        {/* Left Side: Search & Class */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search student..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
            />
          </div>
          
          <select
            value={effectiveClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
          >
            {classes.length === 0 && <option value="">Loading classes...</option>}
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Right Side: Mode Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full lg:w-auto justify-center">
          <button 
            onClick={() => setMode('monthly')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'monthly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setMode('yearly')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'yearly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            Yearly
          </button>
        </div>
      </div>

      {/* Second Row Controls: Month Selector & Export */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Month Selector (only in monthly mode) */}
        <div className="flex items-center gap-4">
          {mode === 'monthly' ? (
            <>
              <button onClick={handlePrevMonth} className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
              </div>
              <button onClick={handleNextMonth} className="p-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          ) : (
             <div className="flex items-center gap-2">
               <span className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Academic Year to Date
               </span>
             </div>
          )}
        </div>

        {/* Exports */}
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={exportPDF} disabled={!reportData || filteredStudents.length === 0} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
            <FileText className="w-4 h-4 text-red-500" /> Download PDF
          </button>
          <button onClick={exportExcel} disabled={!reportData || filteredStudents.length === 0} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4 text-emerald-500" /> Download Excel
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <p className="mt-4 text-sm text-slate-500">Loading attendance data...</p>
          </div>
        ) : !effectiveClass ? (
          <div className="text-center py-20 text-slate-500">Please select a class to view history.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full ${mode === 'yearly' ? 'whitespace-nowrap min-w-max' : ''}`}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-2 sm:px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 w-8 sm:w-12 border-r border-slate-100 dark:border-slate-800">#</th>
                  <th className="px-2 sm:px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-[1px_0_0_0_#f1f5f9] dark:shadow-[1px_0_0_0_#1e293b] min-w-[90px]">Student Name</th>
                  {sundays.map((dateStr) => {
                    const d = parseISO(dateStr);
                    const isUpcoming = d > new Date();
                    return (
                      <th key={dateStr} className={`px-1 sm:px-4 py-4 text-center text-xs font-semibold ${isUpcoming ? 'text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30' : 'text-slate-700 dark:text-slate-300'} border-r border-slate-100 dark:border-slate-800 ${mode === 'yearly' ? 'min-w-[100px]' : 'min-w-[30px]'}`}>
                        {mode === 'yearly' ? format(d, 'MMM dd') : format(d, 'dd')}
                        {isUpcoming && <div className="text-[9px] sm:text-[10px] font-normal text-slate-400 mt-0.5">Upcoming</div>}
                      </th>
                    );
                  })}
                  <th className="px-2 sm:px-4 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 sticky right-0 shadow-[-1px_0_0_0_#f1f5f9] dark:shadow-[-1px_0_0_0_#1e293b] z-10 w-16">Total %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={sundays.length + 3} className="text-center py-12 text-slate-500 text-sm">No students found</td>
                  </tr>
                ) : filteredStudents.map((student, idx) => (
                  <tr key={student.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-xs sm:text-sm">
                    <td className="px-2 sm:px-4 py-3 text-slate-500 border-r border-slate-100 dark:border-slate-800">{idx + 1}</td>
                    <td className="px-2 sm:px-4 py-3 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 shadow-[1px_0_0_0_#f1f5f9] dark:shadow-[1px_0_0_0_#1e293b]">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${getAvatarColor(student.student_name)}`}>
                          {getInitials(student.student_name)}
                        </div>
                        <Link to={`/students/${student.student_id}`} className="font-medium text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors">
                          {student.student_name}
                        </Link>
                      </div>
                    </td>
                    
                    {sundays.map(dateStr => {
                      const status = student.attendance[dateStr];
                      const isUpcoming = parseISO(dateStr) > new Date();
                      
                      return (
                        <td key={dateStr} className={`px-1 sm:px-4 py-3 text-center border-r border-slate-100 dark:border-slate-800 ${isUpcoming ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                          {status === 'Present' ? (
                            <div className="mx-auto w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold text-[10px] sm:text-xs">P</div>
                          ) : status === 'Absent' ? (
                            <div className="mx-auto w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 font-bold text-[10px] sm:text-xs">A</div>
                          ) : (
                            <div className="mx-auto w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 font-bold text-[10px] sm:text-xs">-</div>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-2 sm:px-4 py-3 text-center sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 shadow-[-1px_0_0_0_#f1f5f9] dark:shadow-[-1px_0_0_0_#1e293b] z-10">
                      <span className={`inline-block px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold ${
                        student.percentage >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        student.percentage >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {student.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              
              {/* Footer Summary Row */}
              {filteredStudents.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={2} className="px-2 sm:px-4 py-4 text-right text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                      Summary:
                    </td>
                    
                    {sundays.map(dateStr => {
                      const isUpcoming = parseISO(dateStr) > new Date();
                      const daySum = summary[dateStr];
                      if (isUpcoming) {
                        return <td key={dateStr} className="px-1 sm:px-4 py-4 text-center text-[10px] sm:text-sm text-slate-400 border-r border-slate-200 dark:border-slate-700">-</td>;
                      }
                      return (
                        <td key={dateStr} className="px-1 sm:px-4 py-4 text-center text-[10px] sm:text-sm font-medium border-r border-slate-200 dark:border-slate-700">
                          {daySum && daySum.total > 0 ? (
                            <span className={daySum.present < daySum.total * 0.5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {daySum.present} / {daySum.total}
                            </span>
                          ) : '-'}
                        </td>
                      );
                    })}

                    <td className="px-2 sm:px-4 py-4 text-center text-[10px] sm:text-sm font-bold text-slate-900 dark:text-white sticky right-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                      {filteredStudents.length > 0 ? (
                        `${Math.round(filteredStudents.reduce((acc, s) => acc + s.percentage, 0) / filteredStudents.length)}% Avg`
                      ) : '-'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
