const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { generateToken, generateId } = require('../utils/helpers');

// Obtenir tous les professeurs
router.get('/', (req, res) => {
    db.all('SELECT * FROM professeurs', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Créer un professeur
router.post('/', checkPermission('create'), (req, res) => {
    const { nom, prenom, email, matiere } = req.body;
    
    // Vérifier que l'email n'est pas déjà utilisé
    if (email) {
        db.get('SELECT id FROM professeurs WHERE email = ?', [email], (err, professeurRow) => {
            if (err) return res.status(500).json({ error: err.message });
            if (professeurRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
            
            db.get('SELECT id FROM eleves WHERE email = ?', [email], (err, eleveRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (eleveRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
                
                // Procéder à la création
                const id = generateId();
                const activationToken = generateToken();

                db.run('INSERT INTO professeurs VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, nom, prenom, email || '', matiere, null, activationToken, 0],
                    function(err) {
                        if (err) return res.status(500).json({ error: err.message });
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
                if (err) return res.status(500).json({ error: err.message });
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
            if (err) return res.status(500).json({ error: err.message });
            if (professeurRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre professeur' });
            
            db.get('SELECT id FROM eleves WHERE email = ?', [email], (err, eleveRow) => {
                if (err) return res.status(500).json({ error: err.message });
                if (eleveRow) return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
                
                // Procéder à la mise à jour
                db.run('UPDATE professeurs SET nom = ?, prenom = ?, email = ?, matiere = ? WHERE id = ?',
                    [nom, prenom, email || '', matiere, req.params.id],
                    function(err) {
                        if (err) return res.status(500).json({ error: err.message });
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
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
                res.json({ id: req.params.id, nom, prenom, email, matiere });
            }
        );
    }
});

// Supprimer un professeur
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM professeurs WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Professeur non trouvé' });
        res.json({ message: 'Professeur supprimé' });
    });
});

// Activer un compte professeur
router.post('/activate', (req, res) => {
    const { token, password } = req.body;
    
    db.get('SELECT * FROM professeurs WHERE activationToken = ? AND activated = 0', [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        db.run('UPDATE professeurs SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
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

// Vérifier un token d'activation
router.get('/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM professeurs WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

module.exports = router;
