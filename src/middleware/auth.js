const { PERMISSIONS } = require('../config/constants');

// Vérifier si un rôle a une permission
function hasPermission(role, action) {
    return PERMISSIONS[role]?.includes(action) || false;
}

// Middleware de vérification des permissions
function checkPermission(action) {
    return (req, res, next) => {
        const userRole = req.headers['x-user-role'];
        if (hasPermission(userRole, action)) {
            next();
        } else {
            res.status(403).json({ message: 'Accès refusé' });
        }
    };
}

// Middleware pour vérifier l'authentification
function requireAuth(req, res, next) {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    
    if (!userId || !userRole) {
        return res.status(401).json({ message: 'Non authentifié' });
    }
    
    req.userId = userId;
    req.userRole = userRole;
    next();
}

// Middleware pour vérifier les rôles admin/directeur
function requireAdmin(req, res, next) {
    const userRole = req.headers['x-user-role'];
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }
    
    next();
}

module.exports = {
    hasPermission,
    checkPermission,
    requireAuth,
    requireAdmin
};
