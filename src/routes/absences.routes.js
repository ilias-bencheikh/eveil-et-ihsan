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

// ==================== GESTION DES APPELS (LOTS D'ABSENCES) ====================

// Créer un appel en masse (avec batchId)
router.post('/appel', (req, res) => {
    const { absences, classe, date, professeurId } = req.body;
    const batchId = generateId();
    
    if (!Array.isArray(absences)) {
        return res.status(400).json({ error: 'Liste d\'absences requise' });
    }
    
    const results = [];
    let processed = 0;
    const total = absences.length;
    
    absences.forEach(absence => {
        const { eleveId, type, motif } = absence;
        const id = generateId();
        
        db.run('INSERT INTO absences (id, eleveId, date, type, motif, batchId, professeurId, classe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, eleveId, date, type, motif || '', batchId, professeurId, classe],
            function(err) {
                processed++;
                if (err) {
                    console.error('Erreur création absence:', err);
                    results.push({ eleveId, success: false, error: err.message });
                } else {
                    results.push({ id, eleveId, success: true });
                }
                if (processed === total) {
                    res.status(201).json({ batchId, results, classe, date });
                }
            }
        );
    });
});

// Obtenir l'historique des appels par classe
router.get('/appel/historique/:nomClasse', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    console.log('Historique appels demandé pour classe:', req.params.nomClasse, 'par user:', userId, 'role:', userRole);

    let query = `
        SELECT 
            batchId,
            classe,
            date,
            professeurId,
            COUNT(*) as nbAbsences,
            SUM(CASE WHEN type = 'absent' THEN 1 ELSE 0 END) as nbAbsents,
            SUM(CASE WHEN type = 'retard' THEN 1 ELSE 0 END) as nbRetards,
            SUM(CASE WHEN type = 'present' THEN 1 ELSE 0 END) as nbPresents,
            MAX(id) as id
        FROM absences 
        WHERE classe = ? AND batchId IS NOT NULL
        GROUP BY batchId, classe, date, professeurId
        ORDER BY date DESC
    `;
    let params = [req.params.nomClasse];

    if (userRole === 'professeur') {
        query = `
            SELECT 
                batchId,
                classe,
                date,
                professeurId,
                COUNT(*) as nbAbsences,
                SUM(CASE WHEN type = 'absent' THEN 1 ELSE 0 END) as nbAbsents,
                SUM(CASE WHEN type = 'retard' THEN 1 ELSE 0 END) as nbRetards,
                SUM(CASE WHEN type = 'present' THEN 1 ELSE 0 END) as nbPresents,
                MAX(id) as id
            FROM absences 
            WHERE classe = ? AND batchId IS NOT NULL AND professeurId = ?
            GROUP BY batchId, classe, date, professeurId
            ORDER BY date DESC
        `;
        params = [req.params.nomClasse, userId];
    }

    console.log('Requête SQL:', query, 'Params:', params);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Erreur SQL historique appels:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log('Résultats historique appels:', rows);
        res.json(rows);
    });
});

// Obtenir les détails d'un appel spécifique
router.get('/appel/:batchId', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = `
        SELECT a.*, e.prenom, e.nom, e.photo
        FROM absences a
        INNER JOIN eleves e ON a.eleveId = e.id
        WHERE a.batchId = ?
        ORDER BY e.nom, e.prenom
    `;
    let params = [req.params.batchId];

    if (userRole === 'professeur') {
        query = `
            SELECT a.*, e.prenom, e.nom, e.photo
            FROM absences a
            INNER JOIN eleves e ON a.eleveId = e.id
            WHERE a.batchId = ? AND a.professeurId = ?
            ORDER BY e.nom, e.prenom
        `;
        params = [req.params.batchId, userId];
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Modifier un appel complet
router.put('/appel/:batchId', (req, res) => {
    const { absences } = req.body;
    const batchId = req.params.batchId;
    
    if (!Array.isArray(absences)) {
        return res.status(400).json({ error: 'Liste d\'absences requise' });
    }
    
    // Supprimer les anciennes absences du lot
    db.run('DELETE FROM absences WHERE batchId = ?', [batchId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Insérer les nouvelles absences
        const results = [];
        let processed = 0;
        const total = absences.length;
        
        absences.forEach(absence => {
            const { eleveId, type, motif, professeurId, classe, date } = absence;
            const id = generateId();
            
            db.run('INSERT INTO absences (id, eleveId, date, type, motif, batchId, professeurId, classe) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [id, eleveId, date, type, motif || '', batchId, professeurId, classe],
                function(err) {
                    processed++;
                    if (err) {
                        console.error('Erreur mise à jour absence:', err);
                        results.push({ eleveId, success: false, error: err.message });
                    } else {
                        results.push({ id, eleveId, success: true });
                    }
                    if (processed === total) {
                        res.json({ batchId, results, message: 'Appel modifié avec succès' });
                    }
                }
            );
        });
    });
});

// Supprimer un appel complet
router.delete('/appel/:batchId', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = 'DELETE FROM absences WHERE batchId = ?';
    let params = [req.params.batchId];

    if (userRole === 'professeur') {
        query += ' AND professeurId = ?';
        params.push(userId);
    }

    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes, batchId: req.params.batchId, message: 'Appel supprimé' });
    });
});

module.exports = router;
