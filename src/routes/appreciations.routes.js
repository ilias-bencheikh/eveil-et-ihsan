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
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM appreciations', (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.json(rows);
        });
    }
});

// Obtenir une appréciation par ID
router.get('/single/:id', (req, res) => {
    db.get('SELECT * FROM appreciations WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (!row) return res.status(404).json({ message: 'Appréciation non trouvée' });
        res.json(row);
    });
});

// Obtenir les appréciations d'un élève
router.get('/eleve/:eleveId', (req, res) => {
    db.all('SELECT * FROM appreciations WHERE eleveId = ? ORDER BY dateCreated DESC', [req.params.eleveId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// Obtenir les appréciations d'une classe
router.get('/classe/:nomClasse', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = `
        SELECT a.*, e.nom as eleveNom, e.prenom as elevePrenom
        FROM appreciations a
        INNER JOIN eleves e ON a.eleveId = e.id
        WHERE (a.classe = ? OR (a.classe IS NULL AND e.classe = ?))
        ORDER BY a.dateCreated DESC
    `;
    let params = [req.params.nomClasse, req.params.nomClasse];

    if (userRole === 'professeur') {
        query = `
            SELECT a.*, e.nom as eleveNom, e.prenom as elevePrenom
            FROM appreciations a
            INNER JOIN eleves e ON a.eleveId = e.id
            INNER JOIN classes c ON e.classe = c.nom
            WHERE (a.classe = ? OR (a.classe IS NULL AND e.classe = ?)) AND c.professeurId = ?
            ORDER BY a.dateCreated DESC
        `;
        params = [req.params.nomClasse, req.params.nomClasse, userId];
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Erreur SQL classe:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
        res.json(rows);
    });
});

// ==================== NOUVELLES ROUTES POUR L'INTERFACE AMÉLIORÉE ====================

// Obtenir la liste des classes avec le nombre d'élèves
router.get('/classes', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = `
        SELECT c.nom, COUNT(e.id) as nombreEleves
        FROM classes c
        LEFT JOIN eleves e ON e.classe = c.nom
    `;
    let params = [];

    if (userRole === 'professeur') {
        query += ' WHERE c.professeurId = ?';
        params.push(userId);
    }

    query += ' GROUP BY c.nom ORDER BY c.nom';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// Obtenir les élèves d'une classe
router.get('/eleves/classe/:nomClasse', (req, res) => {
    db.all(`
        SELECT id, prenom, nom, classe
        FROM eleves
        WHERE classe = ?
        ORDER BY nom, prenom
    `, [req.params.nomClasse], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// Obtenir l'historique des lots d'appréciations par classe
router.get('/historique/classe/:nomClasse', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = `
        SELECT
            batchId,
            matiere,
            periode,
            COUNT(*) as nbAppreciations,
            AVG(note) as moyenneNotes,
            MAX(dateCreated) as dateCreated
        FROM appreciations a
        WHERE a.classe = ? AND a.batchId IS NOT NULL
    `;
    let params = [req.params.nomClasse];

    if (userRole === 'professeur') {
        query += ' AND a.professeurId = ?';
        params.push(userId);
    }

    query += `
        GROUP BY batchId, matiere, periode
        ORDER BY dateCreated DESC
    `;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// Obtenir les appréciations d'un lot spécifique
router.get('/batch/:batchId', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = `
        SELECT a.*, e.prenom as elevePrenom, e.nom as eleveNom
        FROM appreciations a
        INNER JOIN eleves e ON a.eleveId = e.id
        WHERE a.batchId = ?
    `;
    let params = [req.params.batchId];

    if (userRole === 'professeur') {
        query += ' AND a.professeurId = ?';
        params.push(userId);
    }

    query += ' ORDER BY e.nom, e.prenom';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// Supprimer un lot complet d'appréciations
router.delete('/batch/:batchId', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = 'DELETE FROM appreciations WHERE batchId = ?';
    let params = [req.params.batchId];

    if (userRole === 'professeur') {
        query += ' AND professeurId = ?';
        params.push(userId);
    }

    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json({ deleted: this.changes, batchId: req.params.batchId });
    });
});

// ==================== HISTORIQUE DES LOTS D'APPRÉCIATIONS ====================

// Obtenir l'historique des lots d'appréciations par classe
router.get('/historique/classe/:nomClasse', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    // D'abord, récupérer tous les batchIds pour cette classe
    let baseQuery = `
        SELECT DISTINCT a.batchId, a.matiere, a.periode, a.classe, MIN(a.dateCreated) as dateCreated, COUNT(a.id) as nbAppreciations, AVG(a.note) as moyenneNotes
        FROM appreciations a
        INNER JOIN eleves e ON a.eleveId = e.id
        WHERE (a.classe = ? OR (a.classe IS NULL AND e.classe = ?)) AND a.batchId IS NOT NULL
        GROUP BY a.batchId, a.matiere, a.periode
        ORDER BY MIN(a.dateCreated) DESC
    `;
    let params = [req.params.nomClasse, req.params.nomClasse];

    if (userRole === 'professeur') {
        baseQuery = `
            SELECT DISTINCT a.batchId, a.matiere, a.periode, a.classe, MIN(a.dateCreated) as dateCreated, COUNT(a.id) as nbAppreciations, AVG(a.note) as moyenneNotes
            FROM appreciations a
            INNER JOIN eleves e ON a.eleveId = e.id
            INNER JOIN classes c ON e.classe = c.nom
            WHERE (a.classe = ? OR (a.classe IS NULL AND e.classe = ?)) AND c.professeurId = ? AND a.batchId IS NOT NULL
            GROUP BY a.batchId, a.matiere, a.periode
            ORDER BY MIN(a.dateCreated) DESC
        `;
        params = [req.params.nomClasse, req.params.nomClasse, userId];
    }

    db.all(baseQuery, params, (err, batches) => {
        if (err) {
            console.error('Erreur SQL historique:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }

        // Pour chaque batch, récupérer la liste des élèves
        const results = [];
        let processed = 0;

        if (batches.length === 0) {
            return res.json([]);
        }

        batches.forEach(batch => {
            const elevesQuery = `
                SELECT e.prenom || ' ' || e.nom as nomComplet
                FROM appreciations a
                INNER JOIN eleves e ON a.eleveId = e.id
                WHERE a.batchId = ?
                ORDER BY e.nom, e.prenom
            `;

            db.all(elevesQuery, [batch.batchId], (err, eleves) => {
                processed++;
                if (err) {
                    console.error('Erreur récupération élèves batch:', err);
                } else {
                    batch.eleves = eleves.map(e => e.nomComplet).join(', ');
                    results.push(batch);
                }

                if (processed === batches.length) {
                    res.json(results);
                }
            });
        });
    });
});

// Obtenir les détails d'un lot d'appréciations par batchId
router.get('/batch/:batchId', (req, res) => {
    const query = `
        SELECT a.*, e.nom as eleveNom, e.prenom as elevePrenom
        FROM appreciations a
        INNER JOIN eleves e ON a.eleveId = e.id
        WHERE a.batchId = ?
        ORDER BY e.nom, e.prenom
    `;

    db.all(query, [req.params.batchId], (err, rows) => {
        if (err) {
            console.error('Erreur SQL batch:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
        res.json(rows || []);
    });
});

// Supprimer un lot complet d'appréciations
router.delete('/batch/:batchId', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM appreciations WHERE batchId = ?', [req.params.batchId], function(err) {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (this.changes === 0) return res.status(404).json({ message: 'Lot non trouvé' });
        res.json({ message: 'Lot d\'appréciations supprimé', deleted: this.changes });
    });
});

// Mettre à jour un lot d'appréciations
router.put('/batch/:batchId', (req, res) => {
    const { appreciations } = req.body;
    const batchId = req.params.batchId;
    
    if (!Array.isArray(appreciations) || appreciations.length === 0) {
        return res.status(400).json({ error: 'Liste d\'appréciations requise' });
    }
    
    const results = [];
    let processed = 0;
    const total = appreciations.length;
    
    appreciations.forEach(appreciation => {
        const { id, eleveId, professeurId, matiere, periode, note, commentaire } = appreciation;
        
        if (id) {
            // Mise à jour d'une appréciation existante
            db.run('UPDATE appreciations SET note = ?, commentaire = ?, matiere = ?, periode = ? WHERE id = ? AND batchId = ?',
                [note || null, commentaire, matiere, periode, id, batchId],
                function(err) {
                    processed++;
                    if (err) {
                        console.error('Erreur mise à jour appréciation:', err);
                        results.push({ id, success: false, error: 'Erreur de traitement' });
                    } else {
                        results.push({ id, success: true });
                    }
                    if (processed === total) {
                        res.json({ results });
                    }
                }
            );
        } else {
            processed++;
            results.push({ eleveId, success: false, error: 'ID manquant' });
            if (processed === total) {
                res.json({ results });
            }
        }
    });
});

// ==================== CRÉATION EN MASSE ====================

// Créer plusieurs appréciations en une fois (avec batchId)
router.post('/bulk', (req, res) => {
    const { appreciations } = req.body;
    
    if (!Array.isArray(appreciations) || appreciations.length === 0) {
        return res.status(400).json({ error: 'Liste d\'appréciations requise' });
    }
    
    // Générer un batchId unique pour ce lot
    const batchId = generateId();
    const dateCreated = new Date().toISOString();
    
    const results = [];
    let processed = 0;
    const total = appreciations.length;
    
    appreciations.forEach(appreciation => {
        const { id, eleveId, professeurId, matiere, periode, note, commentaire, createdByRole, classe } = appreciation;
        
        if (id) {
            // Mise à jour d'une appréciation existante (garde le même batchId)
            db.run('UPDATE appreciations SET eleveId = ?, professeurId = ?, matiere = ?, periode = ?, note = ?, commentaire = ?, classe = ? WHERE id = ?',
                [eleveId, professeurId, matiere, periode, note || null, commentaire, classe || null, id],
                function(err) {
                    processed++;
                    if (err) {
                        console.error('Erreur mise à jour appréciation:', err);
                        results.push({ id, success: false, error: 'Erreur de traitement' });
                    } else {
                        results.push({ id, success: true });
                    }
                    if (processed === total) {
                        res.json({ results, batchId });
                    }
                }
            );
        } else {
            // Création d'une nouvelle appréciation avec batchId
            const newId = generateId();
            db.run('INSERT INTO appreciations (id, eleveId, professeurId, matiere, periode, note, commentaire, createdByRole, dateCreated, batchId, classe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newId, eleveId, professeurId, matiere, periode, note || null, commentaire, createdByRole || null, dateCreated, batchId, classe || null],
                function(err) {
                    processed++;
                    if (err) {
                        console.error('Erreur création appréciation:', err);
                        results.push({ eleveId, success: false, error: 'Erreur de traitement' });
                    } else {
                        results.push({ id: newId, eleveId, success: true });
                    }
                    if (processed === total) {
                        res.json({ results, batchId });
                    }
                }
            );
        }
    });
});

// ==================== CRUD BASIQUE ====================

// Créer une appréciation individuelle
router.post('/', (req, res) => {
    const { eleveId, professeurId, matiere, periode, note, commentaire, createdByRole, classe } = req.body;
    const id = generateId();
    const dateCreated = new Date().toISOString();

    db.run('INSERT INTO appreciations (id, eleveId, professeurId, matiere, periode, note, commentaire, createdByRole, dateCreated, classe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, eleveId, professeurId, matiere, periode, note || null, commentaire, createdByRole || null, dateCreated, classe || null],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.status(201).json({ id, eleveId, professeurId, matiere, periode, note, commentaire, dateCreated });
        }
    );
});

// Mettre à jour une appréciation
router.put('/:id', checkPermission('update'), (req, res) => {
    const { eleveId, professeurId, matiere, periode, note, commentaire } = req.body;

    db.run('UPDATE appreciations SET eleveId = ?, professeurId = ?, matiere = ?, periode = ?, note = ?, commentaire = ? WHERE id = ?',
        [eleveId, professeurId, matiere, periode, note || null, commentaire, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            if (this.changes === 0) return res.status(404).json({ message: 'Appréciation non trouvée' });
            res.json({ id: req.params.id, eleveId, professeurId, matiere, periode, note, commentaire });
        }
    );
});

// Supprimer une appréciation
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM appreciations WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (this.changes === 0) return res.status(404).json({ message: 'Appréciation non trouvée' });
        res.json({ message: 'Appréciation supprimée' });
    });
});

module.exports = router;
