const PWA_STATE_CACHE = 'ahadiya-pwa-state-v1';
const PWA_VERSION_MARKER = '/__ahadiya_pwa_version__';

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

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const current = await response.json();
      if (!current?.version) return;

      const stateCache = await caches.open(PWA_STATE_CACHE);
      const previousResponse = await stateCache.match(PWA_VERSION_MARKER);
      const previous = previousResponse ? await previousResponse.json() : null;
      await stateCache.put(PWA_VERSION_MARKER, new Response(JSON.stringify(current), {
        headers: { 'Content-Type': 'application/json' },
      }));

      if (previous?.version && previous.version !== current.version && self.Notification?.permission === 'granted') {
        await self.registration.showNotification('Ahadiya app update available', {
          body: `Version ${current.version} is ready. Tap to update the app.`,
          icon: '/ahadiya-pwa-icon-192.png',
          badge: '/ahadiya-pwa-icon-192.png',
          tag: 'ahadiya-pwa-update',
          // The foreground monitor may have already alerted for this version.
          // Replace that tagged notification without sounding twice.
          renotify: false,
          data: { url: '/settings', type: 'pwa-update', version: current.version },
        });
      }
    } catch {
      // Offline activation will be checked again on the next service-worker update.
    }
  })());
});

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
