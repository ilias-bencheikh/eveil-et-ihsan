/**
 * Utilitaires - Gestion de session
 */

const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
let inactivityTimer = null;

// Mettre à jour le timestamp de la dernière activité
function updateActivity() {
    localStorage.setItem('lastActivity', Date.now().toString());
    resetInactivityTimer();
}

// Réinitialiser le timer d'inactivité
function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(() => {
        localStorage.clear();
        if (window.UI) {
            window.UI.showAlert('Votre session a expiré après 10 minutes d\'inactivité.', 'warning');
        }
        setTimeout(() => window.location.href = 'login.html', 1500);
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
    if (!userStr) {
        window.location.href = 'login.html';
        return null;
    }
    
    // Vérifier si la session a expiré
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
            localStorage.clear();
            if (window.UI) {
                window.UI.showAlert('Votre session a expiré après 10 minutes d\'inactivité.', 'warning');
            }
            setTimeout(() => window.location.href = 'login.html', 1500);
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

// Sauvegarder l'utilisateur
function saveUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
    updateActivity();
}

// Déconnexion
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Export global
window.Session = {
    checkAuth,
    getCurrentUser,
    saveUser,
    logout,
    initActivityTracking,
    updateActivity
};
