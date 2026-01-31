const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { generateToken, generateId } = require('../utils/helpers');
const { sendEmail } = require('../config/email');

// Obtenir tout le staff
router.get('/', (req, res) => {
    db.all('SELECT id, nom, prenom, email, role, matiere, activated FROM staff', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtenir un membre du staff
router.get('/:id', (req, res) => {
    db.get('SELECT * FROM staff WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Membre non trouvé' });
        res.json(row);
    });
});

// Créer un membre du staff
router.post('/', (req, res) => {
    const { nom, prenom, email, role, matiere } = req.body;
    const userRole = req.headers['x-user-role'];
    
    console.log('Création staff - Données reçues:', { nom, prenom, email, role, matiere, userRole });
    
    if (userRole === 'directeur' && role === 'directeur') {
        return res.status(403).json({ error: 'Le directeur ne peut pas créer un autre directeur' });
    }
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }
    
    // Vérifier que l'email n'est pas déjà utilisé
    if (email) {
        db.get('SELECT id FROM staff WHERE email = ?', [email], (err, staffRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (staffRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un membre du bureau' });
            
            db.get('SELECT id FROM professeurs WHERE email = ?', [email], (err, professeurRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (professeurRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
                
                db.get('SELECT id FROM eleves WHERE email = ?', [email], (err, eleveRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (eleveRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
                    
                    // Procéder à la création
                    const id = generateId('staff');
                    const activationToken = generateToken();

                    db.run(`INSERT INTO staff (id, nom, prenom, email, role, matiere, password, activationToken, activated, resetToken, resetExpires) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [id, nom, prenom, email || '', role, matiere || null, null, activationToken, 0, null, null],
                        async function(err) {
                            if (err) return res.status(500).json({ error: err.message });
                            const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=staff`;
                            
                            try {
                                if (email) {
                                    await sendEmail(email, 'activation', `${prenom} ${nom}`, activationLink);
                                    res.status(201).json({ 
                                        id, nom, prenom, email, role, matiere,
                                        activationLink,
                                        message: 'Membre du bureau créé. Email d\'activation envoyé avec succès.'
                                    });
                                } else {
                                    res.status(201).json({ 
                                        id, nom, prenom, email, role, matiere,
                                        activationLink,
                                        message: 'Membre du bureau créé. Envoyez le lien d\'activation.'
                                    });
                                }
                            } catch (emailError) {
                                console.error('Erreur envoi email:', emailError);
                                res.status(201).json({ 
                                    id, nom, prenom, email, role, matiere,
                                    activationLink,
                                    message: 'Membre du bureau créé, mais erreur lors de l\'envoi de l\'email d\'activation.'
                                });
                            }
                        }
                    );
                });
            });
        });
    } else {
        // Si pas d'email, procéder directement
        const id = generateId('staff');
        const activationToken = generateToken();

        db.run(`INSERT INTO staff (id, nom, prenom, email, role, matiere, password, activationToken, activated, resetToken, resetExpires) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, nom, prenom, email || '', role, matiere || null, null, activationToken, 0, null, null],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=staff`;
                res.status(201).json({ 
                    id, nom, prenom, email, role, matiere,
                    activationLink,
                    message: 'Membre du bureau créé. Envoyez le lien d\'activation.'
                });
            }
        );
    }
});

// Mettre à jour un membre du staff
router.put('/:id', requireAdmin, (req, res) => {
    const { nom, prenom, email, role, matiere } = req.body;
    const userRole = req.headers['x-user-role'];
    
    if (userRole === 'directeur' && role === 'directeur') {
        return res.status(403).json({ error: 'Le directeur ne peut pas modifier un directeur' });
    }

    // Vérifier que l'email n'est pas déjà utilisé par quelqu'un d'autre
    if (email) {
        db.get('SELECT id FROM staff WHERE email = ? AND id != ?', [email, req.params.id], (err, staffRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (staffRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre membre du bureau' });
            
            db.get('SELECT id FROM professeurs WHERE email = ?', [email], (err, professeurRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (professeurRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
                
                db.get('SELECT id FROM eleves WHERE email = ?', [email], (err, eleveRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (eleveRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
                    
                    // Procéder à la mise à jour
                    db.run('UPDATE staff SET nom = ?, prenom = ?, email = ?, role = ?, matiere = ? WHERE id = ?',
                        [nom, prenom, email || '', role, matiere || null, req.params.id],
                        function(err) {
                            if (err) return res.status(500).json({ error: err.message });
                            if (this.changes === 0) return res.status(404).json({ message: 'Membre non trouvé' });
                            res.json({ id: req.params.id, nom, prenom, email, role, matiere });
                        }
                    );
                });
            });
        });
    } else {
        // Si pas d'email, procéder directement
        db.run('UPDATE staff SET nom = ?, prenom = ?, email = ?, role = ?, matiere = ? WHERE id = ?',
            [nom, prenom, email || '', role, matiere || null, req.params.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ message: 'Membre non trouvé' });
                res.json({ id: req.params.id, nom, prenom, email, role, matiere });
            }
        );
    }
});

// Supprimer un membre du staff
router.delete('/:id', requireAdmin, (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    // Vérifier si l'utilisateur essaie de se supprimer lui-même
    if (userId === req.params.id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer vous-même' });
    }

    // Vérifier si on essaie de supprimer le dernier admin
    db.get('SELECT role FROM staff WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Membre non trouvé' });

        if (row.role === 'admin') {
            db.get('SELECT COUNT(*) as count FROM staff WHERE role = ?', ['admin'], (err, countRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (countRow.count <= 1) {
                    return res.status(400).json({ error: 'Impossible de supprimer le dernier administrateur' });
                }
                // Procéder à la suppression
                db.run('DELETE FROM staff WHERE id = ?', [req.params.id], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    if (this.changes === 0) return res.status(404).json({ error: 'Membre non trouvé' });
                    res.json({ message: 'Membre supprimé avec succès' });
                });
            });
        } else {
            // Procéder à la suppression
            db.run('DELETE FROM staff WHERE id = ?', [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Membre non trouvé' });
                res.json({ message: 'Membre supprimé avec succès' });
            });
        }
    });
});

// Vérifier un token d'activation
router.get('/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM staff WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

// Activer un compte staff
router.post('/activate', (req, res) => {
    const { token, password } = req.body;
    
    db.get('SELECT * FROM staff WHERE activationToken = ? AND activated = 0', [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        db.run('UPDATE staff SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [password, row.id],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ 
                    message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
                    email: row.email
                });
            }
        );
    });
});

module.exports = router;
