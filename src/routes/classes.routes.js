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
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM classes', (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.json(rows);
        });
    }
});

// Créer une classe
router.post('/', checkPermission('create'), (req, res) => {
    const { nom, niveau, professeurId, salle } = req.body;
    console.log('Requête POST /classes reçue:', { nom, niveau, professeurId, salle });

    const id = generateId();

    db.run('INSERT INTO classes VALUES (?, ?, ?, ?, ?)',
        [id, nom, niveau, professeurId, salle || null],
        function(err) {
            if (err) {
                console.error('Erreur lors de l\'insertion en base:', err);
                return res.status(500).json({ error: 'Erreur interne du serveur' });
            }
            console.log('Classe créée avec succès:', { id, nom, niveau, professeurId, salle });
            res.status(201).json({ id, nom, niveau, professeurId, salle: salle || null });
        }
    );
});

// Mettre à jour une classe
router.put('/:id', checkPermission('update'), (req, res) => {
    const { nom, niveau, professeurId, salle } = req.body;

    db.run('UPDATE classes SET nom = ?, niveau = ?, professeurId = ?, salle = ? WHERE id = ?',
        [nom, niveau, professeurId, salle || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            if (this.changes === 0) return res.status(404).json({ message: 'Classe non trouvée' });
            res.json({ id: req.params.id, nom, niveau, professeurId, salle: salle || null });
        }
    );
});

// Supprimer une classe
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM classes WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (this.changes === 0) return res.status(404).json({ message: 'Classe non trouvée' });
        res.json({ message: 'Classe supprimée' });
    });
});

// Nouvelle année : vider toutes les classes (retirer les élèves sans supprimer les classes)
// Et supprimer les parents (et leurs données liées) qui n'ont pas réinscrit leurs enfants dans les 2 dernières années
router.post('/nouvelle-annee', checkPermission('update'), async (req, res) => {
    const { anneeScolaire } = req.body;
    if (!anneeScolaire) {
        return res.status(400).json({ error: 'L\'année scolaire est requise' });
    }

    // Extraire l'année de début (ex: "2026-2027" -> 2026)
    const newYearStart = parseInt(anneeScolaire.split('-')[0], 10);
    if (isNaN(newYearStart)) {
        return res.status(400).json({ error: 'Format d\'année scolaire invalide (attendu YYYY-YYYY)' });
    }

    try {
        const thresholdYear = newYearStart - 2;

        // Mettre la classe de tous les élèves à NULL
        await new Promise((resolve, reject) => {
            db.run('UPDATE eleves SET classe = NULL', function(err) {
                if (err) return reject(err);
                resolve(this.changes);
            });
        });

        // Trouver les parents qui n'ont AUCUN enfant avec anneeScolaire >= thresholdYear
        // i.e., pour tous leurs enfants, anneeScolaire est < thresholdYear ou NULL
        const queryParents = `
            SELECT p.id 
            FROM parents p
            WHERE NOT EXISTS (
                SELECT 1 
                FROM eleve_parent ep
                JOIN eleves e ON ep.eleveId = e.id
                WHERE ep.parentId = p.id 
                AND e.anneeScolaire IS NOT NULL
                AND CAST(substr(e.anneeScolaire, 1, 4) AS INTEGER) >= ?
            )
        `;

        const parentsToDelete = await new Promise((resolve, reject) => {
            db.all(queryParents, [thresholdYear], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.id));
            });
        });

        let parentsDeleted = 0;
        let elevesDeleted = 0;

        if (parentsToDelete.length > 0) {
            const placeholders = parentsToDelete.map(() => '?').join(',');

            // Trouver les élèves de ces parents qui n'ont pas d'autres parents gardés
            const queryEleves = `
                SELECT DISTINCT ep.eleveId 
                FROM eleve_parent ep
                WHERE ep.parentId IN (${placeholders})
                AND NOT EXISTS (
                    SELECT 1 
                    FROM eleve_parent ep2 
                    WHERE ep2.eleveId = ep.eleveId 
                    AND ep2.parentId NOT IN (${placeholders})
                )
            `;

            const elevesToDelete = await new Promise((resolve, reject) => {
                db.all(queryEleves, [...parentsToDelete, ...parentsToDelete], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(r => r.eleveId));
                });
            });

            // Supprimer les élèves orphelins (qui vont de toute façon être supprimés logiquement si leurs parents partent)
            if (elevesToDelete.length > 0) {
                const elevesPlaceholders = elevesToDelete.map(() => '?').join(',');
                
                // Nettoyer d'abord les tables qui n'ont pas de ON DELETE CASCADE
                await new Promise((resolve, reject) => {
                    db.run(`DELETE FROM absences WHERE eleveId IN (${elevesPlaceholders})`, elevesToDelete, function(err) {
                        if (err) return reject(err);
                        resolve();
                    });
                });
                
                await new Promise((resolve, reject) => {
                    db.run(`DELETE FROM appreciations WHERE eleveId IN (${elevesPlaceholders})`, elevesToDelete, function(err) {
                        if (err) return reject(err);
                        resolve();
                    });
                });

                await new Promise((resolve, reject) => {
                    db.run(`DELETE FROM eleves WHERE id IN (${elevesPlaceholders})`, elevesToDelete, function(err) {
                        if (err) return reject(err);
                        elevesDeleted = this.changes;
                        resolve();
                    });
                });
            }

            // Supprimer les messages des parents (envoyés ou reçus)
            await new Promise((resolve, reject) => {
                db.run(`DELETE FROM messages WHERE expediteurId IN (${placeholders}) OR destinataireId IN (${placeholders})`, [...parentsToDelete, ...parentsToDelete], function(err) {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // Supprimer les parents
            await new Promise((resolve, reject) => {
                db.run(`DELETE FROM parents WHERE id IN (${placeholders})`, parentsToDelete, function(err) {
                    if (err) return reject(err);
                    parentsDeleted = this.changes;
                    resolve();
                });
            });
        }

        res.json({
            success: true,
            message: `Nouvelle année ${anneeScolaire} initialisée. ${parentsDeleted} parent(s) inactif(s) et ${elevesDeleted} élève(s) ont été supprimés.`,
            elevesModifies: true,
            parentsSupprimes: parentsDeleted,
            elevesSupprimes: elevesDeleted
        });

    } catch (err) {
        console.error("Erreur lors de la nouvelle année:", err);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

module.exports = router;
