/**
 * Utilitaires généraux
 */

// Formater une date
function formatDate(dateString, format = 'short') {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    if (format === 'short') {
        return date.toLocaleDateString('fr-FR');
    } else if (format === 'long') {
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else if (format === 'datetime') {
        return date.toLocaleString('fr-FR');
    }
    
    return date.toLocaleDateString('fr-FR');
}

// Formater un nom complet
function formatFullName(prenom, nom) {
    return `${prenom || ''} ${nom || ''}`.trim();
}

// Capitaliser la première lettre
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Générer un ID unique
function generateId(prefix = '') {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// Valider un email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Débounce une fonction
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle une fonction
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Copier dans le presse-papier
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Erreur copie:', err);
        return false;
    }
}

// Télécharger un fichier
function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Convertir image en base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Obtenir les paramètres URL
function getUrlParams() {
    const params = {};
    const searchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of searchParams) {
        params[key] = value;
    }
    return params;
}

// Export global
window.Utils = {
    formatDate,
    formatFullName,
    capitalize,
    generateId,
    isValidEmail,
    debounce,
    throttle,
    copyToClipboard,
    downloadFile,
    imageToBase64,
    getUrlParams
};
