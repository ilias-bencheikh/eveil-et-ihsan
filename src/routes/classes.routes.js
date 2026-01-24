const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { generateId } = require('../utils/helpers');

// Obtenir toutes les classes
router.get('/', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all('SELECT * FROM classes WHERE professeurId = ?', [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM classes', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Créer une classe
router.post('/', checkPermission('create'), (req, res) => {
    const { nom, niveau, professeurId } = req.body;
    console.log('Requête POST /classes reçue:', { nom, niveau, professeurId });
    
    const id = generateId();

    db.run('INSERT INTO classes VALUES (?, ?, ?, ?)',
        [id, nom, niveau, professeurId],
        function(err) {
            if (err) {
                console.error('Erreur lors de l\'insertion en base:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Classe créée avec succès:', { id, nom, niveau, professeurId });
            res.status(201).json({ id, nom, niveau, professeurId });
        }
    );
});

// Mettre à jour une classe
router.put('/:id', checkPermission('update'), (req, res) => {
    const { nom, niveau, professeurId } = req.body;

    db.run('UPDATE classes SET nom = ?, niveau = ?, professeurId = ? WHERE id = ?',
        [nom, niveau, professeurId, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Classe non trouvée' });
            res.json({ id: req.params.id, nom, niveau, professeurId });
        }
    );
});

// Supprimer une classe
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM classes WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Classe non trouvée' });
        res.json({ message: 'Classe supprimée' });
    });
});

module.exports = router;
