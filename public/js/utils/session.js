/**
 * Utilitaires - Gestion de session
 * Support des connexions multiples sur comptes différents
 */

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes d'inactivité côté client
let inactivityTimer = null;

// Mettre à jour le timestamp de la dernière activité
function updateActivity() {
    localStorage.setItem('lastActivity', Date.now().toString());
    resetInactivityTimer();
    
    // Valider périodiquement la session côté serveur
    validateSessionPeriodically();
}

// Variable pour éviter les validations trop fréquentes
let lastValidation = 0;
const VALIDATION_INTERVAL = 5 * 60 * 1000; // Valider toutes les 5 minutes

// Valider la session côté serveur périodiquement
async function validateSessionPeriodically() {
    const now = Date.now();
    if (now - lastValidation < VALIDATION_INTERVAL) return;
    
    lastValidation = now;
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/auth/validate-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            // Session invalide côté serveur
            handleSessionExpired('Votre session a expiré. Veuillez vous reconnecter.');
        }
    } catch (error) {
        console.error('Erreur validation session:', error);
    }
}

// Gérer l'expiration de session
function handleSessionExpired(message) {
    localStorage.clear();
    if (window.UI) {
        window.UI.showAlert(message, 'warning');
    }
    setTimeout(() => window.location.href = '/login', 1500);
}

// Réinitialiser le timer d'inactivité
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        // Déconnecter côté serveur aussi
        const token = localStorage.getItem('token');
        if (token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).catch(() => {});
        }
        handleSessionExpired('Votre session a expiré après 30 minutes d\'inactivité.');
    }, SESSION_TIMEOUT);
}

// Initialiser les événements d'activité
function initActivityTracking() {
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);
    document.addEventListener('click', updateActivity);
    document.addEventListener('scroll', updateActivity);
}

// Vérifier l'authentification
function checkAuth() {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userStr || !token) {
        window.location.href = '/login';
        return null;
    }
    
    // Vérifier si la session a expiré côté client
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
            // Déconnecter côté serveur
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).catch(() => {});
            
            handleSessionExpired('Votre session a expiré après 30 minutes d\'inactivité.');
            return null;
        }
    }
    
    updateActivity();
    return JSON.parse(userStr);
}

// Obtenir l'utilisateur courant
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Obtenir le token de session
function getToken() {
    return localStorage.getItem('token');
}

// Sauvegarder l'utilisateur et le token
function saveUser(user, token) {
    localStorage.setItem('user', JSON.stringify(user));
    if (token) {
        localStorage.setItem('token', token);
    }
    updateActivity();
}

// Déconnexion
async function logout() {
    const token = localStorage.getItem('token');
    
    // Déconnecter côté serveur
    if (token) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        }
    }
    
    localStorage.clear();
    window.location.href = '/login';
}

// Déconnecter toutes les sessions
async function logoutAll() {
    const token = localStorage.getItem('token');
    const user = getCurrentUser();
    
    if (token && user) {
        try {
            await fetch('/api/auth/logout-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id,
                    'X-User-Role': user.role
                }
            });
        } catch (error) {
            console.error('Erreur lors de la déconnexion globale:', error);
        }
    }
    
    localStorage.clear();
    window.location.href = '/login';
}

// Obtenir la liste des sessions actives
async function getActiveSessions() {
    const token = localStorage.getItem('token');
    const user = getCurrentUser();
    
    if (!token || !user) return [];
    
    try {
        const response = await fetch('/api/auth/sessions', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-User-Id': user.id,
                'X-User-Role': user.role
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sessions || [];
        }
    } catch (error) {
        console.error('Erreur récupération sessions:', error);
    }
    
    return [];
}

// Export global
window.Session = {
    checkAuth,
    getCurrentUser,
    getToken,
    saveUser,
    logout,
    logoutAll,
    getActiveSessions,
    initActivityTracking,
    updateActivity
};
