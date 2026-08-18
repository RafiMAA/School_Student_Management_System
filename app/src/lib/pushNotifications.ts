import api from '@/lib/apiClient';

const configuredPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
let resolvedPublicKey: string | null = configuredPublicKey || null;

interface NotificationConfig {
  web_push_configured: boolean;
  vapid_public_key: string | null;
}

function decodePublicKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function getPublicKey() {
  if (resolvedPublicKey) return resolvedPublicKey;
  const config = await api.get<NotificationConfig>('/notifications/config');
  if (!config.web_push_configured || !config.vapid_public_key) {
    throw new Error('Notifications are not configured on the server.');
  }
  resolvedPublicKey = config.vapid_public_key;
  return resolvedPublicKey;
}

function keysMatch(subscription: PushSubscription, publicKey: Uint8Array<ArrayBuffer>) {
  const existingKey = subscription.options.applicationServerKey;
  if (!existingKey) return false;
  const existing = new Uint8Array(existingKey);
  return existing.length === publicKey.length && existing.every((byte, index) => byte === publicKey[index]);
}

export async function webPushEnabled() {
  return Boolean(await currentSubscription());
}

export async function setWebPushEnabled(enabled: boolean) {
  let existing = await currentSubscription();
  if (!enabled) {
    if (existing) {
      await api.post('/notifications/subscriptions/remove', { device_key: existing.endpoint });
      await existing.unsubscribe();
    }
    return false;
  }
  if (!('Notification' in window)) throw new Error('Notifications are not supported on this device.');
  const publicKey = decodePublicKey(await getPublicKey());
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (permission === 'denied') throw new Error('Notifications are blocked in your device settings.');
    return false;
  }
  const registration = await navigator.serviceWorker.ready;
  if (existing && !keysMatch(existing, publicKey)) {
    await existing.unsubscribe();
    existing = null;
  }
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  });
  await api.post('/notifications/subscriptions', {
    platform: 'web', device_key: subscription.endpoint, subscription: subscription.toJSON(),
  });
  return true;
}
