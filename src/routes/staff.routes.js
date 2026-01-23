const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');
const { generateToken, generateId } = require('../utils/helpers');

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
    
    if (userRole === 'directeur' && role === 'directeur') {
        return res.status(403).json({ error: 'Le directeur ne peut pas créer un autre directeur' });
    }
    
    if (!['admin', 'directeur'].includes(userRole)) {
        return res.status(403).json({ error: 'Permission refusée' });
    }
    
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
});

// Mettre à jour un membre du staff
router.put('/:id', requireAdmin, (req, res) => {
    const { nom, prenom, email, role, matiere } = req.body;
    const userRole = req.headers['x-user-role'];
    
    if (userRole === 'directeur' && role === 'directeur') {
        return res.status(403).json({ error: 'Le directeur ne peut pas modifier un directeur' });
    }

    db.run('UPDATE staff SET nom = ?, prenom = ?, email = ?, role = ?, matiere = ? WHERE id = ?',
        [nom, prenom, email || '', role, matiere || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Membre non trouvé' });
            res.json({ id: req.params.id, nom, prenom, email, role, matiere });
        }
    );
});

// Supprimer un membre du staff
router.delete('/:id', requireAdmin, (req, res) => {
    db.run('DELETE FROM staff WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Membre non trouvé' });
        res.json({ message: 'Membre supprimé' });
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
