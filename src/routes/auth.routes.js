const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { TOKEN_EXPIRY } = require('../config/constants');
const { sendEmail } = require('../config/email');
const { generateToken, dbGet, dbRun } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Vérifier dans la table STAFF
    db.get('SELECT * FROM staff WHERE email = ? AND password = ? AND activated = 1', 
        [email, password], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (row) {
                return res.json({ 
                    user: {
                        id: row.id,
                        email: row.email,
                        role: row.role,
                        nom: row.nom,
                        prenom: row.prenom
                    }, 
                    token: generateToken() 
                });
            }

            // Vérifier dans la table ÉLÈVES
            db.get('SELECT * FROM eleves WHERE email = ? AND password = ? AND activated = 1', 
                [email, password], 
                (err, row) => {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    if (row) {
                        return res.json({ 
                            user: {
                                id: row.id,
                                email: row.email,
                                role: 'eleve',
                                nom: row.nom,
                                prenom: row.prenom
                            }, 
                            token: generateToken() 
                        });
                    }

                    // Vérifier dans la table PROFESSEURS
                    db.get('SELECT * FROM professeurs WHERE email = ? AND password = ? AND activated = 1', 
                        [email, password], 
                        (err, row) => {
                            if (err) return res.status(500).json({ error: err.message });
                            
                            if (row) {
                                return res.json({ 
                                    user: {
                                        id: row.id,
                                        email: row.email,
                                        role: 'professeur',
                                        nom: row.nom,
                                        prenom: row.prenom
                                    }, 
                                    token: generateToken() 
                                });
                            } else {
                                return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
                            }
                        }
                    );
                }
            );
        }
    );
});

// Demande de réinitialisation du mot de passe
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email requis' });
    }
    
    try {
        const resetToken = generateToken();
        const resetExpires = Date.now() + TOKEN_EXPIRY.RESET_PASSWORD;
        
        let userFound = false;
        let userName = '';
        
        // Vérifier élèves
        const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE email = ? AND activated = 1', [email]);
        if (eleve) {
            await dbRun(db, 'UPDATE eleves SET resetToken = ?, resetExpires = ? WHERE id = ?', 
                [resetToken, resetExpires, eleve.id]);
            // Utiliser le nom du parent si disponible
            if (eleve.parentNom) {
                userName = eleve.parentPrenom ? `${eleve.parentPrenom} ${eleve.parentNom}` : eleve.parentNom;
            } else {
                userName = `${eleve.prenom} ${eleve.nom}`;
            }
            userFound = true;
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

// Vérifier le token de réinitialisation
router.get('/check-reset-token/:token', async (req, res) => {
    const { token } = req.params;
    
    try {
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

// Réinitialiser le mot de passe
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    try {
        const tables = ['eleves', 'professeurs', 'staff'];
        let updated = false;
        
        for (const table of tables) {
            if (!updated) {
                const result = await dbRun(db, 
                    `UPDATE ${table} SET password = ?, resetToken = NULL, resetExpires = NULL WHERE resetToken = ? AND resetExpires > ?`,
                    [password, token, Date.now()]
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
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Changer le mot de passe (utilisateur connecté)
router.put('/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }
    
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }
    
    const userId = req.userId;
    const userRole = req.userRole;
    
    // Déterminer la table selon le rôle
    let tableName;
    if (userRole === 'eleve') tableName = 'eleves';
    else if (userRole === 'professeur') tableName = 'professeurs';
    else if (userRole === 'staff') tableName = 'staff';
    else return res.status(400).json({ error: 'Rôle utilisateur invalide' });
    
    // Vérifier l'ancien mot de passe
    db.get(`SELECT * FROM ${tableName} WHERE id = ? AND password = ?`, 
        [userId, currentPassword], 
        (err, userRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!userRow) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
            
            // Mettre à jour avec le nouveau mot de passe
            db.run(`UPDATE ${tableName} SET password = ? WHERE id = ?`, 
                [newPassword, userId], 
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    if (this.changes === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
                    
                    res.json({ success: true, message: 'Mot de passe changé avec succès' });
                }
            );
        }
    );
});

module.exports = router;
