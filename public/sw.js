const CACHE_NAME = 'familieskatt-v1-7-6';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete all old caches
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', event => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Socket.io requests
  if (request.url.includes('socket.io')) {
    return;
  }

  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response;
      }

      return fetch(request).then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Return a fallback response if offline
        return caches.match('/');
      });
    })
  );
});

// Store current room and user info for background notifications
let currentRoom = null;
let currentUser = null;
let currentPageVisible = true;
let pollingInterval = null;

// Polling function to check for new messages every 5 seconds
function startPolling() {
  if (pollingInterval || !currentRoom || !currentUser) {
    return;
  }
  
  // Check for new messages every 5 seconds
  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`/check-messages/${encodeURIComponent(currentRoom)}?user=${encodeURIComponent(currentUser)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(msg => {
            // Only show notifications for messages from other users
            if (msg.sender !== currentUser) {
              self.registration.showNotification(`💬 ${msg.sender}`, {
                body: msg.text.substring(0, 100),
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `chat-message-${msg.timestamp}`,
                requireInteraction: false
              });
            }
          });
        }
      }
    } catch (e) {
      console.log('Polling error:', e);
    }
  }, 5000); // Check every 5 seconds
}

// Stop polling
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}


// Message event for cache updates and notifications
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Track page visibility state
  if (event.data && event.data.type === 'PAGE_VISIBILITY') {
    currentPageVisible = event.data.visible;
  }
  
  // Store current room and user for background message handling
  if (event.data && event.data.type === 'UPDATE_ROOM_INFO') {
    const oldRoom = currentRoom;
    currentRoom = event.data.room;
    currentUser = event.data.user;
    
    // Start/restart polling if room changed
    if (oldRoom !== currentRoom) {
      stopPolling();
      startPolling();
    }
  }
  
  // Handle notification from main thread
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }

  // Handle alarm notification from main thread (high priority)
  if (event.data && event.data.type === 'SHOW_ALARM') {
    const { title, options } = event.data;
    // Always show alarm even if page is visible
    self.registration.showNotification(title, options);
  }
  
  // Handle background message notification
  if (event.data && event.data.type === 'BG_MESSAGE_NOTIFICATION') {
    const { sender, message } = event.data;
    if (sender !== currentUser) {
      self.registration.showNotification(`💬 ${sender}`, {
        body: message.substring(0, 100),
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `chat-message-${Date.now()}`,
        requireInteraction: false
      });
    }
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing window if open
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === '/' && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      // Open new window if not open
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
