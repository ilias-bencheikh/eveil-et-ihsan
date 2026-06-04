// ============================================================
// PWA Push Notifications - Eveil & Ihsan
// ============================================================

// Convert VAPID key base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ============================================================
// Subscribe to Push Notifications
// ============================================================
window.forcePushSubscription = async function(silent = false) {
    try {
        console.log('[Push] Tentative d\'abonnement...');
        const token = localStorage.getItem('token');
        if (!token) {
            if (!silent) showToast('error', 'Erreur', 'Vous devez être connecté pour activer les notifications.');
            return false;
        }

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            if (!silent) showToast('error', 'Non supporté', 'Votre navigateur ne supporte pas les notifications push.');
            return false;
        }

        const registration = await navigator.serviceWorker.ready;

        let permission = Notification.permission;
        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            if (!silent) showToast('warning', 'Permission refusée', 'Veuillez autoriser les notifications dans les paramètres de votre navigateur.');
            updatePushSettingsUI(false);
            return false;
        }

        // Get VAPID public key
        const keyRes = await fetch('/api/push/vapid-public-key', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!keyRes.ok) {
            if (!silent) showToast('error', 'Erreur', 'Impossible de récupérer la clé serveur.');
            return false;
        }

        const { publicKey } = await keyRes.json();

        // Unsubscribe any existing subscription (clean state)
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
            await existingSub.unsubscribe();
        }

        // Subscribe with VAPID
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send subscription to server
        const subRes = await fetch('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (subRes.ok) {
            console.log('[Push] Abonnement enregistré avec succès !');
            updatePushSettingsUI(true);
            if (!silent) showToast('success', 'Notifications activées', 'Vous recevrez les alertes importantes.');
            return true;
        } else {
            console.error('[Push] Erreur serveur:', await subRes.text());
            if (!silent) showToast('error', 'Erreur serveur', 'Une erreur est survenue.');
            return false;
        }
    } catch (err) {
        console.error('[Push] Erreur globale:', err);
        if (!silent) showToast('error', 'Erreur technique', err.message);
        return false;
    }
};

// ============================================================
// Unsubscribe from Push
// ============================================================
window.unsubscribePush = async function() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
        }
        updatePushSettingsUI(false);
        showToast('info', 'Notifications désactivées', 'Vous ne recevrez plus de notifications push.');
    } catch (error) {
        console.error('[Push] Erreur désabonnement:', error);
    }
};

// ============================================================
// Update Settings UI (checkbox sync)
// ============================================================
function updatePushSettingsUI(isSubscribed) {
    const checkbox = document.getElementById('pushNotifCheckbox');
    if (checkbox) {
        checkbox.checked = isSubscribed;
    }
}

async function checkPushSubscriptionStatus() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        updatePushSettingsUI(!!subscription && Notification.permission === 'granted');
    } catch(e) {
        console.error('[Push] Erreur vérification statut:', e);
    }
}

// ============================================================
// Toast Notification System (for better UX)
// ============================================================
function showToast(type, title, message) {
    // Remove any existing toast
    const existing = document.querySelector('.pwa-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'pwa-toast';

    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };

    const colors = {
        success: { bg: '#a1f4b1', icon: '#146b3a', border: '#146b3a' },
        error: { bg: '#ffdad6', icon: '#ba1a1a', border: '#ba1a1a' },
        warning: { bg: '#ffdea6', icon: '#7c5800', border: '#7c5800' },
        info: { bg: '#d4e3ff', icon: '#1e5aa8', border: '#1e5aa8' }
    };

    const c = colors[type] || colors.info;

    toast.innerHTML = `
        <div class="pwa-toast-icon" style="background:${c.bg}; color:${c.icon};">
            <span class="material-icons">${icons[type] || 'info'}</span>
        </div>
        <div class="pwa-toast-content">
            <div class="pwa-toast-title">${title}</div>
            <div class="pwa-toast-message">${message}</div>
        </div>
        <button class="pwa-toast-close" onclick="this.closest('.pwa-toast').remove()">
            <span class="material-icons">close</span>
        </button>
    `;

    // Inject styles if not present
    if (!document.getElementById('pwa-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'pwa-toast-styles';
        style.textContent = `
            .pwa-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                z-index: 999999;
                max-width: 380px;
                width: calc(100% - 32px);
                animation: pwaToastIn 0.35s cubic-bezier(0.05, 0.7, 0.1, 1);
                border: 1px solid rgba(0,0,0,0.1);
            }
            @keyframes pwaToastIn {
                from { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
            }
            .pwa-toast-icon {
                flex-shrink: 0;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .pwa-toast-icon .material-icons { font-size: 20px; }
            .pwa-toast-content { flex: 1; min-width: 0; }
            .pwa-toast-title {
                font-family: 'Google Sans', 'Roboto', sans-serif;
                font-weight: 500;
                font-size: 14px;
                color: #191c20;
                margin-bottom: 2px;
            }
            .pwa-toast-message {
                font-family: 'Roboto', sans-serif;
                font-size: 13px;
                color: #43474e;
                line-height: 1.4;
            }
            .pwa-toast-close {
                flex-shrink: 0;
                background: none;
                border: none;
                cursor: pointer;
                color: #73777f;
                display: flex;
                align-items: center;
                padding: 4px;
                border-radius: 50%;
                transition: background 0.2s;
            }
            .pwa-toast-close:hover { background: rgba(0,0,0,0.06); }
            .pwa-toast-close .material-icons { font-size: 18px; }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // Auto-dismiss after 4s
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'pwaToastIn 0.25s ease reverse forwards';
            setTimeout(() => toast.remove(), 250);
        }
    }, 4000);
}

// ============================================================
// First Install Push Prompt (Beautiful Modal)
// ============================================================
function showFirstInstallPushPrompt() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (!isStandalone) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem('pushPromptShown')) return;

    // Build modal
    const overlay = document.createElement('div');
    overlay.className = 'push-prompt-overlay';

    const modal = document.createElement('div');
    modal.className = 'push-prompt-modal';

    modal.innerHTML = `
        <div class="push-prompt-header">
            <div class="push-prompt-icon">
                <span class="material-icons">notifications_active</span>
            </div>
            <div class="push-prompt-badges">
                <span class="badge badge-new">Nouveau</span>
            </div>
        </div>

        <h2 class="push-prompt-title">Restez informés</h2>
        <p class="push-prompt-desc">
            Activez les notifications pour recevoir les alertes importantes :
            messages des enseignants, résultats scolaires, rappels et actualités de l'établissement.
        </p>

        <div class="push-prompt-features">
            <div class="push-feature">
                <span class="material-icons">mail</span>
                <span>Nouveaux messages</span>
            </div>
            <div class="push-feature">
                <span class="material-icons">school</span>
                <span>Résultats scolaires</span>
            </div>
            <div class="push-feature">
                <span class="material-icons">event</span>
                <span>Événements à venir</span>
            </div>
        </div>

        <div class="push-prompt-actions">
            <button id="btnPushAccept" class="btn-push-primary">
                <span class="material-icons">notifications_active</span>
                Activer les notifications
            </button>
            <button id="btnPushDecline" class="btn-push-secondary">
                Plus tard
            </button>
        </div>

        <div class="push-prompt-footer">
            <span class="material-icons" style="font-size:12px;">lock</span>
            Vous pouvez modifier ce choix à tout moment dans les paramètres
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Inject styles
    if (!document.getElementById('push-prompt-styles')) {
        const style = document.createElement('style');
        style.id = 'push-prompt-styles';
        style.textContent = `
            .push-prompt-overlay {
                position: fixed;
                inset: 0;
                background: rgba(25, 28, 32, 0.6);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                padding: 16px;
                animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .push-prompt-modal {
                background: white;
                border-radius: 24px;
                padding: 32px 28px 24px;
                max-width: 360px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: modalPop 0.4s cubic-bezier(0.05, 0.7, 0.1, 1);
                font-family: 'Google Sans', 'Roboto', sans-serif;
            }
            @keyframes modalPop {
                from { opacity: 0; transform: scale(0.88) translateY(20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .push-prompt-header {
                position: relative;
                margin-bottom: 20px;
            }
            .push-prompt-icon {
                width: 72px;
                height: 72px;
                border-radius: 50%;
                background: linear-gradient(135deg, #d4e3ff 0%, #a5c8ff 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto;
                box-shadow: 0 4px 16px rgba(30, 90, 168, 0.25);
            }
            .push-prompt-icon .material-icons {
                font-size: 36px;
                color: #1e5aa8;
            }
            .push-prompt-badges {
                position: absolute;
                top: 0;
                right: calc(50% - 36px);
            }
            .badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .badge-new {
                background: #1e5aa8;
                color: white;
            }
            .push-prompt-title {
                font-size: 22px;
                font-weight: 500;
                color: #191c20;
                margin: 0 0 10px;
                letter-spacing: -0.3px;
            }
            .push-prompt-desc {
                font-family: 'Roboto', sans-serif;
                font-size: 14px;
                color: #43474e;
                line-height: 1.55;
                margin: 0 0 20px;
            }
            .push-prompt-features {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 24px;
                text-align: left;
                background: #f8f9ff;
                border-radius: 12px;
                padding: 14px 16px;
            }
            .push-feature {
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: 'Roboto', sans-serif;
                font-size: 13px;
                color: #43474e;
            }
            .push-feature .material-icons {
                font-size: 18px;
                color: #1e5aa8;
            }
            .push-prompt-actions {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 16px;
            }
            .btn-push-primary {
                width: 100%;
                background: #1e5aa8;
                color: white;
                border: none;
                padding: 14px 20px;
                border-radius: 14px;
                font-size: 15px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                box-shadow: 0 2px 8px rgba(30, 90, 168, 0.3);
                transition: all 0.2s ease;
                font-family: 'Google Sans', 'Roboto', sans-serif;
            }
            .btn-push-primary:hover {
                background: #1a4f94;
                box-shadow: 0 4px 16px rgba(30, 90, 168, 0.4);
                transform: translateY(-1px);
            }
            .btn-push-primary:active {
                transform: scale(0.98);
            }
            .btn-push-primary .material-icons { font-size: 20px; }
            .btn-push-secondary {
                width: 100%;
                background: transparent;
                color: #73777f;
                border: none;
                padding: 10px;
                font-size: 14px;
                cursor: pointer;
                font-family: 'Roboto', sans-serif;
                transition: color 0.2s;
            }
            .btn-push-secondary:hover { color: #191c20; }
            .push-prompt-footer {
                font-family: 'Roboto', sans-serif;
                font-size: 11px;
                color: #73777f;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }
            .push-prompt-footer .material-icons { font-size: 12px; }
        `;
        document.head.appendChild(style);
    }

    // Event listeners
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

    // Remove on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            localStorage.setItem('pushPromptShown', 'true');
            overlay.remove();
        }
    });
}

// ============================================================
// Auto-init on page load
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => {
                console.log('[SW] Service Worker enregistré');

                // Silently re-subscribe if already granted
                if (Notification.permission === 'granted') {
                    window.forcePushSubscription(true).catch(e => console.warn('[SW] Silent sub failed:', e));
                }

                // Sync UI state
                checkPushSubscriptionStatus();

                // Show first-install push prompt after delay
                setTimeout(showFirstInstallPushPrompt, 2500);
            })
            .catch(err => console.warn('[SW] Registration failed:', err));

        // Listen for checkbox changes in settings
        document.addEventListener('change', (e) => {
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