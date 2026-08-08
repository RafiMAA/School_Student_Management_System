import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, LoadingView } from '../components/UI';
import { isAdmin, useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import type { DashboardSummary } from '../types';

type StatItem = {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  open: () => void;
};

export function DashboardScreen({ navigation }: any) {
  const { colors, dark } = useTheme();
  const { user } = useAuth();
  const tabs = navigation.getParent();

  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle(dark ? 'light-content' : 'dark-content');
    }, [dark]),
  );

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      api.get<{ summary: DashboardSummary }>('/dashboard/bootstrap'),
  });

  if (query.isLoading) return <LoadingView fullScreen />;

  const data = query.data?.summary;
  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Dashboard unavailable"
          text="Pull down to try again."
        />
      </SafeAreaView>
    );
  }

  const stats: StatItem[] = [
    {
      label: 'Students',
      value: data.total_students,
      icon: 'people-outline',
      open: () => tabs?.navigate('StudentsTab', { screen: 'Students' }),
    },
    {
      label: 'Teachers',
      value: data.total_teachers,
      icon: 'school-outline',
      open: () =>
        isAdmin(user?.role) &&
        tabs?.navigate('MoreTab', { screen: 'Teachers' }),
    },
    {
      label: 'Classes',
      value: data.total_classes,
      icon: 'library-outline',
      open: () => isAdmin(user?.role) && tabs?.navigate('ClassesTab'),
    },
    {
      label: 'Alumni',
      value: data.total_alumnis || 0,
      icon: 'ribbon-outline',
      open: () => tabs?.navigate('StudentsTab', { screen: 'Alumni' }),
    },
  ];

  const attendanceColor =
    data.overall_percentage >= 80
      ? colors.primary
      : data.overall_percentage >= 60
        ? colors.warning
        : colors.danger;
  const progress = data.classes_total
    ? `${Math.max(3, (data.classes_submitted / data.classes_total) * 100)}%`
    : '0%';

  const openAttendance = (classId: string) =>
    tabs?.navigate('AttendanceTab', {
      screen: 'MarkAttendance',
      params: { classId, date: data.date },
    });

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={query.refetch}
            tintColor="#ffffff"
            colors={[colors.primary]}
          />
        }
      >
        <LinearGradient
          colors={['#12ad73', '#008a58']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.waveLarge} />
          <View style={styles.waveSmall} />
          <SafeAreaView edges={['top']} style={styles.heroSafe}>
            <View style={styles.greeting}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.salaam}>Assalamu Alaikum,</Text>
                <Pressable
                  accessibilityLabel="Open notifications"
                  onPress={() => tabs?.navigate('MoreTab', { screen: 'Settings' })}
                  style={({ pressed }) => [
                    styles.notification,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="notifications" size={24} color="#ffffff" />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -4 }}>
                <Text numberOfLines={1} style={styles.firstName}>
                  {user?.fullName || 'Welcome'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700', paddingBottom: 6 }}>
                  {data.current_academic_year ? `Academic Year ${data.current_academic_year}` : ''}
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.statGrid}>
            {stats.map(item => (
              <Pressable
                key={item.label}
                onPress={item.open}
                style={({ pressed }) => [
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: dark ? colors.border : '#edf0f4',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statIcon,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <Ionicons name={item.icon} size={25} color={colors.primary} />
                </View>
                <View style={styles.statBottom}>
                  <View>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {item.value}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.muted }]}>
                      {item.label}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={colors.muted}
                  />
                </View>
              </Pressable>
            ))}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              This Sunday's Attendance
            </Text>
            <View style={styles.attendanceRow}>
              <View style={styles.ringColumn}>
                <View
                  style={[
                    styles.attendanceRing,
                    { borderColor: attendanceColor },
                  ]}
                >
                  <Text style={[styles.percentage, { color: colors.text }]}>
                    {data.overall_percentage}%
                  </Text>
                  <Text style={[styles.ringLabel, { color: colors.muted }]}>
                    Present
                  </Text>
                </View>
              </View>
              <View style={styles.attendanceCounts}>
                <LinearGradient
                  colors={
                    dark
                      ? ['#123326', '#16372b']
                      : ['#effbf5', '#e7f7f0']
                  }
                  style={styles.countBox}
                >
                  <Text style={[styles.countLabel, { color: colors.primary }]}>
                    Present
                  </Text>
                  <Text style={[styles.countValue, { color: colors.primary }]}>
                    {data.total_present}
                  </Text>
                </LinearGradient>
                <LinearGradient
                  colors={
                    dark
                      ? ['#341a23', '#3a1b24']
                      : ['#fff3f4', '#fdebec']
                  }
                  style={styles.countBox}
                >
                  <Text style={[styles.countLabel, { color: colors.danger }]}>
                    Absent
                  </Text>
                  <Text style={[styles.countValue, { color: colors.danger }]}>
                    {data.total_absent}
                  </Text>
                </LinearGradient>
              </View>
            </View>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={19} color={colors.muted} />
              <Text style={[styles.dateText, { color: colors.muted }]}>
                {data.date}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Class submissions
              </Text>
              <View
                style={[
                  styles.totalPill,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={[styles.totalPillText, { color: colors.primary }]}>
                  {data.classes_submitted}/{data.classes_total}
                </Text>
              </View>
            </View>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: progress as any },
                ]}
              />
            </View>
            <View style={styles.classGrid}>
              {data.classes.map(item => {
                const foreground = item.submitted
                  ? colors.primary
                  : colors.danger;
                const background = item.submitted
                  ? colors.primarySoft
                  : colors.dangerSoft;
                return (
                  <Pressable
                    key={item.class_id}
                    onPress={() => openAttendance(item.class_id)}
                    style={({ pressed }) => [
                      styles.classChip,
                      {
                        backgroundColor: background,
                        opacity: pressed ? 0.65 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.submitted ? 'checkmark-circle' : 'close-circle'}
                      color={foreground}
                      size={20}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.className, { color: foreground }]}
                    >
                      {item.class_name.replace(/Grade\s/i, 'G')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const cardShadow = {
  shadowColor: '#10203a',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.08,
  shadowRadius: 13,
  elevation: 3,
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  hero: {
    height: 142,
    overflow: 'hidden',
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
  },
  heroSafe: { flex: 1, paddingHorizontal: 22, justifyContent: 'center' },
  waveLarge: {
    position: 'absolute',
    width: 540,
    height: 155,
    borderRadius: 220,
    backgroundColor: 'rgba(255,255,255,0.075)',
    left: 40,
    bottom: -72,
    transform: [{ rotate: '-8deg' }],
  },
  waveSmall: {
    position: 'absolute',
    width: 470,
    height: 125,
    borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.055)',
    left: -75,
    bottom: -62,
    transform: [{ rotate: '7deg' }],
  },
  notification: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  greeting: { },
  salaam: { color: '#ffffff', fontSize: 17, fontWeight: '500' },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  firstName: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1.4,
    marginTop: 3,
    maxWidth: '78%',
  },
  body: { paddingHorizontal: 18, paddingTop: 18, gap: 14 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    minHeight: 155,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
    ...cardShadow,
  },
  statIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: { fontSize: 30, lineHeight: 35, fontWeight: '900' },
  statLabel: { fontSize: 15, fontWeight: '500', marginTop: 1 },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    ...cardShadow,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.25 },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 17,
  },
  ringColumn: { width: 128, alignItems: 'center' },
  attendanceRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: { fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  ringLabel: { fontSize: 13, fontWeight: '500', marginTop: 1 },
  attendanceCounts: { flex: 1, gap: 10 },
  countBox: {
    minHeight: 57,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countLabel: { fontSize: 14, fontWeight: '800' },
  countValue: { fontSize: 20, fontWeight: '900' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  dateText: { fontSize: 14, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalPill: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 18 },
  totalPillText: { fontWeight: '900', fontSize: 13 },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 15,
    marginBottom: 14,
  },
  progressFill: { height: 7, borderRadius: 4 },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  classChip: {
    width: '48%',
    minHeight: 43,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  className: { flex: 1, fontSize: 12, fontWeight: '800' },
});
