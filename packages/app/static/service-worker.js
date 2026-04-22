// Nurse Mel MedSpa Service Worker
// Handles push notifications and offline support

const CACHE_NAME = 'nursemel-v1';

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  const data = event.data?.json() ?? {};

  const title = data.title || 'Nurse Mel';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'nursemel-notification',
    requireInteraction: true,
    data: {
      url: data.url || '/notifications',
      notificationId: data.notificationId,
    },
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data;

  if (event.action === 'dismiss') {
    // Just close the notification
    return;
  }

  // Open or focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            // Navigate to the notification URL
            if (notificationData?.url) {
              return client.navigate(notificationData.url);
            }
          });
        }
      }

      // Open new window if not already open
      if (self.clients.openWindow) {
        return self.clients.openWindow(notificationData?.url || '/notifications');
      }
    })
  );
});

// Fetch event - network first, cache fallback (for offline support)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls
  if (event.request.url.includes('/api/') || event.request.url.includes('/fhir/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();

        // Open cache and store response
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Return from cache if network fails
        return caches.match(event.request);
      })
  );
});
