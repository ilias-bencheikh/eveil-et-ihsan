const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { TOKEN_EXPIRY, SESSION_CONFIG } = require('../config/constants');
const { sendEmail } = require('../config/email');
const { generateToken, generateId, dbGet, dbRun, dbAll } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');
const { hashPassword, verifyPassword } = require('../utils/password');
const { loginLimiter, resetPasswordLimiter, validateEmail, validatePassword } = require('../middleware/security');

// Créer une session pour un utilisateur
async function createSession(user, req) {
    const sessionToken = generateToken(64);
    const sessionId = generateId('session');
    const now = Date.now();
    const expiresAt = now + TOKEN_EXPIRY.SESSION;
    
    // Récupérer le nombre de sessions actives pour cet utilisateur
    const activeSessions = await dbAll(db, 
        'SELECT id FROM sessions WHERE userId = ? AND userRole = ? AND expiresAt > ?',
        [user.id, user.role, now]
    );
    
    // Si le nombre max de sessions est atteint, supprimer la plus ancienne
    if (activeSessions.length >= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
        await dbRun(db, 
            `DELETE FROM sessions WHERE id = (
                SELECT id FROM sessions WHERE userId = ? AND userRole = ? 
                ORDER BY lastActivity ASC LIMIT 1
            )`,
            [user.id, user.role]
        );
    }
    
    // Créer la nouvelle session
    await dbRun(db, 
        `INSERT INTO sessions (id, token, userId, userRole, userEmail, userName, createdAt, expiresAt, lastActivity, userAgent, ipAddress)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            sessionId,
            sessionToken,
            user.id,
            user.role,
            user.email,
            `${user.prenom} ${user.nom}`,
            now,
            expiresAt,
            now,
            req.headers['user-agent'] || 'Unknown',
            req.ip || req.connection.remoteAddress || 'Unknown'
        ]
    );
    
    return sessionToken;
}

// Login (avec rate limiting anti brute-force)
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    // Validation des entrées
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const cleanEmail = validateEmail(email);
    if (!cleanEmail) {
        return res.status(400).json({ error: 'Format d\'email invalide' });
    }

    try {
        // Vérifier le mode maintenance en premier
        const maintenance = await dbGet(db, 'SELECT * FROM maintenance WHERE id = 1 AND active = 1');

        // Vérifier dans la table STAFF (par email uniquement, vérification mdp via bcrypt)
        let row = await dbGet(db, 'SELECT * FROM staff WHERE email = ? AND activated = 1', [cleanEmail]);
        
        if (row && await verifyPassword(password, row.password)) {
            // En maintenance, seuls les admins peuvent se connecter
            const adminRoles = ['admin'];
            if (maintenance && !adminRoles.includes(row.role)) {
                return res.status(503).json({
                    error: 'Le site est actuellement en maintenance.',
                    maintenance: true,
                    dateDebut: maintenance.dateDebut,
                    dateFin: maintenance.dateFin || null,
                    message: maintenance.message || null
                });
            }
            // Migrer le mot de passe vers bcrypt si nécessaire
            await migratePasswordIfNeeded('staff', row.id, password, row.password);
            
            const user = {
                id: row.id,
                email: row.email,
                role: row.role,
                nom: row.nom,
                prenom: row.prenom
            };
            const token = await createSession(user, req);
            return res.json({ user, token });
        }

        // Bloquer tous les autres utilisateurs en maintenance
        if (maintenance) {
            return res.status(503).json({
                error: 'Le site est actuellement en maintenance.',
                maintenance: true,
                dateDebut: maintenance.dateDebut,
                dateFin: maintenance.dateFin || null,
                message: maintenance.message || null
            });
        }

        // Vérifier dans la table PARENTS
        row = await dbGet(db, 'SELECT * FROM parents WHERE email = ? AND activated = 1', [cleanEmail]);
        
        if (row && await verifyPassword(password, row.password)) {
            await migratePasswordIfNeeded('parents', row.id, password, row.password);
            
            const enfants = await dbAll(db, `
                SELECT e.id, e.nom, e.prenom, e.classe, e.photo, ep.isPrimary
                FROM eleves e
                INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                WHERE ep.parentId = ?
            `, [row.id]);
            
            const user = {
                id: row.id,
                email: row.email,
                role: 'parent',
                nom: row.nom,
                prenom: row.prenom,
                enfants: enfants
            };
            const token = await createSession(user, req);
            return res.json({ user, token });
        }

        // Vérifier dans la table ÉLÈVES
        row = await dbGet(db, 'SELECT * FROM eleves WHERE email = ? AND activated = 1', [cleanEmail]);
        
        if (row && await verifyPassword(password, row.password)) {
            await migratePasswordIfNeeded('eleves', row.id, password, row.password);
            
            const user = {
                id: row.id,
                email: row.email,
                role: 'eleve',
                nom: row.nom,
                prenom: row.prenom,
                classe: row.classe || null,
                tel: row.tel || null,
                adresse: row.adresse || null
            };
            const token = await createSession(user, req);
            return res.json({ user, token });
        }

        // Vérifier dans la table PROFESSEURS
        row = await dbGet(db, 'SELECT * FROM professeurs WHERE email = ? AND activated = 1', [cleanEmail]);
        
        if (row && await verifyPassword(password, row.password)) {
            await migratePasswordIfNeeded('professeurs', row.id, password, row.password);
            
            const user = {
                id: row.id,
                email: row.email,
                role: 'professeur',
                nom: row.nom,
                prenom: row.prenom
            };
            const token = await createSession(user, req);
            return res.json({ user, token });
        }

        // Message générique pour ne pas révéler si l'email existe
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        
    } catch (err) {
        console.error('Erreur login:', err);
        return res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

/**
 * Migration automatique des mots de passe en clair vers bcrypt
 * Exécuté au login lorsque le mot de passe est encore en clair
 */
async function migratePasswordIfNeeded(table, userId, plainPassword, storedPassword) {
    try {
        // Si le mot de passe stocké n'est pas encore hashé avec bcrypt
        if (!storedPassword.startsWith('$2b$') && !storedPassword.startsWith('$2a$')) {
            const hashed = await hashPassword(plainPassword);
            await dbRun(db, `UPDATE ${table} SET password = ? WHERE id = ?`, [hashed, userId]);
            console.log(`🔒 Mot de passe migré vers bcrypt pour ${table}/${userId}`);
        }
    } catch (err) {
        console.error('Erreur migration mot de passe:', err);
    }
}

// Valider une session (vérifier si le token est valide)
router.post('/validate-session', async (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.body.token;
    
    if (!token) {
        return res.status(401).json({ valid: false, message: 'Token manquant' });
    }
    
    try {
        const now = Date.now();
        const session = await dbGet(db, 
            'SELECT * FROM sessions WHERE token = ? AND expiresAt > ?',
            [token, now]
        );
        
        if (!session) {
            return res.status(401).json({ valid: false, message: 'Session invalide ou expirée' });
        }
        
        // Vérifier l'inactivité
        if (now - session.lastActivity > TOKEN_EXPIRY.SESSION_INACTIVITY) {
            await dbRun(db, 'DELETE FROM sessions WHERE token = ?', [token]);
            return res.status(401).json({ valid: false, message: 'Session expirée par inactivité' });
        }
        
        // Mettre à jour l'activité
        await dbRun(db, 'UPDATE sessions SET lastActivity = ? WHERE token = ?', [now, token]);
        
        res.json({ 
            valid: true, 
            user: {
                id: session.userId,
                role: session.userRole,
                email: session.userEmail,
                name: session.userName
            }
        });
    } catch (err) {
        console.error('Erreur validation session:', err);
        res.status(500).json({ valid: false, error: 'Erreur serveur' });
    }
});

// Déconnexion (supprimer la session)
router.post('/logout', async (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.body.token;
    
    if (!token) {
        return res.json({ success: true, message: 'Déjà déconnecté' });
    }
    
    try {
        await dbRun(db, 'DELETE FROM sessions WHERE token = ?', [token]);
        res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (err) {
        console.error('Erreur logout:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Déconnexion de toutes les sessions d'un utilisateur
router.post('/logout-all', requireAuth, async (req, res) => {
    const userId = req.userId;
    const userRole = req.userRole;
    
    try {
        const result = await dbRun(db, 
            'DELETE FROM sessions WHERE userId = ? AND userRole = ?',
            [userId, userRole]
        );
        res.json({ 
            success: true, 
            message: `${result.changes} session(s) fermée(s)` 
        });
    } catch (err) {
        console.error('Erreur logout-all:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Lister les sessions actives d'un utilisateur
router.get('/sessions', requireAuth, async (req, res) => {
    const userId = req.userId;
    const userRole = req.userRole;
    const currentToken = req.headers['authorization']?.replace('Bearer ', '');
    
    try {
        const sessions = await dbAll(db, 
            `SELECT id, createdAt, lastActivity, userAgent, ipAddress 
             FROM sessions 
             WHERE userId = ? AND userRole = ? AND expiresAt > ?
             ORDER BY lastActivity DESC`,
            [userId, userRole, Date.now()]
        );
        
        // Marquer la session courante
        const formattedSessions = sessions.map(s => ({
            id: s.id,
            createdAt: new Date(s.createdAt).toISOString(),
            lastActivity: new Date(s.lastActivity).toISOString(),
            device: s.userAgent,
            ip: s.ipAddress,
            current: currentToken && s.id === currentToken
        }));
        
        res.json({ sessions: formattedSessions });
    } catch (err) {
        console.error('Erreur liste sessions:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Révoquer une session spécifique
router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;
    
    try {
        const result = await dbRun(db, 
            'DELETE FROM sessions WHERE id = ? AND userId = ? AND userRole = ?',
            [sessionId, userId, userRole]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        res.json({ success: true, message: 'Session révoquée' });
    } catch (err) {
        console.error('Erreur révocation session:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Demande de réinitialisation du mot de passe (rate limited)
router.post('/forgot-password', resetPasswordLimiter, async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }
    
    try {
        const resetToken = generateToken();
        const resetExpires = Date.now() + TOKEN_EXPIRY.RESET_PASSWORD;
        
        let userFound = false;
        let userName = '';
        
        // Vérifier parents
        const parent = await dbGet(db, 'SELECT * FROM parents WHERE email = ? AND activated = 1', [email]);
        if (parent) {
            await dbRun(db, 'UPDATE parents SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                [resetToken, resetExpires, parent.id]);
            userName = `${parent.prenom} ${parent.nom}`;
            userFound = true;
        }
        
        // Vérifier élèves
        if (!userFound) {
            const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE email = ? AND activated = 1', [email]);
            if (eleve) {
                await dbRun(db, 'UPDATE eleves SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                    [resetToken, resetExpires, eleve.id]);
                userName = `${eleve.prenom} ${eleve.nom}`;
                userFound = true;
            }
        }
        
        // Vérifier professeurs
        if (!userFound) {
            const prof = await dbGet(db, 'SELECT * FROM professeurs WHERE email = ? AND activated = 1', [email]);
            if (prof) {
                await dbRun(db, 'UPDATE professeurs SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                    [resetToken, resetExpires, prof.id]);
                userName = `${prof.prenom} ${prof.nom}`;
                userFound = true;
            }
        }
        
        // Vérifier staff
        if (!userFound) {
            const staff = await dbGet(db, 'SELECT * FROM staff WHERE email = ? AND activated = 1', [email]);
            if (staff) {
                await dbRun(db, 'UPDATE staff SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                    [resetToken, resetExpires, staff.id]);
                userName = `${staff.prenom} ${staff.nom}`;
                userFound = true;
            }
        }
        
        if (!userFound) {
            return res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
        }
        
        const resetLink = `http://${req.headers.host}/reset-password.html?token=${resetToken}`;
        
        try {
            await sendEmail(email, 'resetPassword', userName, resetLink);
            res.json({ message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
        } catch (emailError) {
            console.error('Erreur envoi email:', emailError);
            res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email.' });
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Vérifier le token de réinitialisation (via query param, appelé par reset-password.html)
router.get('/verify-reset-token', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).json({ valid: false, message: 'Token manquant' });
    }
    try {
        const parent = await dbGet(db, 'SELECT id FROM parents WHERE resetToken = ? AND resetExpires > ?',
            [token, Date.now()]);
        if (parent) return res.json({ valid: true, type: 'parent' });

        const eleve = await dbGet(db, 'SELECT id FROM eleves WHERE resetToken = ? AND resetExpires > ?',
            [token, Date.now()]);
        if (eleve) return res.json({ valid: true, type: 'eleve' });

        const prof = await dbGet(db, 'SELECT id FROM professeurs WHERE resetToken = ? AND resetExpires > ?',
            [token, Date.now()]);
        if (prof) return res.json({ valid: true, type: 'professeur' });

        const staff = await dbGet(db, 'SELECT id FROM staff WHERE resetToken = ? AND resetExpires > ?',
            [token, Date.now()]);
        if (staff) return res.json({ valid: true, type: 'staff' });

        res.status(400).json({ valid: false, message: 'Token invalide ou expiré' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Vérifier le token de réinitialisation (via paramètre de route, legacy)
router.get('/check-reset-token/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
        const parent = await dbGet(db, 'SELECT id FROM parents WHERE resetToken = ? AND resetExpires > ?', 
            [token, Date.now()]);
        if (parent) return res.json({ valid: true, type: 'parent' });
        
        const eleve = await dbGet(db, 'SELECT id FROM eleves WHERE resetToken = ? AND resetExpires > ?', 
            [token, Date.now()]);
        if (eleve) return res.json({ valid: true, type: 'eleve' });
        
        const prof = await dbGet(db, 'SELECT id FROM professeurs WHERE resetToken = ? AND resetExpires > ?', 
            [token, Date.now()]);
        if (prof) return res.json({ valid: true, type: 'professeur' });
        
        const staff = await dbGet(db, 'SELECT id FROM staff WHERE resetToken = ? AND resetExpires > ?', 
            [token, Date.now()]);
        if (staff) return res.json({ valid: true, type: 'staff' });
        
        res.status(400).json({ valid: false, message: 'Token invalide ou expiré' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Réinitialiser le mot de passe (avec hashage bcrypt)
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    
    // Validation du mot de passe avec règles de complexité
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
    }
    
    try {
        // Hasher le nouveau mot de passe
        const hashedPassword = await hashPassword(password);
        
        const tables = ['parents', 'eleves', 'professeurs', 'staff'];
        let updated = false;
        
        for (const table of tables) {
            if (!updated) {
                const result = await dbRun(db, 
                    `UPDATE ${table} SET password = ?, resetToken = NULL, resetExpires = NULL WHERE resetToken = ? AND resetExpires > ?`,
                    [hashedPassword, token, Date.now()]
                );
                if (result.changes > 0) updated = true;
            }
        }
        
        if (updated) {
            res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
        } else {
            res.status(400).json({ error: 'Token invalide ou expiré' });
        }
        
    } catch (error) {
        console.error('Erreur reset-password:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Changer le mot de passe (utilisateur connecté, avec hashage bcrypt)
router.put('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    
    // Validation du nouveau mot de passe avec règles de complexité
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
    }
    
    const userId = req.userId;
    const userRole = req.userRole;
    
    // Déterminer la table selon l'ID ou le rôle
    let tableName;
    if (userId === 'admin1' || String(userId).startsWith('staff_')) {
        tableName = 'staff';
    } else if (String(userId).startsWith('parent_')) {
        tableName = 'parents';
    } else if (String(userId).startsWith('eleve_')) {
        tableName = 'eleves';
    } else if (String(userId).startsWith('prof_') || String(userId).startsWith('professeur_')) {
        tableName = 'professeurs';
    } else {
        const roleTableMap = {
            'parent': 'parents',
            'eleve': 'eleves',
            'professeur': 'professeurs',
            'admin': 'staff',
            'directeur': 'staff',
            'secretaire': 'staff',
            'secretariat': 'staff'
        };
        tableName = roleTableMap[userRole];
    }
    if (!tableName) {
        return res.status(400).json({ error: 'Rôle utilisateur invalide' });
    }
    
    try {
        // Récupérer l'utilisateur par ID uniquement
        const userRow = await dbGet(db, `SELECT id, password FROM ${tableName} WHERE id = ?`, [userId]);
        if (!userRow) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        // Vérifier l'ancien mot de passe avec bcrypt
        const isValid = await verifyPassword(currentPassword, userRow.password);
        if (!isValid) {
            return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
        }
        
        // Hasher et sauvegarder le nouveau mot de passe
        const hashedPassword = await hashPassword(newPassword);
        await dbRun(db, `UPDATE ${tableName} SET password = ? WHERE id = ?`, [hashedPassword, userId]);
        
        res.json({ success: true, message: 'Mot de passe changé avec succès' });
    } catch (err) {
        console.error('Erreur change-password:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// ----- RÉGLAGES NOTIFICATIONS -----

router.get('/notifications/settings', requireAuth, async (req, res) => {
    const userId = req.userId;
    const userRole = req.userRole;
    
    // Déterminer la table selon l'ID ou le rôle
    let tableName;
    if (userId === 'admin1' || String(userId).startsWith('staff_')) {
        tableName = 'staff';
    } else if (String(userId).startsWith('parent_')) {
        tableName = 'parents';
    } else if (String(userId).startsWith('eleve_')) {
        tableName = 'eleves';
    } else if (String(userId).startsWith('prof_') || String(userId).startsWith('professeur_')) {
        tableName = 'professeurs';
    } else {
        const roleTableMap = {
            'parent': 'parents',
            'eleve': 'eleves',
            'professeur': 'professeurs',
            'admin': 'staff',
            'directeur': 'staff',
            'secretaire': 'staff',
            'secretariat': 'staff'
        };
        tableName = roleTableMap[userRole];
    }
    if (!tableName) {
        return res.status(400).json({ error: 'Rôle utilisateur invalide' });
    }
    
    try {
        const userRow = await dbGet(db, `SELECT notifEmailMessage FROM ${tableName} WHERE id = ?`, [userId]);
        if (!userRow) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        res.json({ notifEmailMessage: userRow.notifEmailMessage === 1 });
    } catch (err) {
        console.error('Erreur get notif settings:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/notifications/settings', requireAuth, async (req, res) => {
    const { notifEmailMessage } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;
    
    // Déterminer la table selon l'ID ou le rôle
    let tableName;
    if (userId === 'admin1' || String(userId).startsWith('staff_')) {
        tableName = 'staff';
    } else if (String(userId).startsWith('parent_')) {
        tableName = 'parents';
    } else if (String(userId).startsWith('eleve_')) {
        tableName = 'eleves';
    } else if (String(userId).startsWith('prof_') || String(userId).startsWith('professeur_')) {
        tableName = 'professeurs';
    } else {
        const roleTableMap = {
            'parent': 'parents',
            'eleve': 'eleves',
            'professeur': 'professeurs',
            'admin': 'staff',
            'directeur': 'staff',
            'secretaire': 'staff',
            'secretariat': 'staff'
        };
        tableName = roleTableMap[userRole];
    }
    if (!tableName) {
        return res.status(400).json({ error: 'Rôle utilisateur invalide' });
    }
    
    try {
        const value = notifEmailMessage ? 1 : 0;
        await dbRun(db, `UPDATE ${tableName} SET notifEmailMessage = ? WHERE id = ?`, [value, userId]);
        
        res.json({ success: true, message: 'Paramètres de notification mis à jour' });
    } catch (err) {
        console.error('Erreur update notif settings:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
