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

// ================== PROFIL ÉLÈVE ==================

// Obtenir le profil de l'élève connecté
router.get('/profil', requireAuth, (req, res) => {
    if (req.userRole !== 'eleve') {
        return res.status(403).json({ message: 'Accès réservé aux élèves' });
    }

    db.get('SELECT id, nom, prenom, email, photo, parentTel FROM eleves WHERE id = ?', [String(req.userId)], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: 'Élève non trouvé' });
        res.json(row);
    });
});

// Mettre à jour le profil de l'élève connecté
router.put('/profil', requireAuth, upload.single('photo'), (req, res) => {
    if (req.userRole !== 'eleve') {
        return res.status(403).json({ message: 'Accès réservé aux élèves' });
    }

    const { email, parentTel } = req.body;
    const photo = req.file ? `/uploads/${req.file.filename}` : null;

    // Validation basique
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide' });
    }

    if (parentTel && !/^[0-9+\-\s()]{10,}$/.test(parentTel)) {
        return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    // Si une nouvelle photo est uploadée, supprimer l'ancienne
    if (photo) {
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

    if (email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(email);
    }

    if (parentTel !== undefined) {
        updateFields.push('parentTel = ?');
        updateValues.push(parentTel);
    }

    if (photo) {
        updateFields.push('photo = ?');
        updateValues.push(photo);
    }

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
        
        const createdEleves = [];
        
        for (const enfant of enfants) {
            const id = generateId();
            const activationToken = generateToken();
            
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, resetToken, resetExpires, enFamille, nombreFamille, familleLienId, photo, parentNom, parentPrenom, parentTel) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        parentTel || null
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
    const { nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo } = req.body;
    const id = req.body.id || generateId();
    const activationToken = generateToken();

    db.run(`INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, resetToken, resetExpires, enFamille, nombreFamille, familleLienId, photo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, nom, prenom, dateNaissance, classe, email || '', null, activationToken, 0, null, null, enFamille || 0, nombreFamille || 1, familleLienId || null, photo || null],
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

module.exports = router;
