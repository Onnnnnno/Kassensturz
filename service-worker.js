const REMINDER_TAG = 'kassensturz-reminder';

// Nachricht vom App empfangen → Erinnerung planen
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_REMINDER') {
    scheduleReminder();
  }
});

function scheduleReminder() {
  const now    = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);

  // Wenn 20:00 heute schon vorbei → morgen einplanen
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  setTimeout(() => {
    self.registration.showNotification('💸 Kassensturz', {
      body:      'Vergiss deinen Kassensturz nicht! Wie viel hast du heute ausgegeben?',
      icon:      '/icon-192.png',
      badge:     '/icon-192.png',
      tag:       REMINDER_TAG,
      renotify:  false,
      vibrate:   [200, 100, 200],
      actions: [
        { action: 'open',   title: 'App öffnen' },
        { action: 'dismiss', title: 'Später' },
      ],
    });

    // Direkt die nächste Erinnerung für morgen einplanen
    scheduleReminder();
  }, delay);
}

// Klick auf Benachrichtigung → App öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});
