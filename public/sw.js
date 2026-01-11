const CACHE_NAME = 'familieskatt-v2-0-9';
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

// Activate event - Start polling if rooms are stored
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
  
  // Start polling immediately if we have stored room info
  console.log('SW: Activated - checking for stored rooms');
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
let lastCheckedTime = {};
let pollingIntervals = {}; // One interval per room
let allRoomsData = {}; // Store all rooms to poll from
let pageIsVisible = false; // Track if page is visible (assume hidden for safety - only show notifications when page is hidden)
let unreadCount = 0; // Track unread notifications
let lastActivityTime = Date.now(); // Track last activity

// Polling for all rooms - check every 3 seconds (when visible) or every 10 seconds (when hidden)
function startContinuousPolling() {
  console.log('SW: Starting continuous polling for all rooms');
  
  // Initialize polling for each room we know about
  Object.keys(allRoomsData).forEach(roomName => {
    if (!pollingIntervals[roomName]) {
      // Always start polling, use faster interval when window is active
      pollingIntervals[roomName] = setInterval(async () => {
        // Determine interval based on last activity and visibility
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        const shouldUseFastInterval = pageIsVisible || timeSinceLastActivity < 60000; // Use fast interval if page visible or active in last 60s
        
        try {
          const url = `/check-messages/${encodeURIComponent(roomName)}?user=${encodeURIComponent(currentUser || 'guest')}&t=${Date.now()}`;
          
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.messages && data.messages.length > 0) {
              // Initialize last checked time for this room if not exists
              if (!lastCheckedTime[roomName]) {
                lastCheckedTime[roomName] = Date.now() - 5000;
              }
              
              // Show notifications for messages newer than last check
              const nowTime = Date.now();
              data.messages.forEach(msg => {
                const msgTime = new Date(msg.timestamp).getTime();
                
                // Only show if message is newer than last check time AND not from current user
                // AND page is not visible (don't notify if app is active)
                // Get current user name (handle both string and object formats)
                const currentUserName = typeof currentUser === 'string' ? currentUser : (currentUser && currentUser.name ? currentUser.name : null);
                
                if (msgTime > lastCheckedTime[roomName] && msg.sender !== currentUserName && !pageIsVisible) {
                  console.log('SW: Showing notification from', msg.sender, 'in room', roomName);
                  
                  // Increment unread count
                  unreadCount++;
                  
                  self.registration.showNotification(`💬 ${msg.sender}`, {
                    body: msg.text.substring(0, 100),
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-192.png',
                    tag: `chat-${roomName}-${Date.now()}`,
                    requireInteraction: false,
                    data: { room: roomName },
                    vibrate: [200, 100, 200] // Vibration pattern
                  }).catch(err => console.log('SW: Notification error:', err));
                }
              });
              
              // Update last checked time
              lastCheckedTime[roomName] = nowTime;
            }
          }
        } catch (e) {
          console.log('SW: Polling error for room', roomName, ':', e);
        }
      }, 3000); // Check every 3 seconds
    }
  });
}


// Message event for cache updates and notifications
self.addEventListener('message', event => {
  // Update last activity time on any message
  lastActivityTime = Date.now();
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle heartbeat to keep SW alive
  if (event.data && event.data.type === 'HEARTBEAT') {
    console.log('SW: Received heartbeat from client');
    // Just receiving the heartbeat keeps the SW alive
  }
  
  // Track page visibility for smarter polling intervals
  if (event.data && event.data.type === 'PAGE_VISIBILITY') {
    pageIsVisible = event.data.visible;
    lastActivityTime = Date.now(); // Update activity time
    console.log('SW: Page visibility changed to', pageIsVisible);
  }
  
  // Store all rooms info for background polling
  if (event.data && event.data.type === 'UPDATE_ROOMS_INFO') {
    const { rooms, user } = event.data;
    currentUser = user;
    lastActivityTime = Date.now(); // Update activity time
    
    console.log('SW: Received rooms info:', rooms, 'user:', user);
    
    // Initialize polling for all rooms
    if (rooms && rooms.length > 0) {
      rooms.forEach(roomName => {
        allRoomsData[roomName] = true;
        // Initialize last checked time for this room if not exists
        if (!lastCheckedTime[roomName]) {
          lastCheckedTime[roomName] = Date.now() - 5000; // Look back 5 seconds
        }
      });
      
      // Start continuous polling across all rooms
      startContinuousPolling();
    }
  }
  
  // Legacy: Store current room and user for background message handling
  if (event.data && event.data.type === 'UPDATE_ROOM_INFO') {
    currentRoom = event.data.room;
    currentUser = event.data.user;
    
    console.log('SW: Updated room/user info:', { currentRoom, currentUser });
    
    // Add to rooms to poll if not already there
    if (currentRoom && !allRoomsData[currentRoom]) {
      allRoomsData[currentRoom] = true;
      startContinuousPolling();
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

// Push notification event (when Web Push message is received)
self.addEventListener('push', event => {
  if (!event.data) {
    console.log('Push received but no data');
    return;
  }

  try {
    const pushData = JSON.parse(event.data.text());
    const { title, options } = pushData;

    // Increment unread count for badge
    unreadCount++;

    // Show push notification
    event.waitUntil(
      self.registration.showNotification(title, {
        badge: options.badge || '/icons/badge-72x72.png',
        icon: options.icon || '/icons/icon-192x192.png',
        body: options.body || '',
        tag: options.tag || 'push-notification',
        requireInteraction: false,
        data: options.data || {}
      }).then(() => {
        // Update badge after showing notification
        if ('setAppBadge' in navigator) {
          navigator.setAppBadge(unreadCount).catch(() => {});
        }
      })
    );
  } catch (err) {
    console.error('Error handling push notification:', err);
  }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Decrement unread count
  if (unreadCount > 0) {
    unreadCount--;
  }
  
  // Get the room from notification data if available
  const room = event.notification.data && event.notification.data.room;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Focus existing window if open
      for (let i = 0; i < clientList.length; i++) {
        if (room && clientList[i].url.includes(encodeURIComponent(room))) {
          // If room specified and window with that room is open, focus it
          return clientList[i].focus();
        } else if (!room && (clientList[i].url === '/' || clientList[i].url.includes('/room'))) {
          // No room specified, focus any chat window
          return clientList[i].focus();
        }
      }
      // Open new window if not open
      if (clients.openWindow) {
        if (room) {
          return clients.openWindow('/' + encodeURIComponent(room));
        } else {
          return clients.openWindow('/');
        }
      }
    })
  );
});
