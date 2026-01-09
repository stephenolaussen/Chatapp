const CACHE_NAME = 'familieskatt-v1-7-8';
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
let lastCheckedTime = {};
let pollingInterval = null;

// Aggressive polling - check every 3 seconds
function startAggressivePolling() {
  // Stop existing polling first
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  if (!currentRoom || !currentUser) {
    console.log('SW: Cannot start polling, missing room or user', { currentRoom, currentUser });
    return;
  }
  
  console.log('SW: Starting aggressive polling for room:', currentRoom, 'user:', currentUser);
  
  // Initialize last checked time for this room
  if (!lastCheckedTime[currentRoom]) {
    lastCheckedTime[currentRoom] = Date.now() - 5000; // Look back 5 seconds to catch recent messages
  }
  
  // Check for new messages every 3 seconds (more aggressive)
  pollingInterval = setInterval(async () => {
    if (!currentRoom || !currentUser) {
      console.log('SW: Stopping polling - missing room or user');
      clearInterval(pollingInterval);
      pollingInterval = null;
      return;
    }
    
    try {
      const url = `/check-messages/${encodeURIComponent(currentRoom)}?user=${encodeURIComponent(currentUser)}&t=${Date.now()}`;
      console.log('SW: Polling...', url);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log('SW: Got response:', data);
        
        if (data.messages && data.messages.length > 0) {
          console.log('SW: Found', data.messages.length, 'messages');
          
          // Only show notifications for messages newer than last check
          const nowTime = Date.now();
          data.messages.forEach(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            console.log('SW: Checking message from', msg.sender, 'time:', msgTime, 'lastChecked:', lastCheckedTime[currentRoom]);
            
            // Only show if message is newer than last check time AND not from current user
            if (msgTime > lastCheckedTime[currentRoom] && msg.sender !== currentUser) {
              console.log('SW: Showing notification for:', msg.sender);
              self.registration.showNotification(`💬 ${msg.sender}`, {
                body: msg.text.substring(0, 100),
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `chat-${Date.now()}`,
                requireInteraction: false
              }).catch(err => console.log('SW: Notification error:', err));
            }
          });
          
          // Update last checked time
          lastCheckedTime[currentRoom] = nowTime;
        } else {
          console.log('SW: No new messages');
        }
      } else {
        console.log('SW: Response not OK:', response.status);
      }
    } catch (e) {
      console.log('SW: Polling error:', e);
    }
  }, 3000); // Check every 3 seconds
}


// Message event for cache updates and notifications
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Track page visibility state
  if (event.data && event.data.type === 'PAGE_VISIBILITY') {
    currentPageVisible = event.data.visible;
    
    // Start aggressive polling when page becomes hidden
    if (!currentPageVisible) {
      startAggressivePolling();
    }
  }
  
  // Store current room and user for background message handling
  if (event.data && event.data.type === 'UPDATE_ROOM_INFO') {
    currentRoom = event.data.room;
    currentUser = event.data.user;
    
    // Always start polling in background
    startAggressivePolling();
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
