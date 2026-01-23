const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { generateId } = require('../utils/helpers');

// Obtenir toutes les appréciations
router.get('/', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all(`
            SELECT DISTINCT a.* FROM appreciations a
            INNER JOIN eleves e ON a.eleveId = e.id
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM appreciations', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Obtenir les appréciations d'un élève
router.get('/eleve/:eleveId', (req, res) => {
    db.all('SELECT * FROM appreciations WHERE eleveId = ?', [req.params.eleveId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Créer une appréciation
router.post('/', (req, res) => {
    const { eleveId, professeurId, matiere, periode, note, commentaire, createdByRole } = req.body;
    const id = generateId();

    db.run('INSERT INTO appreciations VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, eleveId, professeurId, matiere, periode, note || null, commentaire, createdByRole || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, eleveId, professeurId, matiere, periode, note, commentaire, createdByRole });
        }
    );
});

// Mettre à jour une appréciation
router.put('/:id', checkPermission('update'), (req, res) => {
    const { eleveId, professeurId, matiere, periode, note, commentaire } = req.body;

    db.run('UPDATE appreciations SET eleveId = ?, professeurId = ?, matiere = ?, periode = ?, note = ?, commentaire = ? WHERE id = ?',
        [eleveId, professeurId, matiere, periode, note || null, commentaire, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Appréciation non trouvée' });
            res.json({ id: req.params.id, eleveId, professeurId, matiere, periode, note, commentaire });
        }
    );
});

// Supprimer une appréciation
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM appreciations WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Appréciation non trouvée' });
        res.json({ message: 'Appréciation supprimée' });
    });
});

module.exports = router;
