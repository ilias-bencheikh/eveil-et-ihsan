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
            alert("Erreur : Vous devez être connecté pour activer les notifications.");
            return false;
        }
        
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.error("Les notifications Push ne sont pas supportées sur ce navigateur.");
            alert("Votre navigateur ne supporte pas les notifications Push.");
            return false;
        }

        const registration = await navigator.serviceWorker.ready;
        console.log("Service Worker prêt. Demande de permission...");

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn("Permission refusée par l'utilisateur.");
            alert("Vous avez refusé les notifications. Veuillez les autoriser dans les paramètres de votre navigateur/appareil.");
            updatePushSettingsUI(false);
            return false;
        }

        console.log("Permission accordée. Récupération de la clé publique...");
        const keyRes = await fetch('/api/push/vapid-public-key', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!keyRes.ok) {
            console.error("Erreur récupération clé:", await keyRes.text());
            alert("Erreur serveur lors de la configuration des notifications.");
            return false;
        }
        
        const { publicKey } = await keyRes.json();
        console.log("Clé publique reçue. Souscription...");

        // Désabonnement systématique pour s'assurer d'avoir un jeton propre avec la bonne clé VAPID
        let currentSub = await registration.pushManager.getSubscription();
        if (currentSub) {
            console.log("Ancien abonnement trouvé, désabonnement...");
            await currentSub.unsubscribe();
        }

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
            updatePushSettingsUI(true);
            return true;
        } else {
            console.error("Erreur lors de l'enregistrement de l'abonnement:", await subRes.text());
            alert("Une erreur s'est produite côté serveur.");
            return false;
        }
    } catch (err) {
        console.error('Erreur globale Push:', err);
        alert("Une erreur technique est survenue : " + err.message);
        return false;
    }
};

window.unsubscribePush = async function() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            console.log("Désabonnement réussi en local.");
        }
        // Appeler l'API si vous avez une route pour supprimer l'abonnement côté serveur
        updatePushSettingsUI(false);
        alert("Notifications push désactivées.");
    } catch (error) {
        console.error("Erreur lors du désabonnement:", error);
    }
};

function updatePushSettingsUI(isSubscribed) {
    const pushCheckbox = document.getElementById('pushNotifCheckbox');
    if (pushCheckbox) {
        pushCheckbox.checked = isSubscribed;
    }
}

async function checkPushSubscriptionStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        updatePushSettingsUI(!!subscription && Notification.permission === 'granted');
    } catch(e) {
        console.error("Erreur vérification statut push", e);
    }
}

// Custom prompt for first PWA open
function showFirstInstallPushPrompt() {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // Only show if standalone, permission is default (not yet asked), and we haven't shown it before
    if (isStandalone && Notification.permission === 'default' && !localStorage.getItem('pushPromptShown')) {
        // Build modal UI
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '999999';
        
        const modal = document.createElement('div');
        modal.style.background = '#fff';
        modal.style.padding = '24px';
        modal.style.borderRadius = '16px';
        modal.style.maxWidth = '320px';
        modal.style.textAlign = 'center';
        modal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        modal.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        
        modal.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 16px;">🔔</div>
            <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1f2937;">Activer les notifications</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">Ne manquez aucun message ni aucune information importante. Vous pouvez toujours modifier ce choix dans les paramètres.</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button id="btnPushAccept" style="background: var(--md-sys-color-primary, #0056b3); color: #fff; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">Oui, activer</button>
                <button id="btnPushDecline" style="background: transparent; color: #6b7280; border: none; padding: 12px; font-size: 14px; cursor: pointer;">Plus tard</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        document.getElementById('btnPushAccept').addEventListener('click', async () => {
            localStorage.setItem('pushPromptShown', 'true');
            overlay.remove();
            await window.forcePushSubscription();
            checkPushSubscriptionStatus();
        });
        
        document.getElementById('btnPushDecline').addEventListener('click', () => {
            localStorage.setItem('pushPromptShown', 'true');
            overlay.remove();
        });
    }
}

// Initialisation automatique (silencieuse)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => {
                // Si la permission est déjà accordée, on retente la souscription en silence
                if (Notification.permission === 'granted') {
                    window.forcePushSubscription().catch(e => console.error("Silent sub failed", e));
                }
                
                // Mettre à jour l'UI des paramètres si présent
                checkPushSubscriptionStatus();
                
                // Montrer le prompt pour la première ouverture PWA
                setTimeout(showFirstInstallPushPrompt, 2000); // petit délai pour ne pas brusquer
            });
            
        // Écouteur pour la checkbox des paramètres
        document.addEventListener('change', function(e) {
            if (e.target && e.target.id === 'pushNotifCheckbox') {
                if (e.target.checked) {
                    window.forcePushSubscription();
                } else {
                    window.unsubscribePush();
                }
            }
        });
    });
}
