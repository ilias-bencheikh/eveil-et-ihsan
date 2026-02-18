const { PERMISSIONS, TOKEN_EXPIRY } = require('../config/constants');
const { db } = require('../config/database');
const { dbGet, dbRun } = require('../utils/helpers');

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

// Middleware pour vérifier l'authentification via token de session
async function requireAuth(req, res, next) {
    // Support des deux méthodes : headers classiques ou token Bearer
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];
    
    // Si on a un token Bearer, valider la session
    if (token) {
        try {
            const now = Date.now();
            const session = await dbGet(db, 
                'SELECT * FROM sessions WHERE token = ? AND expiresAt > ?',
                [token, now]
            );
            
            if (!session) {
                return res.status(401).json({ message: 'Session invalide ou expirée' });
            }
            
            // Vérifier l'inactivité
            if (now - session.lastActivity > TOKEN_EXPIRY.SESSION_INACTIVITY) {
                await dbRun(db, 'DELETE FROM sessions WHERE token = ?', [token]);
                return res.status(401).json({ message: 'Session expirée par inactivité' });
            }
            
            // Mettre à jour l'activité
            await dbRun(db, 'UPDATE sessions SET lastActivity = ? WHERE token = ?', [now, token]);
            
            req.userId = session.userId;
            req.userRole = session.userRole;
            req.sessionToken = token;
            return next();
        } catch (err) {
            console.error('Erreur validation session:', err);
            return res.status(500).json({ message: 'Erreur serveur' });
        }
    }
    
    // Fallback : méthode classique via headers (rétro-compatibilité)
    if (!userId || !userRole) {
        return res.status(401).json({ message: 'Non authentifié' });
    }
    
    req.userId = userId;
    req.userRole = userRole;
    next();
}

// Middleware pour vérifier les rôles admin/directeur
function requireAdmin(req, res, next) {
    const userRole = req.headers['x-user-role'] || req.userRole;
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }
    
    next();
}

// Middleware de vérification du mode maintenance
// Bloque les utilisateurs non-staff si la maintenance est active
async function checkMaintenance(req, res, next) {
    try {
        const maintenanceRow = await dbGet(db, 'SELECT * FROM maintenance WHERE id = 1 AND active = 1');
        if (!maintenanceRow) {
            return next(); // Pas de maintenance, on continue
        }

        // Vérifier si l'utilisateur est staff (admin, directeur, secretariat, secretaire)
        const userRole = req.userRole || req.headers['x-user-role'];
        const staffRoles = ['admin', 'directeur', 'secretariat', 'secretaire'];

        if (staffRoles.includes(userRole)) {
            return next(); // Les staff passent toujours
        }

        // Bloquer les non-staff
        return res.status(503).json({
            error: 'Le site est actuellement en maintenance.',
            maintenance: true,
            dateDebut: maintenanceRow.dateDebut,
            dateFin: maintenanceRow.dateFin || null
        });
    } catch (err) {
        console.error('Erreur middleware maintenance:', err);
        next(); // En cas d'erreur, on laisse passer
    }
}

module.exports = {
    hasPermission,
    checkPermission,
    requireAuth,
    requireAdmin,
    checkMaintenance
};
