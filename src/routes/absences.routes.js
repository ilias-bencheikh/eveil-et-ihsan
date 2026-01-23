const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { generateId } = require('../utils/helpers');

// Obtenir toutes les absences
router.get('/', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all(`
            SELECT DISTINCT a.* FROM absences a
            INNER JOIN eleves e ON a.eleveId = e.id
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM absences', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Obtenir les absences d'un élève
router.get('/eleve/:eleveId', (req, res) => {
    db.all('SELECT * FROM absences WHERE eleveId = ?', [req.params.eleveId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Créer une absence
router.post('/', (req, res) => {
    const { eleveId, date, type, motif } = req.body;
    const id = generateId();

    db.run('INSERT INTO absences VALUES (?, ?, ?, ?, ?)',
        [id, eleveId, date, type, motif],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, eleveId, date, type, motif });
        }
    );
});

// Mettre à jour une absence
router.put('/:id', checkPermission('update'), (req, res) => {
    const { eleveId, date, type, motif } = req.body;

    db.run('UPDATE absences SET eleveId = ?, date = ?, type = ?, motif = ? WHERE id = ?',
        [eleveId, date, type, motif, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Absence non trouvée' });
            res.json({ id: req.params.id, eleveId, date, type, motif });
        }
    );
});

// Supprimer une absence
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM absences WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Absence non trouvée' });
        res.json({ message: 'Absence supprimée' });
    });
});

module.exports = router;
