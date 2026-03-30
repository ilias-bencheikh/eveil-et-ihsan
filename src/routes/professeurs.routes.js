const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { generateToken, generateId } = require('../utils/helpers');

// Obtenir tous les professeurs
router.get('/', (req, res) => {
    db.all('SELECT * FROM professeurs', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// Créer un professeur
router.post('/', checkPermission('create'), (req, res) => {
    const { nom, prenom, email, matiere } = req.body;
    
    // Vérifier que l'email n'est pas déjà utilisé
    if (email) {
        db.get('SELECT id FROM professeurs WHERE email = ?', [email], (err, professeurRow) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            if (professeurRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
            
            db.get('SELECT id FROM eleves WHERE email = ?', [email], (err, eleveRow) => {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                if (eleveRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
                
                // Procéder à la création
                const id = generateId();
                const activationToken = generateToken();

                db.run('INSERT INTO professeurs VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, nom, prenom, email || '', matiere, null, activationToken, 0],
                    function(err) {
                        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                        const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=professeur`;
                        res.status(201).json({ 
                            id, nom, prenom, email, matiere,
                            activationLink,
                            message: 'Professeur créé. Envoyez le lien d\'activation au professeur.'
                        });
                    }
                );
            });
        });
    } else {
        // Si pas d'email, procéder directement
        const id = generateId();
        const activationToken = generateToken();

        db.run('INSERT INTO professeurs VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, nom, prenom, email || '', matiere, null, activationToken, 0],
            function(err) {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}&type=professeur`;
                res.status(201).json({ 
                    id, nom, prenom, email, matiere,
                    activationLink,
                    message: 'Professeur créé. Envoyez le lien d\'activation au professeur.'
                });
            }
        );
    }
});

// Mettre à jour un professeur
router.put('/:id', checkPermission('update'), (req, res) => {
    const { nom, prenom, email, matiere } = req.body;

    // Vérifier que l'email n'est pas déjà utilisé par quelqu'un d'autre
    if (email) {
        db.get('SELECT id FROM professeurs WHERE email = ? AND id != ?', [email, req.params.id], (err, professeurRow) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            if (professeurRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre professeur' });
            
            db.get('SELECT id FROM eleves WHERE email = ?', [email], (err, eleveRow) => {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                if (eleveRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
                
                // Procéder à la mise à jour
                db.run('UPDATE professeurs SET nom = ?, prenom = ?, email = ?, matiere = ? WHERE id = ?',
                    [nom, prenom, email || '', matiere, req.params.id],
                    function(err) {
                        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                        if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
                        res.json({ id: req.params.id, nom, prenom, email, matiere });
                    }
                );
            });
        });
    } else {
        // Si pas d'email, procéder directement
        db.run('UPDATE professeurs SET nom = ?, prenom = ?, email = ?, matiere = ? WHERE id = ?',
            [nom, prenom, email || '', matiere, req.params.id],
            function(err) {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
                res.json({ id: req.params.id, nom, prenom, email, matiere });
            }
        );
    }
});

// Supprimer un professeur
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM professeurs WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
        res.json({ message: 'Professeur supprimé' });
    });
});

// Activer un compte professeur (avec hashage bcrypt et rate limiting)
const { hashPassword } = require('../utils/password');
const { validatePassword, activationLimiter } = require('../middleware/security');

router.post('/activate', activationLimiter, async (req, res) => {
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
        const row = await dbGet(db, 'SELECT * FROM professeurs WHERE activationToken = ? AND activated = 0', [token]);
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        // Hasher le mot de passe avec bcrypt
        const hashedPassword = await hashPassword(password);
        
        await dbRun(db, 'UPDATE professeurs SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [hashedPassword, row.id]);
        
        res.json({ 
            message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
            email: row.email
        });
    } catch (err) {
        console.error('Erreur activation professeur:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Vérifier un token d'activation
router.get('/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM professeurs WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

module.exports = router;
