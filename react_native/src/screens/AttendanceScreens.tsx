import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, EmptyState, Field, LoadingView, PageHeader, Pill, Row, Screen, Segmented, SelectField } from '../components/UI';
import { useTheme } from '../contexts/ThemeContext';
import { api, ApiError } from '../services/api';
import type { AttendanceReport, SchoolClass, Student } from '../types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const latestSunday = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return iso(d); };
export function AttendanceHomeScreen({ navigation }: any) { const { colors } = useTheme(); return <Screen><PageHeader title="Attendance" subtitle="Weekly attendance tools" /><Pressable onPress={() => navigation.navigate('MarkAttendance')}><Card style={s.action}><View style={[s.actionIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="checkbox-outline" size={28} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[s.actionTitle, { color: colors.text }]}>Mark Attendance</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>Record or update a Sunday register</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Card></Pressable><Pressable onPress={() => navigation.navigate('AttendanceHistory')}><Card style={s.action}><View style={[s.actionIcon, { backgroundColor: `${colors.info}18` }]}><Ionicons name="stats-chart-outline" size={28} color={colors.info} /></View><View style={{ flex: 1 }}><Text style={[s.actionTitle, { color: colors.text }]}>Attendance History</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 3 }}>Monthly and yearly student reports</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Card></Pressable></Screen>; }

export function MarkAttendanceScreen({ route }: any) {
  const { colors } = useTheme(); const qc = useQueryClient(); const [classId, setClassId] = useState(route.params?.classId || ''); const [date, setDate] = useState(route.params?.date || latestSunday()); const [marks, setMarks] = useState<Record<string, 'Present' | 'Absent'>>({}); const [existing, setExisting] = useState(false); const [busy, setBusy] = useState(false);
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get<SchoolClass[]>('/classes') });
  const validSundays = useQuery({ queryKey: ['sundays'], queryFn: async () => { const year = await api.get<any>('/academic-years/current'); const start = new Date(year.start_date); const today = new Date(); const sundays: string[] = []; let current = new Date(start); if (current.getDay() !== 0) current.setDate(current.getDate() + (7 - current.getDay())); while (current <= today) { sundays.push(iso(current)); current.setDate(current.getDate() + 7); } return sundays.reverse(); } });
  useEffect(() => { if (!classId && classes.data?.length) setClassId(classes.data[0].id); }, [classes.data, classId]);
  useEffect(() => { if (validSundays.data?.length && !route.params?.date) setDate(validSundays.data[0]); }, [validSundays.data, route.params?.date]);
  const register = useQuery({ queryKey: ['register', classId, date], enabled: !!classId && !!date, queryFn: async () => { const [students, response] = await Promise.all([api.get<Student[]>(`/classes/${classId}/students`), api.get<{ items: { student_id: string; status: 'Present' | 'Absent' }[] }>(`/attendance?class_id=${classId}&attendance_date=${date}&page_size=100`).catch(() => ({ items: [] }))]); return { students: students.filter(x => x.status === 'Active'), records: response.items || [] }; } });
  useEffect(() => { if (register.data) { const next: typeof marks = {}; register.data.records.forEach(x => next[x.student_id] = x.status); setMarks(next); setExisting(register.data.records.length > 0); } }, [register.data]);
  const markAll = (status: 'Present' | 'Absent') => { const next: typeof marks = {}; register.data?.students.forEach(x => next[x.id] = status); setMarks(next); };
  const submit = async () => { const students = register.data?.students || []; if (!students.length || students.some(x => !marks[x.id])) return Alert.alert('Incomplete register', 'Mark every student present or absent before submitting.'); setBusy(true); try { await api.post('/attendance/bulk', { class_id: classId, date, records: students.map(x => ({ student_id: x.id, status: marks[x.id] })) }); setExisting(true); qc.invalidateQueries({ queryKey: ['dashboard'] }); Alert.alert('Saved', 'Attendance was submitted successfully.'); } catch (e) { Alert.alert('Could not submit', (e as ApiError).message); } finally { setBusy(false); } };
  const present = Object.values(marks).filter(x => x === 'Present').length; const absent = Object.values(marks).filter(x => x === 'Absent').length;
  const sundayOptions = validSundays.data?.length ? validSundays.data.map(d => ({ value: d, label: d })) : [{ value: date, label: date }];
  return <Screen><PageHeader title="Mark Attendance" subtitle={existing ? 'Editing a submitted register' : 'New attendance register'} /><Card style={{ gap: 14 }}><SelectField label="Class" value={classId} options={(classes.data || []).map(c => ({ value: c.id, label: c.name || `Grade ${c.grade} ${c.medium} ${c.gender_type}` }))} onChange={setClassId} /><SelectField label="Sunday date" value={date} options={sundayOptions} onChange={setDate} /><View style={s.two}><View style={{ flex: 1 }}><Button compact title="All Present" variant="outline" icon="checkmark" onPress={() => markAll('Present')} /></View><View style={{ flex: 1 }}><Button compact title="All Absent" variant="danger" icon="close" onPress={() => markAll('Absent')} /></View></View><View style={s.summary}><Pill text={`Present ${present}`} /><Pill text={`Absent ${absent}`} tone="red" /><Pill text={`${Object.keys(marks).length}/${register.data?.students.length || 0} marked`} tone="gray" /></View></Card>{register.isLoading ? <LoadingView /> : !register.data?.students.length ? <EmptyState icon="people-outline" title="No active students" /> : <Card>{register.data.students.map((st, index) => <View key={st.id} style={[s.student, { borderBottomColor: colors.border }]}><Text style={[s.number, { color: colors.muted }]}>{index + 1}</Text><Avatar name={st.full_name} size={38} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>{st.full_name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{st.registration_number}</Text></View><Pressable onPress={() => setMarks(v => ({ ...v, [st.id]: 'Present' }))} style={[s.mark, { backgroundColor: marks[st.id] === 'Present' ? colors.primary : colors.primarySoft }]}><Ionicons name="checkmark" color={marks[st.id] === 'Present' ? '#fff' : colors.primary} size={18} /></Pressable><Pressable onPress={() => setMarks(v => ({ ...v, [st.id]: 'Absent' }))} style={[s.mark, { backgroundColor: marks[st.id] === 'Absent' ? colors.danger : colors.dangerSoft }]}><Ionicons name="close" color={marks[st.id] === 'Absent' ? '#fff' : colors.danger} size={18} /></Pressable></View>)}</Card>}<Button title={existing ? 'Update Attendance' : 'Submit Attendance'} icon="save-outline" loading={busy} onPress={submit} /></Screen>;
}

export function AttendanceHistoryScreen({ route, navigation }: any) {
  const { colors } = useTheme(); const [classId, setClassId] = useState(route.params?.classId || ''); const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly'); const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [search, setSearch] = useState('');
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get<SchoolClass[]>('/classes') }); useEffect(() => { if (!classId && classes.data?.length) setClassId(classes.data[0].id); }, [classes.data]);
  const report = useQuery({ queryKey: ['attendanceReport', classId, mode, month], enabled: !!classId, queryFn: () => api.get<AttendanceReport>(`/attendance/report?class_id=${classId}&mode=${mode}${mode === 'monthly' ? `&month=${month}` : ''}`) });
  const rows = useMemo(() => (report.data?.students || []).filter(x => !search || x.student_name.toLowerCase().includes(search.toLowerCase())), [report.data, search]);
  
  const handlePrevMonth = () => { const [y, m] = month.split('-'); const d = new Date(parseInt(y), parseInt(m) - 1 - 1, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const handleNextMonth = () => { const [y, m] = month.split('-'); const d = new Date(parseInt(y), parseInt(m) - 1 + 1, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const formatMonth = (m: string) => { const [y, mo] = m.split('-'); const d = new Date(parseInt(y), parseInt(mo) - 1, 1); return d.toLocaleString('default', { month: 'long', year: 'numeric' }); };

  return <Screen refreshing={report.isRefetching} onRefresh={report.refetch}><PageHeader title="Attendance History" subtitle="Student attendance report" /><Card style={{ gap: 13 }}><SelectField label="Class" value={classId} options={(classes.data || []).map(c => ({ value: c.id, label: c.name || `Grade ${c.grade} ${c.medium} ${c.gender_type}` }))} onChange={setClassId} /><Segmented value={mode} options={[{ label: 'Monthly', value: 'monthly' }, { label: 'Yearly', value: 'yearly' }]} onChange={setMode} />
    {mode === 'monthly' && (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 4 }}>
        <Pressable onPress={handlePrevMonth} style={{ padding: 10 }}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{formatMonth(month)}</Text>
        <Pressable onPress={handleNextMonth} style={{ padding: 10 }}><Ionicons name="chevron-forward" size={20} color={colors.text} /></Pressable>
      </View>
    )}
    <Field label="Search students" placeholder="Student name" value={search} onChangeText={setSearch} /></Card>{report.isLoading ? <LoadingView /> : !rows.length ? <EmptyState icon="calendar-outline" title="No attendance records" /> : <Card>{rows.map(st => { const markedDates = Object.keys(st.attendance || {}).length; const presentCount = st.present_count; const percentage = markedDates ? Math.round((presentCount / markedDates) * 1000) / 10 : 0; const sundays = report.data?.sundays || []; return <Pressable key={st.student_id} onPress={() => navigation.navigate('StudentsTab', { screen: 'StudentDetail', params: { id: st.student_id } })} style={[s.reportRow, { borderBottomColor: colors.border }]}><Avatar name={st.student_name} size={40} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700' }}>{st.student_name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{presentCount} present</Text>
    
    {mode === 'monthly' ? (
      <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
        {sundays.map(dateStr => {
          const dayStr = dateStr.slice(8, 10);
          const status = st.attendance[dateStr];
          const isPresent = status === 'Present';
          const isAbsent = status === 'Absent';
          const bgColor = isPresent ? `${colors.primary}20` : isAbsent ? `${colors.danger}20` : colors.surfaceAlt;
          const textColor = isPresent ? colors.primary : isAbsent ? colors.danger : colors.muted;
          return (
            <View key={dateStr} style={{ alignItems: 'center', width: 30 }}>
              <Text style={{ fontSize: 10, color: colors.muted, marginBottom: 4 }}>{dayStr}</Text>
              <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: textColor }}>
                  {isPresent ? 'P' : isAbsent ? 'A' : '-'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    ) : (
      <View style={s.reportSummary}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {presentCount} present out of {markedDates} attendance dates
        </Text>
      </View>
    )}

    </View><Pill text={`${percentage}%`} tone={percentage >= 80 ? 'green' : percentage >= 60 ? 'amber' : 'red'} /></Pressable>; })}</Card>}</Screen>;
}
const s = StyleSheet.create({ action: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 22 }, actionIcon: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, actionTitle: { fontSize: 16, fontWeight: '800' }, two: { flexDirection: 'row', gap: 9 }, summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, student: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth }, number: { width: 18, textAlign: 'center', fontSize: 11 }, mark: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, reportRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth }, reportSummary: { marginTop: 3 } });
