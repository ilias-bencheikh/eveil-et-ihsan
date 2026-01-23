// Constantes de l'application

// Configuration du serveur
const SERVER_CONFIG = {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0'
};

// Comptes de démonstration
const DEMO_ACCOUNTS = {
    professeurs: [],
    eleves: [],
    staff: [
        { id: 'admin1', email: 'admin@ecole.fr', password: 'admin', role: 'admin' }
    ]
};

// Permissions par rôle
const PERMISSIONS = {
    admin: ['create', 'read', 'update', 'delete'],
    directeur: ['create', 'read', 'update', 'delete'],
    secretariat: ['create', 'read', 'update'],
    professeur: ['read', 'create_absence', 'create_appreciation'],
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
    SESSION: 10 * 60 * 1000  // 10 minutes
};

module.exports = {
    SERVER_CONFIG,
    DEMO_ACCOUNTS,
    PERMISSIONS,
    NIVEAUX,
    TOKEN_EXPIRY
};
