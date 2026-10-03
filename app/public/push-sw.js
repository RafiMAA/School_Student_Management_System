const PWA_STATE_CACHE = 'ahadiya-pwa-state-v1';

self.addEventListener('push', event => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(payload.title || 'Ahadiya School', {
    body: payload.body || 'You have a new reminder.',
    icon: '/ahadiya-pwa-icon-192.png',
    badge: '/ahadiya-pwa-icon-192.png',
    data: payload.data || {},
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/attendance/mark';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => 'focus' in client);
    if (!existing) return self.clients.openWindow(target);
    if ('navigate' in existing) await existing.navigate(target);
    return existing.focus();
  }));
});

// Version checks and update notifications run in the foreground monitor.
// Activation must not wait for version.json: a stalled connection would also
// delay the new worker from serving the app's cached startup files.

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'CLEAR_UNUSED_CACHES') {
    event.waitUntil(caches.keys().then(cacheNames => Promise.all(
      cacheNames
        // The active Workbox precache provides offline startup. Workbox's
        // cleanupOutdatedCaches option removes its superseded entries itself.
        .filter(cacheName => !cacheName.startsWith('workbox-precache') && cacheName !== PWA_STATE_CACHE)
        .map(cacheName => caches.delete(cacheName))
    )));
  }
});
