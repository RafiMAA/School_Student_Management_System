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
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => 'focus' in client);
    return existing ? existing.focus() : self.clients.openWindow('/attendance/mark');
  }));
});
