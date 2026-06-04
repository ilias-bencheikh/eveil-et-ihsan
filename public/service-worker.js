const CACHE_NAME = 'eveil-ihsan-v8';
const OFFLINE_URL = '/offline.html';

// URLs à mettre en cache à l'installation
const urlsToCache = [
  OFFLINE_URL,
  '/css/variables.css',
  '/css/main.css',
  '/css/dashboard.css',
  '/uploads/logo/logo.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'
];

// Installation : pré-cache les ressources critiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Utiliser addAll mais avec gestion des erreurs individuelles
        return Promise.all(
          urlsToCache.map(url =>
            fetch(url, { mode: 'cors' })
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(() => {
                console.warn(`[SW] Impossible de pré-cacher: ${url}`);
              })
          )
        ).then(() => cache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation : purge les anciens caches
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
    }).then(() => self.clients.claim())
  );
});

// Stratégie réseau-first pour le HTML (navigation)
async function networkFirstHtml(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(OFFLINE_URL);
    return cachedResponse || new Response('Hors ligne', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Stratégie cache-first pour les assets statiques
async function cacheFirstAssets(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Rafraîchir le cache en arrière-plan
    fetch(request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response));
        }
      })
      .catch(() => {});
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Ressource unavailable', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Fetch principal
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const acceptHeader = event.request.headers.get('accept') || '';
  const isHtml = event.request.mode === 'navigate' || acceptHeader.includes('text/html');
  const isFont = acceptHeader.includes('font') || event.request.url.includes('fonts.googleapis');
  const isIcon = /\.(png|jpg|jpeg|svg|ico|webp|svg)$/i.test(event.request.url);
  const isCssJs = acceptHeader.includes('css') || acceptHeader.includes('javascript') ||
    /\.(css|js|mjs)(\?|$)/i.test(event.request.url);

  if (isHtml) {
    event.respondWith(networkFirstHtml(event.request));
  } else if (isFont || isCssJs) {
    event.respondWith(cacheFirstAssets(event.request));
  } else if (isIcon) {
    event.respondWith(cacheFirstAssets(event.request));
  } else {
    // Autres ressources : cache-first classique
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
  }
});

// Notifications Push
self.addEventListener('push', event => {
  let data = {
    title: "Eveil & Ihsan",
    body: "Vous avez reçu une nouvelle notification",
    url: "/",
    icon: '/uploads/logo/logo2.png',
    badge: '/uploads/logo/logo_onglet.png'
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }

  const options = {
    body: data.body,
    icon: data.icon || '/uploads/logo/logo2.png',
    badge: data.badge || '/uploads/logo/logo_onglet.png',
    vibrate: [200, 100, 200],
    tag: 'eveil-ihsan-notif',
    renotify: true,
    requireInteraction: false,
    silent: false,
    data: {
      url: data.url || '/',
      date: Date.now()
    },
    actions: [
      { action: 'open_app', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur notification
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const windowClient of windowClients) {
        if (windowClient.url.startsWith(self.location.origin)) {
          if (windowClient.url !== urlToOpen) {
            windowClient.navigate(urlToOpen);
          }
          return windowClient.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[SW] Background sync triggered');
  // Ajouter ici la logique de sync si nécessaire
}

// Message du client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      return Promise.all(names.map(name => caches.delete(name)));
    });
  }
});