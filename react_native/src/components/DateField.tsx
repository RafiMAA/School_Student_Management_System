import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Alert, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './UI';

// Calendar dates must keep their local day when sent to the API.
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DateField({ label, value, onChange, maximumDate, minimumDate }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const { colors, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const showCalendar = () => {
    Keyboard.dismiss();
    const parsed = new Date(`${value}T00:00:00`);
    let initial = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    if (maximumDate && initial > maximumDate) initial = maximumDate;
    if (minimumDate && initial < minimumDate) initial = minimumDate;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial, mode: 'date', display: 'calendar', maximumDate, minimumDate,
        onError: () => Alert.alert('Calendar could not open', 'Please restart the app and try again. If this continues, install the latest app build.'),
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(formatLocalDate(selected));
        },
      });
    } else {
      setDraft(initial);
      setOpen(true);
    }
  };

  return <View style={{ gap: 7 }}>
    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value || 'Select date'}`} onPress={showCalendar}
      style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ flex: 1, color: value ? colors.text : colors.muted }}>{value || 'Select date'}</Text>
      <Ionicons name="calendar-outline" size={20} color={colors.primary} />
    </Pressable>
    {Platform.OS === 'ios' && <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.calendar, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
          <DateTimePicker value={draft} mode="date" display="inline" minimumDate={minimumDate} maximumDate={maximumDate}
            themeVariant={dark ? 'dark' : 'light'} accentColor={colors.primary}
            onChange={(_event, selected) => { if (selected) setDraft(selected); }} />
          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={() => setOpen(false)} />
            <Button title="Done" onPress={() => { onChange(formatLocalDate(draft)); setOpen(false); }} />
          </View>
        </View>
      </View>
    </Modal>}
  </View>;
}

const styles = StyleSheet.create({
  field: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 },
  calendar: { borderRadius: 16, padding: 16, gap: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
});
