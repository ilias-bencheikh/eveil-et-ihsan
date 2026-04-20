const CACHE_NAME = 'badr-eveil-ihsan-v3';
const OFFLINE_URL = '/offline.html';

// Ressources à mettre en cache uniquement pour la page hors ligne
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
      .then(cache => {
        console.log('Ouverture du cache v3 pour mode hors ligne');
        return cache.addAll(urlsToCache);
      })
  );
  // Forcer le nouveau service worker à s'activer immédiatement
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Supprimer les anciens caches (qui stockaient toute l'app hors ligne)
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  // Si la requête demande une page HTML (mode 'navigate')
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // L'utilisateur est HORS LIGNE, on affiche la page offline.html
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Pour toutes les autres ressources statiques (CSS, JS, Images, Polices)
  // Stratégie : Réseau en priorité, sinon on cherche dans notre cache pour la page hors ligne
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});