import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

const ENABLED_KEY = 'attendance_reminder_enabled';
const TOKEN_KEY = 'attendance_reminder_expo_token';
const LEGACY_NOTIFICATION_ID_KEY = 'attendance_reminder_notification_id';
const CHANNEL_ID = 'attendance-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Attendance reminders',
    description: 'Sunday attendance submission reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

async function removeLegacyLocalReminder() {
  const id = await AsyncStorage.getItem(LEGACY_NOTIFICATION_ID_KEY);
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
  await AsyncStorage.removeItem(LEGACY_NOTIFICATION_ID_KEY);
}

export async function isAttendanceReminderEnabled() {
  await removeLegacyLocalReminder();
  const [enabled, token] = await Promise.all([
    AsyncStorage.getItem(ENABLED_KEY),
    AsyncStorage.getItem(TOKEN_KEY),
  ]);
  return enabled === 'true' && Boolean(token);
}

export async function setAttendanceReminderEnabled(enabled: boolean) {
  const existingToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (!enabled) {
    if (existingToken) {
      await api.post('/notifications/subscriptions/remove', { device_key: existingToken });
    }
    await AsyncStorage.multiRemove([ENABLED_KEY, TOKEN_KEY]);
    return false;
  }

  if (!Device.isDevice) throw new Error('Push notifications require a physical device.');
  await ensureAndroidChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== Notifications.PermissionStatus.GRANTED) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== Notifications.PermissionStatus.GRANTED) return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Expo project ID is not configured.');
  const expoToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.post('/notifications/subscriptions', {
    platform: 'expo',
    device_key: expoToken,
  });
  await AsyncStorage.multiSet([[ENABLED_KEY, 'true'], [TOKEN_KEY, expoToken]]);
  return true;
}
