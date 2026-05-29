const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission } = require('../middleware/auth');
const { generateId } = require('../utils/helpers');

// Jours valides
const JOURS_VALIDES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function isValidPeriode(periode) {
    if (periode === 'matin' || periode === 'apres-midi') return true;
    // Format horaire HH:MM-HH:MM
    const timeFormat = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
    return timeFormat.test(periode);
}

// Obtenir l'emploi du temps d'une classe
router.get('/classe/:classeId', (req, res) => {
    const { classeId } = req.params;
    
    db.all('SELECT * FROM emplois_du_temps WHERE classeId = ?', [classeId], (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération de l\'emploi du temps:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
        res.json(rows || []);
    });
});

// Obtenir tous les emplois du temps
router.get('/', (req, res) => {
    db.all(`
        SELECT edt.*, c.nom as classeNom 
        FROM emplois_du_temps edt 
        LEFT JOIN classes c ON edt.classeId = c.id
    `, (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des emplois du temps:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
        res.json(rows || []);
    });
});

// Définir/Mettre à jour l'emploi du temps d'une classe
// Reçoit un tableau de créneaux { jour, periode }
router.put('/classe/:classeId', checkPermission('update'), (req, res) => {
    const { classeId } = req.params;
    const { creneaux } = req.body;

    if (!Array.isArray(creneaux)) {
        return res.status(400).json({ error: 'Le champ creneaux doit être un tableau' });
    }

    // Valider les créneaux
    for (const creneau of creneaux) {
        if (!JOURS_VALIDES.includes(creneau.jour)) {
            return res.status(400).json({ error: `Jour invalide: ${creneau.jour}. Jours valides: ${JOURS_VALIDES.join(', ')}` });
        }
        if (!isValidPeriode(creneau.periode)) {
            return res.status(400).json({ error: `Période invalide: ${creneau.periode}. Format attendu: HH:MM-HH:MM (ou matin/apres-midi)` });
        }
    }

    // Vérifier que la classe existe
    db.get('SELECT id FROM classes WHERE id = ?', [classeId], (err, classe) => {
        if (err) {
            console.error('Erreur lors de la vérification de la classe:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
        if (!classe) {
            return res.status(404).json({ error: 'Classe non trouvée' });
        }

        // Supprimer les anciens créneaux
        db.run('DELETE FROM emplois_du_temps WHERE classeId = ?', [classeId], function(deleteErr) {
            if (deleteErr) {
                console.error('Erreur lors de la suppression des anciens créneaux:', deleteErr);
                return res.status(500).json({ error: 'Erreur interne du serveur' });
            }

            // Si pas de créneaux, on a terminé
            if (creneaux.length === 0) {
                return res.json({ message: 'Emploi du temps vidé', creneaux: [] });
            }

            // Insérer les nouveaux créneaux
            const insertPromises = creneaux.map(creneau => {
                return new Promise((resolve, reject) => {
                    const id = generateId();
                    db.run(
                        'INSERT INTO emplois_du_temps (id, classeId, jour, periode) VALUES (?, ?, ?, ?)',
                        [id, classeId, creneau.jour, creneau.periode],
                        function(insertErr) {
                            if (insertErr) {
                                reject(insertErr);
                            } else {
                                resolve({ id, classeId, jour: creneau.jour, periode: creneau.periode });
                            }
                        }
                    );
                });
            });

            Promise.all(insertPromises)
                .then(results => {
                    res.json({ message: 'Emploi du temps mis à jour', creneaux: results });
                })
                .catch(insertErr => {
                    console.error('Erreur lors de l\'insertion des créneaux:', insertErr);
                    res.status(500).json({ error: 'Erreur interne du serveur' });
                });
        });
    });
});

// Ajouter un créneau
router.post('/', checkPermission('create'), (req, res) => {
    const { classeId, jour, periode } = req.body;

    if (!classeId || !jour || !periode) {
        return res.status(400).json({ error: 'Les champs classeId, jour et periode sont requis' });
    }

    if (!JOURS_VALIDES.includes(jour)) {
        return res.status(400).json({ error: `Jour invalide: ${jour}` });
    }

    if (!isValidPeriode(periode)) {
        return res.status(400).json({ error: `Période invalide: ${periode}. Format attendu: HH:MM-HH:MM` });
    }

    const id = generateId();

    db.run(
        'INSERT INTO emplois_du_temps (id, classeId, jour, periode) VALUES (?, ?, ?, ?)',
        [id, classeId, jour, periode],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Ce créneau existe déjà pour cette classe' });
                }
                console.error('Erreur lors de l\'ajout du créneau:', err);
                return res.status(500).json({ error: 'Erreur interne du serveur' });
            }
            res.status(201).json({ id, classeId, jour, periode });
        }
    );
});

// Supprimer un créneau
router.delete('/:id', checkPermission('delete'), (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM emplois_du_temps WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Erreur lors de la suppression du créneau:', err);
            return res.status(500).json({ error: 'Erreur interne du serveur' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Créneau non trouvé' });
        }
        res.json({ message: 'Créneau supprimé' });
    });
});

module.exports = router;
