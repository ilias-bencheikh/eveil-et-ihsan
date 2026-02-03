// Constantes de l'application

// Configuration du serveur
const SERVER_CONFIG = {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`
};

// Permissions par rôle
const PERMISSIONS = {
    admin: ['create', 'read', 'update', 'delete'],
    directeur: ['create', 'read', 'update', 'delete'],
    secretariat: ['create', 'read', 'update'],
    professeur: ['read', 'create_absence', 'create_appreciation'],
    parent: ['read_own'],
    eleve: ['read_own']
};

// Niveaux scolaires
const NIVEAUX = [
    'Maternelle',
    'CP',
    'CE1',
    'CE2',
    'CM1',
    'CM2',
    '6ème',
    '5ème',
    '4ème',
    '3ème'
];

// Durée de validité des tokens (en millisecondes)
const TOKEN_EXPIRY = {
    RESET_PASSWORD: 3600000, // 1 heure
    SESSION: 24 * 60 * 60 * 1000,  // 24 heures pour les sessions
    SESSION_INACTIVITY: 30 * 60 * 1000  // 30 minutes d'inactivité max
};

// Configuration des sessions multiples
const SESSION_CONFIG = {
    MAX_SESSIONS_PER_USER: 5,  // Nombre max de sessions par utilisateur
    CLEANUP_INTERVAL: 60 * 60 * 1000,  // Nettoyage toutes les heures
    ALLOW_MULTIPLE_SESSIONS: true  // Permettre plusieurs connexions simultanées
};

module.exports = {
    SERVER_CONFIG,
    PERMISSIONS,
    NIVEAUX,
    TOKEN_EXPIRY,
    SESSION_CONFIG
};
