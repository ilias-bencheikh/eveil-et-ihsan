const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission, requireAuth } = require('../middleware/auth');
const { generateId } = require('../utils/helpers');

// ==================== GESTION DES FRAIS D'INSCRIPTION ====================

// Obtenir tous les frais d'inscription (admin/directeur/secrétariat)
router.get('/', requireAuth, checkPermission('read'), async (req, res) => {
    const userRole = req.headers['x-user-role'];
    
    if (!['admin', 'directeur', 'secretariat'].includes(userRole)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }

    try {
        // Récupérer tous les élèves avec leurs frais
        db.all(`
            SELECT 
                e.id, e.nom, e.prenom, e.classe, e.photo,
                e.fraisInscription, e.nbMensualites, e.totalPaye, e.fraisValide,
                e.familleLienId, e.status,
                p1.nom as parent1Nom, p1.prenom as parent1Prenom, p1.telephone as parent1Tel, p1.email as parent1Email,
                p2.nom as parent2Nom, p2.prenom as parent2Prenom, p2.telephone as parent2Tel, p2.email as parent2Email,
                e.parentNom, e.parentPrenom, e.parentTel
            FROM eleves e
            LEFT JOIN parents p1 ON e.parent1Id = p1.id
            LEFT JOIN parents p2 ON e.parent2Id = p2.id
            WHERE e.activated = 1
            ORDER BY e.nom, e.prenom
        `, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            // Calculer les stats
            const stats = {
                totalEleves: rows.length,
                totalFrais: rows.reduce((sum, e) => sum + (e.fraisInscription || 0), 0),
                totalPaye: rows.reduce((sum, e) => sum + (e.totalPaye || 0), 0),
                totalResteAPayer: 0,
                elevesAJour: rows.filter(e => e.fraisValide === 1).length
            };
            stats.totalResteAPayer = stats.totalFrais - stats.totalPaye;
            
            res.json({ eleves: rows, stats });
        });
    } catch (error) {
        console.error('Erreur chargement frais:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Obtenir les frais d'un élève spécifique
router.get('/eleve/:eleveId', requireAuth, (req, res) => {
    const { eleveId } = req.params;
    
    // Récupérer l'élève avec ses parents
    db.get(`
        SELECT 
            e.*,
            p1.nom as parent1Nom, p1.prenom as parent1Prenom, p1.telephone as parent1Tel, p1.email as parent1Email,
            p2.nom as parent2Nom, p2.prenom as parent2Prenom, p2.telephone as parent2Tel, p2.email as parent2Email
        FROM eleves e
        LEFT JOIN parents p1 ON e.parent1Id = p1.id
        LEFT JOIN parents p2 ON e.parent2Id = p2.id
        WHERE e.id = ?
    `, [eleveId], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' });
        
        // Récupérer l'historique des paiements
        db.all(`
            SELECT * FROM paiements_historique 
            WHERE eleveId = ? 
            ORDER BY datePaiement DESC
        `, [eleveId], (err, paiements) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const resteAPayer = (eleve.fraisInscription || 0) - (eleve.totalPaye || 0);
            const mensualiteBase = eleve.nbMensualites > 0 ? eleve.fraisInscription / eleve.nbMensualites : 0;
            
            res.json({
                eleve,
                paiements: paiements || [],
                stats: {
                    fraisTotal: eleve.fraisInscription || 0,
                    totalPaye: eleve.totalPaye || 0,
                    resteAPayer,
                    mensualiteBase,
                    nbMensualites: eleve.nbMensualites || 1,
                    fraisValide: eleve.fraisValide === 1
                }
            });
        });
    });
});

// Enregistrer un nouveau paiement
router.post('/paiement', requireAuth, checkPermission('update'), async (req, res) => {
    const { eleveId, montant, modePaiement, reference, notes, datePaiement } = req.body;
    
    if (!eleveId || !montant || !modePaiement) {
        return res.status(400).json({ error: 'eleveId, montant et modePaiement sont requis' });
    }
    
    const montantFloat = parseFloat(montant);
    if (isNaN(montantFloat) || montantFloat <= 0) {
        return res.status(400).json({ error: 'Le montant doit être un nombre positif' });
    }
    
    const modesValides = ['espece', 'virement', 'cheque'];
    if (!modesValides.includes(modePaiement)) {
        return res.status(400).json({ error: 'Mode de paiement invalide (espece, virement, cheque)' });
    }
    
    try {
        // Vérifier que l'élève existe
        const eleve = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM eleves WHERE id = ?', [eleveId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!eleve) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }
        
        const paiementId = generateId('PAY');
        const dateP = datePaiement || new Date().toISOString().split('T')[0];
        const userId = req.headers['x-user-id'] || 'system';
        
        // Insérer le paiement
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO paiements_historique (id, eleveId, montant, modePaiement, reference, notes, datePaiement, enregistrePar)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [paiementId, eleveId, montantFloat, modePaiement, reference || null, notes || null, dateP, userId], 
            function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Mettre à jour le total payé de l'élève
        const nouveauTotalPaye = (eleve.totalPaye || 0) + montantFloat;
        const fraisValide = nouveauTotalPaye >= (eleve.fraisInscription || 0) ? 1 : 0;
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE eleves SET totalPaye = ?, fraisValide = ? WHERE id = ?
            `, [nouveauTotalPaye, fraisValide, eleveId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.status(201).json({
            success: true,
            message: 'Paiement enregistré avec succès',
            paiement: {
                id: paiementId,
                montant: montantFloat,
                modePaiement,
                datePaiement: dateP
            },
            eleve: {
                totalPaye: nouveauTotalPaye,
                resteAPayer: (eleve.fraisInscription || 0) - nouveauTotalPaye,
                fraisValide
            }
        });
        
    } catch (error) {
        console.error('Erreur enregistrement paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Supprimer un paiement (admin uniquement)
router.delete('/paiement/:paiementId', requireAuth, checkPermission('delete'), async (req, res) => {
    const { paiementId } = req.params;
    const userRole = req.headers['x-user-role'];
    
    if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Seul l\'administrateur peut supprimer un paiement' });
    }
    
    try {
        // Récupérer le paiement pour obtenir le montant et l'eleveId
        const paiement = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM paiements_historique WHERE id = ?', [paiementId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!paiement) {
            return res.status(404).json({ error: 'Paiement non trouvé' });
        }
        
        // Récupérer l'élève
        const eleve = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM eleves WHERE id = ?', [paiement.eleveId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Supprimer le paiement
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM paiements_historique WHERE id = ?', [paiementId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Mettre à jour le total payé de l'élève
        const nouveauTotalPaye = Math.max(0, (eleve.totalPaye || 0) - paiement.montant);
        const fraisValide = nouveauTotalPaye >= (eleve.fraisInscription || 0) ? 1 : 0;
        
        await new Promise((resolve, reject) => {
            db.run('UPDATE eleves SET totalPaye = ?, fraisValide = ? WHERE id = ?', 
                [nouveauTotalPaye, fraisValide, paiement.eleveId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({
            success: true,
            message: 'Paiement supprimé',
            eleve: {
                totalPaye: nouveauTotalPaye,
                fraisValide
            }
        });
        
    } catch (error) {
        console.error('Erreur suppression paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Obtenir l'historique des paiements d'un élève
router.get('/historique/:eleveId', requireAuth, (req, res) => {
    const { eleveId } = req.params;
    
    db.all(`
        SELECT ph.*, s.nom as enregistreParNom, s.prenom as enregistreParPrenom
        FROM paiements_historique ph
        LEFT JOIN staff s ON ph.enregistrePar = s.id
        WHERE ph.eleveId = ?
        ORDER BY ph.datePaiement DESC, ph.createdAt DESC
    `, [eleveId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Mettre à jour les frais d'inscription d'un élève
router.put('/eleve/:eleveId', requireAuth, checkPermission('update'), (req, res) => {
    const { eleveId } = req.params;
    const { fraisInscription, nbMensualites } = req.body;
    
    const frais = parseFloat(fraisInscription || 0);
    const mensualites = parseInt(nbMensualites || 1, 10);
    
    db.get('SELECT totalPaye FROM eleves WHERE id = ?', [eleveId], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' });
        
        const fraisValide = (eleve.totalPaye || 0) >= frais ? 1 : 0;
        
        db.run(`
            UPDATE eleves SET fraisInscription = ?, nbMensualites = ?, fraisValide = ? WHERE id = ?
        `, [frais, mensualites, fraisValide, eleveId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({
                success: true,
                message: 'Frais mis à jour',
                fraisInscription: frais,
                nbMensualites: mensualites,
                fraisValide
            });
        });
    });
});

// Obtenir les statistiques globales des frais
router.get('/stats', requireAuth, checkPermission('read'), (req, res) => {
    const userRole = req.headers['x-user-role'];
    
    if (!['admin', 'directeur', 'secretariat'].includes(userRole)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    db.all(`
        SELECT 
            e.id, e.fraisInscription, e.totalPaye, e.fraisValide, e.classe
        FROM eleves e
        WHERE e.activated = 1
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const stats = {
            totalEleves: rows.length,
            totalFrais: rows.reduce((sum, e) => sum + (e.fraisInscription || 0), 0),
            totalPaye: rows.reduce((sum, e) => sum + (e.totalPaye || 0), 0),
            totalResteAPayer: 0,
            elevesAJour: rows.filter(e => e.fraisValide === 1).length,
            elevesEnRetard: rows.filter(e => e.fraisValide !== 1).length,
            parClasse: {}
        };
        stats.totalResteAPayer = stats.totalFrais - stats.totalPaye;
        stats.tauxRecouvrement = stats.totalFrais > 0 ? 
            Math.round((stats.totalPaye / stats.totalFrais) * 100) : 0;
        
        // Stats par classe
        rows.forEach(e => {
            const classe = e.classe || 'Non assigné';
            if (!stats.parClasse[classe]) {
                stats.parClasse[classe] = {
                    totalEleves: 0,
                    totalFrais: 0,
                    totalPaye: 0,
                    elevesAJour: 0
                };
            }
            stats.parClasse[classe].totalEleves++;
            stats.parClasse[classe].totalFrais += (e.fraisInscription || 0);
            stats.parClasse[classe].totalPaye += (e.totalPaye || 0);
            if (e.fraisValide === 1) stats.parClasse[classe].elevesAJour++;
        });
        
        res.json(stats);
    });
});

// Obtenir les statistiques par mode de paiement
router.get('/stats/modes', requireAuth, checkPermission('read'), (req, res) => {
    const userRole = req.headers['x-user-role'];
    
    if (!['admin', 'directeur', 'secretariat'].includes(userRole)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
    }
    
    db.all(`
        SELECT modePaiement, SUM(montant) as total, COUNT(*) as nombre
        FROM paiements_historique
        GROUP BY modePaiement
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

module.exports = router;
