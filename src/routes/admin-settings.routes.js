const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

// Obtenir toutes les configurations
router.get('/', requireAdmin, (req, res) => {
    db.all(`SELECT cle, valeur, description FROM config_system`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        
        // Convert array to object key-value
        const config = {};
        rows.forEach(row => {
            config[row.cle] = row.valeur;
        });
        res.json(config);
    });
});

// Mettre à jour une configuration spécifique (ex: emails_actifs)
router.put('/', requireAdmin, (req, res) => {
    const updates = req.body; // { cle: valeur, cle2: valeur2 }
    
    // Début d'une transaction
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare('UPDATE config_system SET valeur = ? WHERE cle = ?');
        
        for (const [cle, valeur] of Object.entries(updates)) {
            // Uniquement pour les clés connues pour l'instant (sécurité)
            if (['emails_actifs', 'preinscriptions_ouvertes', 'annee_scolaire_preinscription'].includes(cle)) {
                stmt.run(String(valeur), cle);
            }
        }
        
        stmt.finalize();
        
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('Erreur MAJ config_system:', err);
                return res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres' });
            }
            res.json({ message: 'Paramètres mis à jour avec succès' });
        });
    });
});

module.exports = router;
