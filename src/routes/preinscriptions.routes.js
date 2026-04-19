const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

function isParent(req, res, next) {
    if (req.userRole === 'parent') {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
}
const xss = require('xss-filters');

// ==========================================
// ROUTES PUBLIQUES (NON AUTHENTIFIÉES)
// ==========================================

// Obtenir le statut des préinscriptions (ouvert/fermé + année scolaire)
router.get('/status', (req, res) => {
    db.all(`SELECT cle, valeur FROM config_system WHERE cle IN ('preinscriptions_ouvertes', 'annee_scolaire_preinscription')`, (err, rows) => {
        if (err) {
            console.error('Erreur status préinscription:', err);
            return res.status(500).json({ success: false, message: 'Erreur serveur' });
        }
        
        const config = {};
        rows.forEach(row => {
            config[row.cle] = row.valeur;
        });
        
        res.json({
            success: true,
            ouvert: config.preinscriptions_ouvertes === '1',
            anneeScolaire: config.annee_scolaire_preinscription
        });
    });
});

// Soumettre une nouvelle demande de préinscription (nouveaux parents)
router.post('/public', (req, res) => {
    // Vérifier si les préinscriptions sont ouvertes
    db.get(`SELECT valeur FROM config_system WHERE cle = 'preinscriptions_ouvertes'`, (err, row) => {
        if (err || !row) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        if (row.valeur !== '1') {
            return res.status(403).json({ success: false, message: 'Les préinscriptions sont actuellement fermées.' });
        }

        const { parentInfo, enfantsInfo } = req.body;

        if (!parentInfo || !enfantsInfo || !Array.isArray(enfantsInfo) || enfantsInfo.length === 0) {
            return res.status(400).json({ success: false, message: 'Informations incomplètes' });
        }

        // Nettoyage XSS
        const safeParent = {
            nom: xss.inHTMLData(parentInfo.nom),
            prenom: xss.inHTMLData(parentInfo.prenom),
            email: xss.inHTMLData(parentInfo.email),
            tel: xss.inHTMLData(parentInfo.tel),
            adresse: xss.inHTMLData(parentInfo.adresse),
            profession: xss.inHTMLData(parentInfo.profession || '')
        };

        if (parentInfo.nom2 && parentInfo.prenom2) {
            safeParent.nom2 = xss.inHTMLData(parentInfo.nom2);
            safeParent.prenom2 = xss.inHTMLData(parentInfo.prenom2);
            safeParent.email2 = xss.inHTMLData(parentInfo.email2 || '');
            safeParent.tel2 = xss.inHTMLData(parentInfo.tel2 || '');
            safeParent.profession2 = xss.inHTMLData(parentInfo.profession2 || '');
        }

        const safeEnfants = enfantsInfo.map(e => ({
            nom: xss.inHTMLData(e.nom),
            prenom: xss.inHTMLData(e.prenom),
            dateNaissance: xss.inHTMLData(e.dateNaissance),
            niveauCible: e.niveauCible ? xss.inHTMLData(e.niveauCible) : 'Non spécifié'
        }));

        db.get(`SELECT valeur FROM config_system WHERE cle = 'annee_scolaire_preinscription'`, (err, configAnnee) => {
            const anneeScolaire = configAnnee ? configAnnee.valeur : 'Non définie';
            const id = 'pre_' + Date.now() + Math.random().toString(36).substr(2, 5);

            db.run(`INSERT INTO preinscriptions (id, type, parentInfo, enfantsInfo, anneeScolaire) VALUES (?, ?, ?, ?, ?)`,
                [id, 'nouveau', JSON.stringify(safeParent), JSON.stringify(safeEnfants), anneeScolaire],
                (err) => {
                    if (err) {
                        console.error('Erreur insertion préinscription:', err);
                        return res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement' });
                    }
                    res.json({ success: true, message: 'Votre demande a bien été enregistrée. Nous vous contacterons prochainement.' });
                }
            );
        });
    });
});


// ==========================================
// ROUTES PARENTS (AUTHENTIFIÉS)
// ==========================================

// Soumettre une demande de (ré)inscription depuis l'espace parent
router.post('/parent', requireAuth, isParent, (req, res) => {
    db.get(`SELECT valeur FROM config_system WHERE cle = 'preinscriptions_ouvertes'`, (err, row) => {
        if (err || !row) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        if (row.valeur !== '1') {
            return res.status(403).json({ success: false, message: 'Les préinscriptions sont actuellement fermées.' });
        }

        const { type, enfantsInfo, parent2Info } = req.body; // type: 'reinscription', 'nouveau', 'mixte'
        const parentId = req.userId;

        // Récupérer les infos du parent depuis la DB pour lier au dossier
        db.get('SELECT nom, prenom, email, tel, adresse FROM parents WHERE id = ?', [parentId], (err, parentData) => {
            if (err || !parentData) return res.status(404).json({ success: false, message: 'Parent introuvable' });

            if (parent2Info && parent2Info.nom && parent2Info.prenom) {
                parentData.nom2 = xss.inHTMLData(parent2Info.nom);
                parentData.prenom2 = xss.inHTMLData(parent2Info.prenom);
                parentData.email2 = xss.inHTMLData(parent2Info.email || '');
                parentData.tel2 = xss.inHTMLData(parent2Info.tel || '');
                parentData.profession2 = xss.inHTMLData(parent2Info.profession || '');
            }

            db.get(`SELECT valeur FROM config_system WHERE cle = 'annee_scolaire_preinscription'`, (err, configAnnee) => {
                const anneeScolaire = configAnnee ? configAnnee.valeur : 'Non définie';
                const id = 'pre_' + Date.now() + Math.random().toString(36).substr(2, 5);

                const safeEnfants = enfantsInfo.map(e => ({
                    eleveId: e.eleveId ? xss.inHTMLData(e.eleveId) : null, // Si réinscription
                    nom: xss.inHTMLData(e.nom),
                    prenom: xss.inHTMLData(e.prenom),
                    dateNaissance: xss.inHTMLData(e.dateNaissance),
                    niveauCible: e.niveauCible ? xss.inHTMLData(e.niveauCible) : 'Non spécifié'
                }));

                db.run(`INSERT INTO preinscriptions (id, parentId, type, parentInfo, enfantsInfo, anneeScolaire) VALUES (?, ?, ?, ?, ?, ?)`,
                    [id, parentId, type || 'reinscription', JSON.stringify(parentData), JSON.stringify(safeEnfants), anneeScolaire],
                    (err) => {
                        if (err) {
                            console.error('Erreur insertion préinscription parent:', err);
                            return res.status(500).json({ success: false, message: 'Erreur lors de l\'enregistrement' });
                        }
                        res.json({ success: true, message: 'Votre demande a bien été enregistrée.' });
                    }
                );
            });
        });
    });
});

// Récupérer les demandes du parent connecté
router.get('/mes-demandes', requireAuth, isParent, (req, res) => {
    const parentId = req.userId;
    db.all(`SELECT * FROM preinscriptions WHERE parentId = ? ORDER BY dateSoumission DESC`, [parentId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        
        // Parse JSON fields
        const demandes = rows.map(r => ({
            ...r,
            parentInfo: JSON.parse(r.parentInfo),
            enfantsInfo: JSON.parse(r.enfantsInfo)
        }));
        
        res.json({ success: true, demandes });
    });
});

// ==========================================
// ROUTES ADMINISTRATION
// ==========================================

// Mettre à jour la configuration des préinscriptions
router.post('/config', requireAuth, requireAdmin, (req, res) => {
    const { ouvert, anneeScolaire } = req.body;
    
    db.serialize(() => {
        if (ouvert !== undefined) {
            db.run(`UPDATE config_system SET valeur = ? WHERE cle = 'preinscriptions_ouvertes'`, [ouvert ? '1' : '0']);
        }
        if (anneeScolaire !== undefined) {
            db.run(`UPDATE config_system SET valeur = ? WHERE cle = 'annee_scolaire_preinscription'`, [xss.inHTMLData(anneeScolaire)]);
        }
        res.json({ success: true, message: 'Configuration mise à jour' });
    });
});

// Récupérer toutes les demandes (avec filtres optionnels)
router.get('/', requireAuth, requireAdmin, (req, res) => {
    const { statut, type, search } = req.query;
    let query = `SELECT * FROM preinscriptions WHERE 1=1`;
    const params = [];

    if (statut) {
        query += ` AND statut = ?`;
        params.push(statut);
    }
    if (type) {
        query += ` AND type = ?`;
        params.push(type);
    }
    if (search) {
        query += ` AND (parentInfo LIKE ? OR enfantsInfo LIKE ?)`;
        params.push('%' + search + '%', '%' + search + '%');
    }

    query += ` ORDER BY dateSoumission DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Erreur serveur' });
        
        const demandes = rows.map(r => ({
            ...r,
            parentInfo: JSON.parse(r.parentInfo),
            enfantsInfo: JSON.parse(r.enfantsInfo)
        }));
        
        res.json({ success: true, demandes });
    });
});

// Mettre à jour le statut d'une demande
router.put('/:id/status', requireAuth, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { statut, notesAdmin, enfantsInfo } = req.body;

    if (!['en_attente', 'confirmee', 'rejetee'].includes(statut)) {
        return res.status(400).json({ success: false, message: 'Statut invalide' });
    }

    let query = `UPDATE preinscriptions SET statut = ?, notesAdmin = ?`;
    let params = [statut, xss.inHTMLData(notesAdmin || '')];

    if (enfantsInfo) {
        const safeEnfantsInfo = enfantsInfo.map(e => ({
            ...e,
            nom: xss.inHTMLData(e.nom),
            prenom: xss.inHTMLData(e.prenom),
            dateNaissance: xss.inHTMLData(e.dateNaissance),
            niveauCible: xss.inHTMLData(e.niveauCible),
            statut: xss.inHTMLData(e.statut || 'en_attente'),
            classeAssigne: e.classeAssigne ? xss.inHTMLData(e.classeAssigne) : null,
            eleveId: e.eleveId ? xss.inHTMLData(e.eleveId) : null
        }));
        query += `, enfantsInfo = ?`;
        params.push(JSON.stringify(safeEnfantsInfo));
    }

    query += ` WHERE id = ?`;
    params.push(id);

    db.run(query, params, function(err) {
            if (err) return res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour' });
            if (this.changes === 0) return res.status(404).json({ success: false, message: 'Demande non trouvée' });
            res.json({ success: true, message: 'Statut mis à jour avec succès' });
        }
    );
});

// Supprimer une demande
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
    db.run(`DELETE FROM preinscriptions WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
        if (this.changes === 0) return res.status(404).json({ success: false, message: 'Demande non trouvée' });
        res.json({ success: true, message: 'Demande supprimée' });
    });
});

module.exports = router;