/**
 * Middleware de sécurité - Protection complète de l'application
 * =============================================================
 * - Rate limiting (anti brute-force)
 * - Sanitization des entrées (anti XSS)
 * - Validation des données
 * - Headers de sécurité
 */

const rateLimit = require('express-rate-limit');
const xssFilters = require('xss-filters');

// ==========================================
// RATE LIMITING
// ==========================================

// Rate limiter global : 100 requêtes par minute par IP
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,
    message: { error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter strict pour login : 10 tentatives par 5 minutes
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: { error: 'Trop de tentatives de connexion érronées. Réessayez dans 5 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Ne compte que les échecs
});

// Rate limiter pour les demandes de reset password : 3 par heure
const resetPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 3,
    message: { error: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter pour l'activation de compte : 10 par heure
const activationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Trop de tentatives d\'activation. Réessayez plus tard.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter pour les uploads : 20 par 10 minutes
const uploadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: { error: 'Trop d\'uploads. Réessayez dans quelques minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// ==========================================
// SANITIZATION XSS
// ==========================================

/**
 * Sanitize récursivement une valeur contre les attaques XSS
 */
function sanitizeValue(value) {
    if (typeof value === 'string') {
        // Nettoyer les balises HTML dangereuses et les scripts
        return xssFilters.inHTMLData(value.trim());
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
        const sanitized = {};
        for (const key of Object.keys(value)) {
            sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
    }
    return value;
}

/**
 * Middleware de sanitization automatique du body, query et params
 */
function sanitizeInputs(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        // Ne pas sanitizer les mots de passe (ils seront hashés)
        const passwordFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword'];
        const preserved = {};
        for (const field of passwordFields) {
            if (req.body[field] !== undefined) {
                preserved[field] = req.body[field];
            }
        }
        req.body = sanitizeValue(req.body);
        // Restaurer les champs de mot de passe non sanitizés
        Object.assign(req.body, preserved);
    }
    if (req.query) {
        req.query = sanitizeValue(req.query);
    }
    if (req.params) {
        req.params = sanitizeValue(req.params);
    }
    next();
}

// ==========================================
// VALIDATION DES DONNÉES
// ==========================================

/**
 * Valider et assainir un email
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Valider un mot de passe (règles de complexité)
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Mot de passe requis' };
    }
    if (password.length < 8) {
        return { valid: false, message: 'Le mot de passe doit contenir au moins 8 caractères' };
    }
    if (password.length > 128) {
        return { valid: false, message: 'Le mot de passe est trop long (128 caractères max)' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Le mot de passe doit contenir au moins une majuscule' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Le mot de passe doit contenir au moins une minuscule' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Le mot de passe doit contenir au moins un chiffre' };
    }
    return { valid: true };
}

/**
 * Valider un numéro de téléphone
 */
function validatePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/\s+/g, '');
    const phoneRegex = /^[+]?[0-9]{10,15}$/;
    return phoneRegex.test(cleaned) ? cleaned : null;
}

/**
 * Valider un ID (empêcher l'injection)
 */
function validateId(id) {
    if (!id || typeof id !== 'string') return null;
    // Les IDs suivent le format prefix_timestamp_random
    const idRegex = /^[a-zA-Z0-9_-]{1,100}$/;
    return idRegex.test(id) ? id : null;
}

/**
 * Middleware pour empêcher la pollution de paramètres HTTP
 * et nettoyer les entrées suspectes
 */
function preventParamPollution(req, res, next) {
    // Vérifier les headers suspects
    const suspiciousPatterns = [
        /(<script|javascript:|on\w+=|eval\(|document\.|window\.)/i,
        /(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.*set)/i
    ];
    
    // Vérifier le body pour des injections SQL 
    if (req.body && typeof req.body === 'object') {
        const bodyStr = JSON.stringify(req.body);
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(bodyStr)) {
                console.warn(`⚠️ Requête suspecte détectée de ${req.ip}: ${pattern}`);
                return res.status(400).json({ error: 'Requête invalide' });
            }
        }
    }
    
    next();
}

// ==========================================
// PROTECTION DES HEADERS
// ==========================================

/**
 * Middleware pour masquer les informations techniques du serveur
 */
function hideServerInfo(req, res, next) {
    res.removeHeader('X-Powered-By');
    next();
}

/**
 * Middleware pour ajouter des headers de sécurité supplémentaires
 */
function additionalSecurityHeaders(req, res, next) {
    // Empêcher le clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Protection XSS du navigateur
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Empêcher le MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Politique de référence
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Politique de permissions
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Cache control pour les pages sensibles (API)
    if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
}

/**
 * Middleware de gestion d'erreurs sécurisé
 * Ne jamais exposer les détails d'erreur internes au client
 */
function secureErrorHandler(err, req, res, next) {
    // Logger l'erreur en interne
    console.error('❌ Erreur serveur:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
    // Ne jamais exposer les détails internes au client
    const statusCode = err.statusCode || 500;
    const clientMessage = statusCode === 500 
        ? 'Une erreur interne est survenue. Veuillez réessayer.'
        : err.message || 'Erreur serveur';
    
    res.status(statusCode).json({ error: clientMessage });
}

module.exports = {
    // Rate limiters
    globalLimiter,
    loginLimiter,
    resetPasswordLimiter,
    activationLimiter,
    uploadLimiter,
    
    // Sanitization
    sanitizeInputs,
    sanitizeValue,
    
    // Validation
    validateEmail,
    validatePassword,
    validatePhone,
    validateId,
    
    // Protection
    preventParamPollution,
    hideServerInfo,
    additionalSecurityHeaders,
    secureErrorHandler
};
