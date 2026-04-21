const CACHE_NAME = 'eveil-ihsan-v4';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  OFFLINE_URL,
  '/css/variables.css',
  '/css/main.css',
  '/uploads/logo/logo.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Écoute des événements PUSH (notifications reçues en arrière-plan)
self.addEventListener('push', event => {
  let data = { title: "Nouveau message", body: "Vous avez reçu un nouveau message sur Badr Eveil Ihsan", url: "/" };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/uploads/logo/logo.png',
    badge: '/uploads/logo/logo.png', // Petite icône monochrome pour la barre Android
    vibrate: [100, 50, 100], // Vibration (téléphones)
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open_app', title: 'Ouvrir l\'application' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Action lorsque l'utilisateur clique sur la notification
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // L'URL à ouvrir (récupérée des données de la notification)
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Chercher si un onglet est déjà ouvert avec cette URL
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
          matchingClient = windowClient;
          break;
        }
      }

      // Si ouvert, on le met au premier plan
      if (matchingClient) {
        return matchingClient.focus();
      } else {
        // Sinon, on ouvre un nouvel onglet
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
