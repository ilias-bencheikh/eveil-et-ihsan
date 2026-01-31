const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');

// Récupérer toutes les actualités (publiques, triées par date décroissante)
router.get('/', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userClasse = req.headers['x-user-classe'];
    
    // Filtrer les actualités non expirées (dateFin NULL ou > date actuelle)
    const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    db.all('SELECT * FROM actualites WHERE (dateFin IS NULL OR dateFin > ?) ORDER BY date DESC, createdAt DESC', [currentDate], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Filtrer les actualités selon le rôle et la classe
        let filtered = (rows || []).filter(actu => {
            // Si pas de cible définie ou cible "tous", visible par tous
            if (!actu.cible || actu.cible === 'tous') return true;
            
            try {
                const cibles = JSON.parse(actu.cible);
                
                // Admin/directeur/secrétariat voient tout
                if (['admin', 'directeur', 'secretariat'].includes(userRole)) return true;
                
                // Si cible inclut "professeurs" et user est prof
                if (cibles.includes('professeurs') && userRole === 'professeur') return true;
                
                // Si cible inclut "eleves" et user est élève
                if (cibles.includes('eleves') && userRole === 'eleve') return true;
                
                // Si cible inclut la classe de l'élève
                if (userClasse && cibles.includes(userClasse)) return true;
                
                return false;
            } catch {
                return true; // Si erreur de parsing, afficher
            }
        });
        
        res.json(filtered);
    });
});

// Récupérer une actualité par ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM actualites WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Actualité non trouvée' });
        res.json(row);
    });
});

// Créer une actualité (réservé au bureau/admin)
router.post('/', (req, res) => {
    const { titre, description, date, auteurId, auteurNom, cible, dateFin } = req.body;
    const id = generateId();
    
    // cible peut être: 'tous', ['CP1', 'CP2'], ['professeurs'], ['eleves'], etc.
    const cibleStr = Array.isArray(cible) ? JSON.stringify(cible) : (cible || 'tous');
    
    db.run('INSERT INTO actualites (id, titre, description, date, auteurId, auteurNom, cible, dateFin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, titre, description, date, auteurId || null, auteurNom || 'Système', cibleStr, dateFin || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, titre, description, date, auteurId, auteurNom, cible: cibleStr, dateFin });
        }
    );
});

// Modifier une actualité
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { titre, description, date, dateFin } = req.body;
    
    db.run('UPDATE actualites SET titre = ?, description = ?, date = ?, dateFin = ? WHERE id = ?',
        [titre, description, date, dateFin || null, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Actualité non trouvée' });
            res.json({ message: 'Actualité mise à jour' });
        }
    );
});

// Supprimer une actualité
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM actualites WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Actualité non trouvée' });
        res.json({ message: 'Actualité supprimée' });
    });
});

module.exports = router;
