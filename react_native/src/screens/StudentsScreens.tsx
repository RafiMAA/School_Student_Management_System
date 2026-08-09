import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, EmptyState, Field, LoadingView, PageHeader, Pill, Row, Screen, Segmented, SelectField } from '../components/UI';
import { useTheme } from '../contexts/ThemeContext';
import { api, ApiError } from '../services/api';
import type { SchoolClass, Student } from '../types';

export function StudentsScreen({ navigation }: any) {
  const { colors } = useTheme(); const [search, setSearch] = useState(''); const [gender, setGender] = useState(''); const [medium, setMedium] = useState('');
  const query = useQuery({ queryKey: ['students', search, gender, medium], queryFn: () => { const p = new URLSearchParams({ page: '1', page_size: '100', status: 'Active' }); if (search) p.set('search', search); if (gender) p.set('gender', gender); if (medium) p.set('medium', medium); return api.get<{ items: Student[]; total: number }>(`/students?${p}`); } });
  useFocusEffect(useCallback(() => { query.refetch(); }, []));
  return <Screen refreshing={query.isRefetching} onRefresh={query.refetch}><PageHeader title="Students" subtitle={`${query.data?.total || 0} active students`} action={<View style={s.headerActions}><Button compact title="Import" icon="cloud-upload-outline" variant="outline" onPress={() => navigation.navigate('ImportStudents')} /><Button compact title="Add" icon="add" onPress={() => navigation.navigate('StudentForm')} /></View>} /><Field label="Search" placeholder="Student name" value={search} onChangeText={setSearch} /><View style={s.filterRow}><View style={{ flex: 1 }}><SelectField label="Gender" value={gender} options={[{ label: 'All genders', value: '' }, { label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }]} onChange={setGender} /></View><View style={{ flex: 1 }}><SelectField label="Medium" value={medium} options={[{ label: 'All media', value: '' }, { label: 'Sinhala', value: 'Sinhala' }, { label: 'Tamil', value: 'Tamil' }]} onChange={setMedium} /></View></View>{query.isLoading ? <LoadingView /> : !query.data?.items.length ? <EmptyState icon="people-outline" title="No students found" text="Try changing your filters or add a new student." /> : <Card>{query.data.items.map(st => <Row key={st.id} title={st.full_name} subtitle={`${st.class_name || `Grade ${st.current_grade}`} · ${st.gender}`} onPress={() => navigation.navigate('StudentDetail', { id: st.id })} right={<Pill text={st.medium} tone="blue" />} />)}</Card>}</Screen>;
}

export function StudentDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme(); const id = route.params.id; const qc = useQueryClient();
  const student = useQuery({ queryKey: ['student', id], queryFn: () => api.get<Student>(`/students/${id}`) });
  const attendance = useQuery({ queryKey: ['studentAttendance', id], queryFn: () => api.get<any[]>(`/attendance/student/${id}`) });
  const academicYear = useQuery({ queryKey: ['academicYearCurrent'], queryFn: () => api.get<{ start_date?: string }>('/academic-years/current') });
  const reports = useQuery({ queryKey: ['studentReports', id], queryFn: () => api.get<any[]>(`/students/${id}/achievements`) });
  const [reportText, setReportText] = useState(''); const [reportBusy, setReportBusy] = useState(false);
  
  const records = attendance.data || []; const present = records.filter(x => x.status === 'Present').length; const rate = records.length ? Math.round(present / records.length * 100) : 0;
  
  const monthsData = useMemo(() => {
    const dates = records
      .map(r => r.attendance_date || r.date)
      .filter(Boolean)
      .sort();
    const year = Number((academicYear.data?.start_date || dates[0] || new Date().toISOString()).slice(0, 4));
    const today = new Date();
    const currentSunday = new Date(today);
    currentSunday.setHours(0, 0, 0, 0);
    currentSunday.setDate(today.getDate() - today.getDay());
    const statusByDate = new Map(
      records.map(r => [r.attendance_date || r.date, r.status]),
    );
    const formatDate = (date: Date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    };

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const sundays: { date: string; status?: string }[] = [];
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      for (let day = 1; day <= lastDay; day += 1) {
        const date = new Date(year, monthIndex, day);
        if (date.getDay() === 0) {
          const dateString = formatDate(date);
          sundays.push({ date: dateString, status: statusByDate.get(dateString) });
        }
      }
      return {
        monthKey: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        label: new Date(year, monthIndex, 1).toLocaleString('default', { month: 'short' }),
        days: sundays.map(sunday =>
          new Date(`${sunday.date}T00:00:00`) > currentSunday
            ? { ...sunday, status: 'Upcoming' }
            : sunday,
        ),
      };
    });
  }, [records, academicYear.data?.start_date]);

  if (student.isLoading) return <LoadingView fullScreen />; const st = student.data; if (!st) return <Screen><EmptyState title="Student not found" /></Screen>;

  const remove = () => Alert.alert('Delete student?', 'This action cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/students/${id}`); qc.invalidateQueries({ queryKey: ['students'] }); navigation.goBack(); } catch (e) { Alert.alert('Could not delete', (e as ApiError).message); } } }]);
  const addReport = async () => { if (!reportText.trim()) return; setReportBusy(true); try { await api.post(`/students/${id}/achievements`, { achievement_text: reportText.trim() }); setReportText(''); await qc.invalidateQueries({ queryKey: ['studentReports', id] }); } catch (e) { Alert.alert('Could not add report', (e as ApiError).message); } finally { setReportBusy(false); } };
  const deleteReport = (reportId: string) => Alert.alert('Delete report?', 'This report will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.delete(`/students/${id}/achievements/${reportId}`); qc.invalidateQueries({ queryKey: ['studentReports', id] }); } catch (e) { Alert.alert('Could not delete report', (e as ApiError).message); } } }]);
  return <Screen><View style={s.profile}><Avatar name={st.full_name} size={82} /><Text style={[s.profileName, { color: colors.text }]}>{st.full_name}</Text><Pill text={st.status} /></View>{st.status !== 'Alumni' && (<View style={s.metrics}><Card style={s.metric}><Text style={[s.metricValue, { color: colors.text }]}>{records.length}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Sundays</Text></Card><Card style={s.metric}><Text style={[s.metricValue, { color: colors.primary }]}>{present}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Present</Text></Card><Card style={s.metric}><Text style={[s.metricValue, { color: colors.info }]}>{rate}%</Text><Text style={{ color: colors.muted, fontSize: 11 }}>Rate</Text></Card></View>)}<Card><Row icon="library-outline" title="Class" subtitle={st.class_name || `Grade ${st.current_grade} · ${st.medium}`} /><Row icon="calendar-outline" title="Date of birth" subtitle={st.date_of_birth} /><Row icon="people-outline" title="Parent" subtitle={st.parent_name} /><Row icon="call-outline" title="Parent contact" subtitle={st.parent_contact} /><Row icon="calendar-number-outline" title="Joined" subtitle={st.joined_date} /></Card>{st.status !== 'Alumni' && (<><Text style={[s.section, { color: colors.text }]}>Yearly overview</Text><View style={[s.yearGridWrap, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}><View style={s.yearGrid}>{monthsData.map(m => <View key={m.monthKey} style={s.monthColumn}><Text style={[s.monthLabel, { color: colors.muted }]}>{m.label}</Text>{m.days.map((r, week) => { const bg = r.status === 'Present' ? colors.primary : r.status === 'Absent' ? colors.danger : colors.surfaceAlt; return <View key={`${m.monthKey}-${week}`} style={[s.yearCell, { backgroundColor: bg }]} />; })}</View>)}</View></View></>)}<Card style={s.reportCard}><View style={s.reportHeader}><Ionicons name="document-text-outline" size={18} color={colors.warning} /><Text style={[s.reportTitle, { color: colors.text }]}>Student Report</Text></View><Field label="Add report" placeholder="Year-end marks, Quran count, achievements..." value={reportText} onChangeText={setReportText} multiline /><Button title="Add Report" icon="send-outline" loading={reportBusy} onPress={addReport} />{reports.isLoading ? <LoadingView /> : !reports.data?.length ? <EmptyState icon="document-text-outline" title="No reports recorded" text="Add the student's first report above." /> : <View style={s.reportList}>{reports.data.map(report => <View key={report.id} style={[s.reportItem, { borderBottomColor: colors.border }]}><View style={{ flex: 1 }}><Text style={[s.reportText, { color: colors.text }]}>{report.achievement_text}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{report.academic_year_label || 'Academic year'}</Text></View><Pressable onPress={() => deleteReport(report.id)}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable></View>)}</View>}</Card><View style={s.filterRow}><View style={{ flex: 1 }}><Button title="Edit" icon="create-outline" variant="outline" onPress={() => navigation.navigate('StudentForm', { id })} /></View><View style={{ flex: 1 }}><Button title="Delete" icon="trash-outline" variant="danger" onPress={remove} /></View></View></Screen>;
}

const emptyForm = { fullName: '', gender: '', dob: '', parentName: '', parentName2: '', parentContact: '', parentContact2: '', classId: '', joinedDate: new Date().toISOString().slice(0, 10) };
export function StudentFormScreen({ route, navigation }: any) {
  const id = route.params?.id as string | undefined; const { colors } = useTheme(); const qc = useQueryClient(); const [form, setForm] = useState(emptyForm); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(!id); const [dateField, setDateField] = useState<'dob' | 'joinedDate' | null>(null);
  const classes = useQuery({ queryKey: ['classes'], queryFn: () => api.get<SchoolClass[]>('/classes') });
  React.useEffect(() => { if (id) api.get<Student>(`/students/${id}`).then(x => { setForm({ fullName: x.full_name, gender: x.gender, dob: x.date_of_birth, parentName: x.parent_name || '', parentName2: x.parent_name_2 || '', parentContact: x.parent_contact || '', parentContact2: x.parent_contact_2 || '', classId: x.current_class_id || '', joinedDate: x.joined_date }); setReady(true); }).catch(() => navigation.goBack()); }, [id]);
  const set = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value })); const selected = classes.data?.find(x => x.id === form.classId);
  const save = async () => { if (!form.fullName || !form.gender || !form.dob || !form.parentName || !/^\d{10}$/.test(form.parentContact) || !form.classId) return Alert.alert('Check the form', 'Complete all required fields. Contact numbers must contain 10 digits.'); setBusy(true); const payload = { full_name: form.fullName.trim(), gender: form.gender, date_of_birth: form.dob, parent_name: form.parentName.trim(), parent_name_2: form.parentName2 || undefined, parent_contact: form.parentContact, parent_contact_2: form.parentContact2 || undefined, medium: selected?.medium, current_grade: Number(selected?.grade), current_class_id: form.classId, joined_date: form.joinedDate }; try { id ? await api.patch(`/students/${id}`, payload) : await api.post('/students', payload); await qc.invalidateQueries({ queryKey: ['students'] }); if (id) await qc.invalidateQueries({ queryKey: ['student', id] }); navigation.goBack(); } catch (e) { Alert.alert('Could not save student', (e as ApiError).message); } finally { setBusy(false); } };
  if (!ready || classes.isLoading) return <LoadingView fullScreen />;
  const dateValue = (value: string) => { const parsed = new Date(`${value}T00:00:00`); return Number.isNaN(parsed.getTime()) ? new Date() : parsed; }; const setDateValue = (_event: unknown, selected?: Date) => { if (selected && dateField) { const value = selected.toISOString().slice(0, 10); set(dateField, value); } setDateField(null); };
  return <Screen><PageHeader title={id ? 'Edit Student' : 'Add Student'} subtitle="Student and parent information" /><Card style={{ gap: 15 }}><Field label="Full name *" placeholder="Student full name" value={form.fullName} onChangeText={v => set('fullName', v)} /><Text style={[s.fieldLabel, { color: colors.muted }]}>Gender *</Text><Segmented value={form.gender} options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }]} onChange={v => set('gender', v)} /><Field label="Date of birth *" placeholder="Select date" value={form.dob} editable={false} showSoftInputOnFocus={false} onPressIn={() => setDateField('dob')} /><SelectField label="Assign to class *" value={form.classId} options={(classes.data || []).map(c => ({ value: c.id, label: c.name || `Grade ${c.grade} ${c.medium} ${c.gender_type}` }))} onChange={v => set('classId', v)} /><Field label="Parent name *" placeholder="Primary parent or guardian" value={form.parentName} onChangeText={v => set('parentName', v)} /><Field label="Parent contact *" placeholder="10 digit mobile number" keyboardType="phone-pad" maxLength={10} value={form.parentContact} onChangeText={v => set('parentContact', v.replace(/\D/g, ''))} /><Field label="Second parent name" placeholder="Optional" value={form.parentName2} onChangeText={v => set('parentName2', v)} /><Field label="Second parent contact" placeholder="Optional" keyboardType="phone-pad" maxLength={10} value={form.parentContact2} onChangeText={v => set('parentContact2', v.replace(/\D/g, ''))} /><Field label="Joined date" placeholder="Select date" value={form.joinedDate} editable={false} showSoftInputOnFocus={false} onPressIn={() => setDateField('joinedDate')} />{dateField && <DateTimePicker value={dateValue(form[dateField])} mode="date" display="calendar" onChange={setDateValue} maximumDate={new Date()} />}</Card><Button title={id ? 'Save Changes' : 'Save Student'} icon="save-outline" loading={busy} onPress={save} /></Screen>;
}

export function ImportStudentsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [preview, setPreview] = useState<{ valid: number; errors: { row?: number; message?: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const downloadTemplate = async () => {
    const csv = 'Student Name,Gender,DOB (YYYY-MM-DD),Parent Name,Contact,Grade,Medium\nExample Student,Male,2015-01-15,Parent Name,0771234567,5,Sinhala\n';
    const uri = `${FileSystem.documentDirectory}ahadiya-student-import-template.csv`;
    await FileSystem.writeAsStringAsync(uri, csv);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Download student import template' });
    else Alert.alert('Template ready', uri);
  };
  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'], copyToCacheDirectory: true });
    if (!result.canceled) { setFile(result.assets[0]); setPreview(null); }
  };
  const upload = async (confirmed: boolean) => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      body.append('confirmed', String(confirmed));
      const result = await api.post<{ valid: number; errors: { row?: number; message?: string }[]; imported?: number }>('/import/students', body);
      if (!confirmed) setPreview({ valid: result.valid, errors: result.errors || [] });
      else { Alert.alert('Import complete', `${result.imported || 0} students imported.`); qc.invalidateQueries({ queryKey: ['students'] }); navigation.goBack(); }
    } catch (e) { Alert.alert('Import failed', (e as ApiError).message); } finally { setBusy(false); }
  };
  return <Screen><PageHeader title="Import Students" subtitle="Upload an Excel or CSV file" /><Card style={{ gap: 15 }}><Text style={{ color: colors.text, fontWeight: '800' }}>Required columns</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>Student Name, Gender, DOB (YYYY-MM-DD), Parent Name, Contact, Grade, Medium</Text><Button title="Download Excel template" icon="download-outline" variant="soft" onPress={downloadTemplate} /><Button title={file ? file.name : 'Choose Excel / CSV file'} icon="document-attach-outline" variant="outline" onPress={chooseFile} />{file && !preview && <Button title="Validate File" icon="checkmark-circle-outline" loading={busy} onPress={() => upload(false)} />}{preview && <View style={{ gap: 10 }}><Text style={{ color: colors.primary, fontWeight: '800' }}>{preview.valid} valid rows</Text>{preview.errors.slice(0, 5).map((error, index) => <Text key={index} style={{ color: colors.danger, fontSize: 12 }}>Row {error.row || '?'}: {error.message}</Text>)}{!preview.errors.length && <Button title="Confirm Import" icon="cloud-upload-outline" loading={busy} onPress={() => upload(true)} />}</View>}</Card></Screen>;
}

export function AlumniScreen({ navigation }: any) { const query = useQuery({ queryKey: ['alumni'], queryFn: () => api.get<{ items: Student[]; total: number }>('/students?status=Alumni&page=1&page_size=100') }); return <Screen refreshing={query.isRefetching} onRefresh={query.refetch}><PageHeader title="Alumni" subtitle={`${query.data?.total || 0} graduated students`} />{query.isLoading ? <LoadingView /> : !query.data?.items.length ? <EmptyState icon="ribbon-outline" title="No alumni records" /> : <Card>{query.data.items.map(st => <Row key={st.id} title={st.full_name} subtitle={`${st.gender} · ${st.own_contact || 'No contact number'} · Graduated ${st.graduation_year || '—'}`} onPress={() => navigation.navigate('StudentDetail', { id: st.id })} />)}</Card>}</Screen>; }

const s = StyleSheet.create({ headerActions: { flexDirection: 'row', gap: 8 }, filterRow: { flexDirection: 'row', gap: 10 }, profile: { alignItems: 'center', gap: 6, paddingVertical: 8 }, profileName: { fontSize: 21, fontWeight: '900', marginTop: 5, textAlign: 'center' }, metrics: { flexDirection: 'row', gap: 9 }, metric: { flex: 1, alignItems: 'center', padding: 12 }, metricValue: { fontWeight: '900', fontSize: 20 }, section: { fontSize: 16, fontWeight: '800', marginTop: 4 }, fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: -8 }, yearGridWrap: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 5, borderRadius: 16 }, yearGrid: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' }, monthColumn: { width: 23, alignItems: 'center', gap: 4 }, monthLabel: { fontSize: 9, fontWeight: '700', marginBottom: 2 }, yearCell: { width: 19, height: 19, borderRadius: 4 }, reportCard: { gap: 12 }, reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, reportTitle: { fontSize: 16, fontWeight: '800' }, reportList: { gap: 0 }, reportItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth }, reportText: { fontSize: 14, lineHeight: 20 } });
