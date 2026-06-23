/**
 * Script de récupération pour iOS Safari - Version agressive
 * Résout les écrans blancs causés par des données localStorage corrompues
 *
 * Problème: En navigation normale, iOS Safari persiste le localStorage qui peut
 * contenir des données incompatibles. En navigation privée, les données sont
 * effacées à chaque fermeture, d'où ça marche.
 */
(function() {
    'use strict';

    // ============================================================
    // RECOVERY iOS SAFARI - S'exécute AVANT tout autre code
    // ============================================================
    // Ce script doit être le premier code JavaScript exécuté
    // pour éviter les écrans blancs causé par des données corrompues

    const STORAGE_VERSION = '5';
    const STORAGE_VERSION_KEY = '_storage_version_';

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    function isChromeIOS() {
        return /CriOS/.test(navigator.userAgent);
    }

    function isSafari() {
        return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    }

    function isIOSSafari() {
        return isIOS() && (isSafari() || isChromeIOS());
    }

    // Nettoyer le localStorage de manière sécurisée
    function safeCleanLocalStorage() {
        const preserved = [STORAGE_VERSION_KEY];
        const allKeys = Object.keys(localStorage);
        let cleaned = false;

        allKeys.forEach(function(key) {
            if (!preserved.includes(key)) {
                localStorage.removeItem(key);
                cleaned = true;
            }
        });

        localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
        return cleaned;
    }

    // Vérifier si les données sont corrompues
    function isDataCorrupted() {
        try {
            const userStr = localStorage.getItem('user');
            const token = localStorage.getItem('token');

            if (userStr) {
                JSON.parse(userStr);
            }

            if (token !== null && typeof token !== 'string') {
                return true;
            }

            return false;
        } catch (e) {
            return true;
        }
    }

    // INITIALISATION IMMÉDIATE - Aucune attente, aucun délai
    function initImmediate() {
        // Exécuter immédiatement sur iOS Safari
        if (!isIOSSafari()) return;

        const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
        const wasCorrupted = isDataCorrupted();

        if (storedVersion !== STORAGE_VERSION || wasCorrupted) {
            console.warn('[iOS-Recovery] Nettoyage initial:', wasCorrupted ? 'corruption détectée' : 'version obsolète');
            safeCleanLocalStorage();
        }
    }

    // INTERCEPTER localStorage pour détecter les problèmes
    function installLocalStorageInterception() {
        if (!isIOSSafari()) return;

        const originalSetItem = localStorage.setItem.bind(localStorage);
        const originalRemoveItem = localStorage.removeItem.bind(localStorage);

        localStorage.setItem = function(key, value) {
            try {
                // Vérifier que la valeur est valide
                if (value !== null && typeof value !== 'string') {
                    console.warn('[iOS-Recovery] Tentative de stockage non-string:', key);
                    return;
                }
                originalSetItem(key, value);
            } catch (e) {
                console.warn('[iOS-Recovery] Erreur setItem:', key, e);
                // Nettoyer et réessayer
                safeCleanLocalStorage();
                try {
                    originalSetItem(key, value);
                } catch (e2) {
                    console.error('[iOS-Recovery] Échec persistant:', key);
                }
            }
        };

        localStorage.removeItem = function(key) {
            try {
                originalRemoveItem(key);
            } catch (e) {
                console.warn('[iOS-Recovery] Erreur removeItem:', key);
            }
        };
    }

    // EXPOSER IMMÉDIATEMENT pour que les autres scripts puisse l'utiliser
    window.iOSRecovery = {
        clean: safeCleanLocalStorage,
        isIOS: isIOS,
        isIOSSafari: isIOSSafari,
        isCorrupted: isDataCorrupted
    };

    // Vérifier si environnement dev (ngrok/localhost)
    function isDevEnvironment() {
        const hostname = window.location.hostname;
        return hostname.includes('ngrok') ||
               hostname.includes('localhost') ||
               hostname.includes('127.0.0.1') ||
               hostname.includes('0.0.0.0');
    }

    // Désactiver le Service Worker en environnement dev
    async function disableServiceWorkerInDev() {
        if (!('serviceWorker' in navigator)) return;
        if (!isDevEnvironment()) return;

        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                await reg.unregister();
            }
            // Vider le cache
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            }
            console.log('[iOS-Recovery] SW désactivé (mode dev)');
        } catch (e) {
            console.warn('[iOS-Recovery] Erreur désactivation SW:', e);
        }
    }

    // EXÉCUTER IMMÉDIATEMENT
    initImmediate();
    installLocalStorageInterception();

    // Désactiver le SW en dev
    if (isDevEnvironment()) {
        disableServiceWorkerInDev();
    }

    // ============================================================
    // VÉRIFICATION APRÈS CHARGEMENT
    // ============================================================

    window.addEventListener('load', function() {
        // Petit délai pour laisser le DOM se charger
        setTimeout(function() {
            if (!isIOSSafari()) return;

            // Vérifier si on a un écran blanc
            var body = document.body;
            if (!body || body.children.length === 0 || body.offsetHeight === 0) {
                console.warn('[iOS-Recovery] Écran blanc détecté!');
                safeCleanLocalStorage();
                window.location.reload(true);
                return;
            }

            // Vérifier si on est sur une page d'authentification
            var isLoginPage = window.location.pathname === '/login' ||
                              window.location.pathname === '/login.html';

            if (isLoginPage) {
                // Sur la page login, vérifier si les données sont corrompues
                if (isDataCorrupted()) {
                    console.warn('[iOS-Recovery] Corruption détectée sur login');
                    safeCleanLocalStorage();
                }
            }
        }, 100);
    });

    // Vérification quand la page devient visible
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && isIOSSafari()) {
            setTimeout(function() {
                var body = document.body;
                if (!body || body.children.length === 0 || body.offsetHeight === 0) {
                    console.warn('[iOS-Recovery] Écran blanc après réouverture Safari');
                    safeCleanLocalStorage();
                    window.location.reload(true);
                }
            }, 500);
        }
    });

    // Gestion du service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function(registration) {
            if (registration) {
                registration.update();
            }
        });
    }
})();
