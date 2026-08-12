import api from '@/lib/apiClient';

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

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

export async function webPushEnabled() {
  return Boolean(await currentSubscription());
}

export async function setWebPushEnabled(enabled: boolean) {
  const existing = await currentSubscription();
  if (!enabled) {
    if (existing) {
      await api.post('/notifications/subscriptions/remove', { device_key: existing.endpoint });
      await existing.unsubscribe();
    }
    return false;
  }
  if (!publicKey) throw new Error('Web push public key is not configured.');
  if (!('Notification' in window)) throw new Error('Notifications are not supported on this device.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodePublicKey(publicKey),
  });
  await api.post('/notifications/subscriptions', {
    platform: 'web', device_key: subscription.endpoint, subscription: subscription.toJSON(),
  });
  return true;
}
