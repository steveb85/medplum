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
  console.log('[SW] === PUSH HANDLER START ===');
  console.log('[SW] Push received:', event);
  console.log('[SW] event.data:', event.data);
  console.log('[SW] event.data type:', typeof event.data);

  let data = {};
  try {
    if (event.data) {
      console.log('[SW] Attempting to parse event.data.json()...');
      data = event.data.json();
      console.log('[SW] Parsed data:', data);
    } else {
      console.log('[SW] WARNING: event.data is null/undefined');
    }
  } catch (err) {
    console.error('[SW] ERROR parsing push data:', err);
    data = {};
  }

  console.log('[SW] Final data object:', data);

  const title = data.title || 'Nurse Mel';
  const body = data.body || 'You have a new notification';
  const icon = data.icon || '/favicon.ico';
  const badge = data.badge || '/favicon.ico';
  const url = data.url || '/notifications';

  console.log('[SW] Notification details:');
  console.log('[SW]   title:', title);
  console.log('[SW]   body:', body);
  console.log('[SW]   icon:', icon);
  console.log('[SW]   badge:', badge);
  console.log('[SW]   url:', url);
  console.log('[SW]   notificationId:', data.notificationId);

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: data.tag || 'nursemel-notification',
    requireInteraction: true,
    data: {
      url: url,
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

  console.log('[SW] Full notification options:', options);
  console.log('[SW] Calling showNotification...');

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[SW] showNotification succeeded');
      })
      .catch((err) => {
        console.error('[SW] showNotification FAILED:', err);
        console.error('[SW] Error name:', err.name);
        console.error('[SW] Error message:', err.message);
      })
  );

  console.log('[SW] === PUSH HANDLER END ===');
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
