const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission, requireAuth } = require('../middleware/auth');
const { generateToken, generateId } = require('../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration multer pour l'upload de photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'));
        }
    }
});

// Middleware pour gérer les uploads avec ou sans fichier
const uploadMiddleware = (req, res, next) => {
    // Utiliser multer seulement si c'est une requête multipart/form-data
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        upload.single('photo')(req, res, (err) => {
            if (err) {
                console.error('Erreur multer:', err);
                return res.status(400).json({ error: 'Erreur lors du traitement du fichier' });
            }
            next();
        });
    } else {
        next();
    }
};

// Obtenir tous les élèves
router.get('/', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'professeur') {
        db.all(`
            SELECT DISTINCT e.* FROM eleves e
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        db.all('SELECT * FROM eleves', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

// Obtenir les élèves d'une classe spécifique
router.get('/classe/:nomClasse', (req, res) => {
    const { nomClasse } = req.params;
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let query = 'SELECT * FROM eleves WHERE classe = ?';
    let params = [nomClasse];

    if (userRole === 'professeur') {
        query = `
            SELECT e.* FROM eleves e
            INNER JOIN classes c ON e.classe = c.nom
            WHERE e.classe = ? AND c.professeurId = ?
        `;
        params = [nomClasse, userId];
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ================== PROFIL ÉLÈVE ==================

// Obtenir le profil de l'élève connecté
router.get('/profil', requireAuth, (req, res) => {
    if (req.userRole !== 'eleve') {
        return res.status(403).json({ message: 'Accès réservé aux élèves' });
    }

    db.get('SELECT id, nom, prenom, email, photo, parentTel, fraisInscription, nbPaiements, fraisValide, paiementsEffectues FROM eleves WHERE id = ?', [String(req.userId)], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Élève non trouvé' });
        res.json(row);
    });
});

// Mettre à jour le profil de l'élève connecté
router.put('/profil', requireAuth, uploadMiddleware, (req, res) => {
    try {
        if (req.userRole !== 'eleve') {
            return res.status(403).json({ message: 'Accès réservé aux élèves' });
        }

        console.log('PUT /profil - req.body:', req.body);
        console.log('PUT /profil - req.file:', req.file);

        const { email, parentTel, deletePhoto } = req.body;
        // deletePhoto peut être un array ou une string selon comment c'est envoyé
        const deletePhotoValue = Array.isArray(deletePhoto) ? deletePhoto[0] : deletePhoto;
        const photo = req.file ? `/uploads/${req.file.filename}` : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    if (parentTel && !/^[0-9+\-\s()]{10,}$/.test(parentTel)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    // Gestion de la suppression de photo
    if (deletePhotoValue === 'true') {
        // Récupérer l'ancienne photo pour la supprimer du système de fichiers
        db.get('SELECT photo FROM eleves WHERE id = ?', [req.userId], (err, row) => {
            if (err) {
                console.error('Erreur récupération photo pour suppression:', err);
            } else if (row && row.photo) {
                // Supprimer l'image du système de fichiers
                const photoPath = path.join(__dirname, '../../public', row.photo);
                fs.access(photoPath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        // Le fichier existe, on peut le supprimer
                        fs.unlink(photoPath, (err) => {
                            if (err) {
                                console.error('Erreur suppression photo:', err);
                            } else {
                                console.log('Photo supprimée:', photoPath);
                            }
                        });
                    }
                });
            }
        });
    }

    // Si une nouvelle photo est uploadée, supprimer l'ancienne (sauf si on est en train de supprimer)
    if (photo && deletePhotoValue !== 'true') {
        // Récupérer l'ancienne photo
        db.get('SELECT photo FROM eleves WHERE id = ?', [req.userId], (err, row) => {
            if (err) {
                console.error('Erreur récupération ancienne photo:', err);
            } else if (row && row.photo) {
                // Supprimer l'ancienne image du système de fichiers
                const oldPhotoPath = path.join(__dirname, '../../public', row.photo);
                fs.access(oldPhotoPath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        // Le fichier existe, on peut le supprimer
                        fs.unlink(oldPhotoPath, (err) => {
                            if (err) {
                                console.error('Erreur suppression ancienne photo:', err);
                            } else {
                                console.log('Ancienne photo supprimée:', oldPhotoPath);
                            }
                        });
                    }
                });
            }
        });
    }

    // Construire la requête de mise à jour
    let updateFields = [];
    let updateValues = [];

    if (email !== undefined && email !== '') {
        updateFields.push('email = ?');
        updateValues.push(email);
    }

    if (parentTel !== undefined && parentTel !== '') {
        updateFields.push('parentTel = ?');
        updateValues.push(parentTel);
    }

    if (photo) {
        updateFields.push('photo = ?');
        updateValues.push(photo);
    } else if (deletePhotoValue === 'true') {
        updateFields.push('photo = NULL');
    }

    // Si aucun champ n'est spécifié mais qu'on veut supprimer la photo, permettre la mise à jour
    if (updateFields.length === 0 && deletePhotoValue === 'true') {
        updateFields.push('photo = NULL');
    }

    console.log('PUT /profil - updateFields:', updateFields);
    console.log('PUT /profil - updateValues:', updateValues);

    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updateValues.push(req.userId);

    const query = `UPDATE eleves SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(query, updateValues, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Élève non trouvé' });
        
        // Récupérer les données mises à jour
        db.get('SELECT id, nom, prenom, email, photo, parentTel FROM eleves WHERE id = ?', [req.userId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Profil mis à jour avec succès', eleve: row });
        });
    });
    } catch (error) {
        console.error('Erreur dans PUT /profil:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

// Obtenir un élève par ID
router.get('/:id', (req, res) => {
    // Éviter de matcher les routes spéciales
    if (req.params.id === 'check-token' || req.params.id === 'activate' || req.params.id === 'inscription' || req.params.id === 'famille-by-email') {
        return res.status(404).json({ message: 'Route non trouvée' });
    }
    
    db.get('SELECT * FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Élève non trouvé' });
        res.json(row);
    });
});

// Obtenir la famille d'un élève par son ID
router.get('/:id/famille', (req, res) => {
    db.get('SELECT familleLienId, enFamille, email FROM eleves WHERE id = ?', [req.params.id], (err, eleve) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!eleve) return res.status(404).json({ message: 'Élève non trouvé' });
        
        if (!eleve.enFamille || !eleve.familleLienId) {
            db.get('SELECT * FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                return res.json([row]);
            });
        } else {
            db.all('SELECT * FROM eleves WHERE familleLienId = ?', [eleve.familleLienId], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows || []);
            });
        }
    });
});

// Obtenir la famille par email (pour le switch d'élève)
router.get('/famille-by-email/:email', (req, res) => {
    const email = decodeURIComponent(req.params.email);
    
    db.all('SELECT id, nom, prenom, classe, photo, enFamille, familleLienId FROM eleves WHERE email = ? AND activated = 1', 
        [email], 
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        }
    );
});

// ================== INSCRIPTION PUBLIQUE ==================

// Route d'inscription publique (sans authentification)
router.post('/inscription', async (req, res) => {
    const { parentNom, parentPrenom, parentEmail, parentTel, enFamille, enfants } = req.body;
    
    if (!parentEmail || !enfants || enfants.length === 0) {
        return res.status(400).json({ error: 'Email parent et informations enfants requis' });
    }
    
    try {
        // Générer un ID de famille unique si plusieurs enfants
        const familleLienId = enFamille ? `FAM_${Date.now()}` : null;
        const nombreFamille = enfants.length;
        // Si en famille, utiliser un token d'activation commun pour activer tous les membres via un seul lien
        const familleActivationToken = enFamille ? generateToken() : null;
        
        const createdEleves = [];
        
        for (const enfant of enfants) {
            const id = generateId();
            const activationToken = enFamille ? familleActivationToken : generateToken();
            
            await new Promise((resolve, reject) => {
                const frais = parseFloat(enfant.fraisInscription || 0) || 0;
                const nbPaiements = parseInt(enfant.nbPaiements || 1, 10) || 1;
                db.run(`INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, resetToken, resetExpires, enFamille, nombreFamille, familleLienId, photo, parentNom, parentPrenom, parentTel, fraisInscription, nbPaiements, fraisValide, paiementsEffectues) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id, 
                        enfant.nom, 
                        enfant.prenom, 
                        enfant.dateNaissance, 
                        enfant.classe, 
                        parentEmail, // Tous les enfants partagent l'email parent
                        null, 
                        activationToken, 
                        0, // Non activé - en attente de validation admin
                        null, 
                        null, 
                        enFamille ? 1 : 0, 
                        nombreFamille, 
                        familleLienId,
                        null,
                        parentNom || null,
                        parentPrenom || null,
                        parentTel || null,
                        frais,
                        nbPaiements,
                        0,
                        0
                    ],
                    function(err) {
                        if (err) reject(err);
                        else {
                            createdEleves.push({
                                id,
                                nom: enfant.nom,
                                prenom: enfant.prenom,
                                classe: enfant.classe,
                                activationToken
                            });
                            resolve();
                        }
                    }
                );
            });
        }
        
        res.status(201).json({ 
            success: true,
            message: `${createdEleves.length} élève(s) inscrit(s) avec succès. En attente de validation.`,
            eleves: createdEleves.map(e => ({ id: e.id, nom: e.nom, prenom: e.prenom }))
        });
        
    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// Créer un élève
router.post('/', checkPermission('create'), (req, res) => {
    const { nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo, fraisInscription, nbPaiements } = req.body;
    const id = req.body.id || generateId();
    const activationToken = generateToken();

    const frais = parseFloat(fraisInscription || 0) || 0;
    const nb = parseInt(nbPaiements || 1, 10) || 1;
    db.run(`INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, resetToken, resetExpires, enFamille, nombreFamille, familleLienId, photo, fraisInscription, nbPaiements, fraisValide, paiementsEffectues) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, nom, prenom, dateNaissance, classe, email || '', null, activationToken, 0, null, null, enFamille || 0, nombreFamille || 1, familleLienId || null, photo || null, frais, nb, 0, 0],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const activationLink = `http://${req.headers.host}/activation.html?token=${activationToken}`;
            res.status(201).json({ 
                id, nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo,
                activationLink,
                message: 'Élève créé. Envoyez le lien d\'activation à l\'élève.'
            });
        }
    );
});

// Endpoint pour valider les frais d'un élève (admin/secretariat/directeur)
router.post('/:id/validate-frais', checkPermission('update'), (req, res) => {
    const count = parseInt(req.body.count || '1', 10) || 1;
    db.get('SELECT paiementsEffectues, nbPaiements FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Élève non trouvé' });

        const current = parseInt(row.paiementsEffectues || 0, 10);
        const max = parseInt(row.nbPaiements || 1, 10);
        const newCount = Math.min(current + count, max);
        const fraisValide = newCount >= max ? 1 : 0;

        db.run('UPDATE eleves SET paiementsEffectues = ?, fraisValide = ? WHERE id = ?', [newCount, fraisValide, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Paiements mis à jour', paiementsEffectues: newCount, fraisValide });
        });
    });
});

// Endpoint pour valider les frais d'une famille entière
router.post('/validate-frais-famille', checkPermission('update'), (req, res) => {
    const { familleId, eleveIds, count } = req.body;
    if (!familleId) return res.status(400).json({ error: 'familleId requis' });
    if (!Array.isArray(eleveIds) || eleveIds.length === 0) {
        return res.status(400).json({ error: 'eleveIds requis (liste des élèves à mettre à jour)' });
    }

    const toUpdate = eleveIds.slice();
    const results = [];
    const cnt = parseInt(count || '1', 10) || 1;

    (async () => {
        for (const id of toUpdate) {
            // Vérifier que l'élève appartient bien à la famille
            const row = await new Promise((resolve, reject) => {
                db.get('SELECT id, paiementsEffectues, nbPaiements, familleLienId FROM eleves WHERE id = ?', [id], (err, r) => err ? reject(err) : resolve(r));
            });
            if (!row) continue;
            if (row.familleLienId !== familleId) continue;

            const current = parseInt(row.paiementsEffectues || 0, 10);
            const max = parseInt(row.nbPaiements || 1, 10);
            const newCount = Math.min(current + cnt, max);
            const fraisValide = newCount >= max ? 1 : 0;

            await new Promise((resolve, reject) => {
                db.run('UPDATE eleves SET paiementsEffectues = ?, fraisValide = ? WHERE id = ?', [newCount, fraisValide, id], function(err) {
                    if (err) return reject(err);
                    results.push({ id, paiementsEffectues: newCount, fraisValide });
                    resolve();
                });
            });
        }

        res.json({ message: 'Mise à jour des paiements effectuée', results });
    })().catch(err => res.status(500).json({ error: err.message }));
});

// Mettre à jour un élève
router.put('/:id', checkPermission('update'), (req, res) => {
    const { nom, prenom, dateNaissance, classe, email, photo } = req.body;

    db.run('UPDATE eleves SET nom = ?, prenom = ?, dateNaissance = ?, classe = ?, email = ?, photo = ? WHERE id = ?',
        [nom, prenom, dateNaissance, classe, email || '', photo || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Élève non trouvé' });
            res.json({ id: req.params.id, nom, prenom, dateNaissance, classe, email, photo });
        }
    );
});

// Supprimer un élève
router.delete('/:id', checkPermission('delete'), (req, res) => {
    db.run('DELETE FROM eleves WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Élève non trouvé' });
        res.json({ message: 'Élève supprimé' });
    });
});

// Activer un compte élève
router.post('/activate', (req, res) => {
    const { token, password } = req.body;
    
    db.get('SELECT * FROM eleves WHERE activationToken = ? AND activated = 0', [token], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        
        // Si l'élève fait partie d'une famille, activer tous les membres de la même famille
        if (row.enFamille && row.familleLienId) {
            db.run('UPDATE eleves SET password = ?, activated = 1, activationToken = NULL WHERE familleLienId = ?',
                [password, row.familleLienId],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ 
                        message: 'Comptes de la famille activés avec succès! Vous pouvez maintenant vous connecter.',
                        email: row.email,
                        updated: this.changes
                    });
                }
            );
        } else {
            db.run('UPDATE eleves SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
                [password, row.id],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ 
                        message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
                        email: row.email
                    });
                }
            );
        }
    });
});

// Vérifier un token d'activation
router.get('/check-token/:token', (req, res) => {
    db.get('SELECT nom, prenom, email FROM eleves WHERE activationToken = ? AND activated = 0', 
        [req.params.token], 
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
            res.json(row);
        }
    );
});

// ================== FRAIS D'INSCRIPTION ==================

// Obtenir les frais d'un élève
router.get('/frais/:id', requireAuth, (req, res) => {
    const eleveId = req.params.id;
    console.log('Requête frais pour élève:', eleveId, 'par utilisateur:', req.userId, 'rôle:', req.userRole);
    
    // Vérifier les permissions : l'élève peut voir ses propres frais, les admins peuvent voir tous
    if (req.userRole === 'eleve' && req.userId !== eleveId) {
        console.log('Accès refusé: élève essaie de voir les frais d\'un autre élève');
        return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    db.get('SELECT id, nom, prenom, fraisInscription, nbPaiements, fraisValide, paiementsEffectues FROM eleves WHERE id = ?', [eleveId], (err, row) => {
        if (err) {
            console.error('Erreur DB frais:', err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            console.log('Élève non trouvé:', eleveId);
            return res.status(404).json({ message: 'Élève non trouvé' });
        }
        
        console.log('Données frais trouvées:', row);
        const fraisParPaiement = row.fraisInscription / row.nbPaiements;
        const resteAPayer = row.fraisInscription - (row.paiementsEffectues * fraisParPaiement);
        
        const result = {
            eleve: row,
            fraisParPaiement: fraisParPaiement,
            resteAPayer: resteAPayer
        };
        
        console.log('Réponse frais:', result);
        res.json(result);
    });
});

// Obtenir les frais d'une famille
router.get('/frais/famille/:email', requireAuth, (req, res) => {
    const email = req.params.email;
    
    // Vérifier les permissions : seuls les admins/secrétaires/directeurs peuvent voir les frais famille
    if (!['admin', 'secretaire', 'directeur'].includes(req.userRole)) {
        return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    db.all(`
        SELECT id, nom, prenom, fraisInscription, nbPaiements, fraisValide, paiementsEffectues 
        FROM eleves 
        WHERE email = ? OR familleLienId IN (
            SELECT familleLienId FROM eleves WHERE email = ? AND familleLienId IS NOT NULL
        )
    `, [email, email], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const totalFrais = rows.reduce((sum, eleve) => sum + (eleve.fraisInscription || 0), 0);
        const totalPaiements = rows.reduce((sum, eleve) => sum + (eleve.paiementsEffectues || 0), 0);
        const fraisParPaiement = rows.length > 0 ? totalFrais / rows[0].nbPaiements : 0;
        
        res.json({
            membres: rows,
            totalFrais: totalFrais,
            totalPaiementsEffectues: totalPaiements,
            fraisParPaiement: fraisParPaiement,
            resteAPayer: totalFrais - (totalPaiements * fraisParPaiement)
        });
    });
});

module.exports = router;
