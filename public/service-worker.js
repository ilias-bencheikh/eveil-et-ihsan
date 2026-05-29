const CACHE_NAME = 'eveil-ihsan-v6';
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

  const acceptHeader = event.request.headers.get('accept');
  const isHtml = event.request.mode === 'navigate' || (acceptHeader && acceptHeader.includes('text/html'));

  if (isHtml) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      // Pour éviter l'erreur "Failed to convert value to 'Response'"
      // si l'élément n'est ni en cache, ni accessible via le réseau
      return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
    })
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
    icon: '/uploads/logo/logo2.png',
    badge: '/uploads/logo/badge.png', // Petite icône monochrome pour la barre Android
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

  const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Chercher si un onglet de notre application est déjà ouvert
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        // Si c'est une page de notre site, on la met au premier plan
        if (windowClient.url.startsWith(self.location.origin)) {
          matchingClient = windowClient;
          break;
        }
      }

      if (matchingClient) {
        // Rediriger le client ouvert vers la bonne page (si besoin) et le focus
        if (matchingClient.url !== urlToOpen && urlToOpen !== self.location.origin + '/') {
            matchingClient.navigate(urlToOpen);
        }
        return matchingClient.focus();
      } else {
        // Sinon, on ouvre un nouvel onglet avec l'URL demandée
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
