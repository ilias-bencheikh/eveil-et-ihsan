// Push Notifications Setup (VAPID key)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

window.forcePushSubscription = async function() {
    try {
        console.log("Tentative d'abonnement aux notifications Push...");
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Aucun token de connexion trouvé.");
            console.log("Erreur : Vous devez être connecté pour activer les notifications.");
            return;
        }
        
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.error("Les notifications Push ne sont pas supportées sur ce navigateur.");
            console.log("Votre navigateur ne supporte pas les notifications Push.");
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        console.log("Service Worker prêt. Demande de permission...");

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn("Permission refusée par l'utilisateur.");
            console.log("Vous avez refusé les notifications. Veuillez les autoriser dans les paramètres de votre navigateur.");
            return;
        }

        console.log("Permission accordée. Récupération de la clé publique...");
        const keyRes = await fetch('/api/push/vapid-public-key', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!keyRes.ok) {
            console.error("Erreur récupération clé:", await keyRes.text());
            console.log("Erreur serveur lors de la configuration des notifications.");
            return;
        }
        
        const { publicKey } = await keyRes.json();
        console.log("Clé publique reçue. Souscription...");

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        console.log("Souscription réussie. Envoi au serveur...");
        const subRes = await fetch('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (subRes.ok) {
            console.log("Abonnement Push enregistré avec succès !");
            console.log("Notifications activées avec succès !");
        } else {
            console.error("Erreur lors de l'enregistrement de l'abonnement:", await subRes.text());
            console.log("Une erreur s'est produite côté serveur.");
        }
    } catch (err) {
        console.error('Erreur globale Push:', err);
        console.log("Une erreur technique est survenue : " + err.message);
    }
};

// Initialisation automatique (silencieuse)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => {
                // Si la permission est déjà accordée, on retente la souscription en silence
                if (Notification.permission === 'granted') {
                    window.forcePushSubscription().catch(e => console.error("Silent sub failed", e));
                }
            });
    });
}
