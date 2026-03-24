const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { checkPermission, requireAuth } = require('../middleware/auth');
const { generateToken, generateId, dbGet, dbRun, dbAll } = require('../utils/helpers');
const { hashPassword } = require('../utils/password');
const { validatePassword, activationLimiter } = require('../middleware/security');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration multer pour l'upload de photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads/profile'));
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
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.json(rows);
        });
    } else {
        db.all(`
            SELECT e.*,
                CASE WHEN EXISTS (
                    SELECT 1 FROM eleve_parent ep
                    INNER JOIN parents p ON ep.parentId = p.id
                    WHERE ep.eleveId = e.id AND p.activated = 1
                ) THEN 1 ELSE 0 END AS parentsActivated,
                (SELECT COUNT(*) FROM eleve_parent ep2 WHERE ep2.eleveId = e.id) AS nbParents
            FROM eleves e
        `, (err, rows) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
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
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        res.json(rows);
    });
});

// ================== PROFIL ÉLÈVE ==================

// Obtenir le profil de l'élève connecté ou d'un enfant (pour parents)
router.get('/profil', requireAuth, async (req, res) => {
    try {
        let eleveId = req.userId;
        
        // Si c'est un parent, on doit spécifier l'ID de l'enfant
        if (req.userRole === 'parent') {
            const enfantId = req.query.enfantId;
            if (!enfantId) {
                return res.status(400).json({ message: 'Paramètre enfantId requis pour les parents' });
            }
            
            // Vérifier que l'enfant appartient bien à ce parent
            const lien = await dbGet(db, 'SELECT id FROM eleve_parent WHERE parentId = ? AND eleveId = ?', [req.userId, enfantId]);
            if (!lien) {
                return res.status(403).json({ message: 'Cet enfant n\'est pas lié à votre compte' });
            }
            eleveId = enfantId;
        } else if (req.userRole !== 'eleve') {
            return res.status(403).json({ message: 'Accès réservé aux élèves et parents' });
        }

        const eleve = await dbGet(db, 
            'SELECT id, nom, prenom, email, photo, tel, status, fraisInscription, nbPaiements, fraisValide, paiementsEffectues, classe FROM eleves WHERE id = ?', 
            [eleveId]
        );
        
        if (!eleve) {
            return res.status(404).json({ message: 'Élève non trouvé' });
        }
        
        // Récupérer les parents de l'élève
        const parents = await dbAll(db, `
            SELECT p.id, p.nom, p.prenom, p.email, p.tel, ep.relation, ep.isPrimary
            FROM parents p
            INNER JOIN eleve_parent ep ON p.id = ep.parentId
            WHERE ep.eleveId = ?
            ORDER BY ep.isPrimary DESC
        `, [eleveId]);
        
        res.json({
            ...eleve,
            parents
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Mettre à jour le profil de l'élève connecté ou d'un enfant (parent)
router.put('/profil', requireAuth, uploadMiddleware, async (req, res) => {
    try {
        let eleveId = req.userId;
        
        // Si c'est un parent, vérifier l'accès à l'enfant
        if (req.userRole === 'parent') {
            const enfantId = req.body.enfantId || req.query.enfantId;
            if (!enfantId) {
                return res.status(400).json({ error: 'Paramètre enfantId requis pour les parents' });
            }
            
            const lien = await dbGet(db, 'SELECT id FROM eleve_parent WHERE parentId = ? AND eleveId = ?', [req.userId, enfantId]);
            if (!lien) {
                return res.status(403).json({ error: 'Cet enfant n\'est pas lié à votre compte' });
            }
            eleveId = enfantId;
        } else if (req.userRole !== 'eleve') {
            return res.status(403).json({ message: 'Accès réservé aux élèves et parents' });
        }

        console.log('PUT /profil - req.body:', req.body);
        console.log('PUT /profil - req.file:', req.file);

        const { email, tel, deletePhoto } = req.body;
        const deletePhotoValue = Array.isArray(deletePhoto) ? deletePhoto[0] : deletePhoto;
        const photo = req.file ? `/uploads/profile/${req.file.filename}` : null;
        
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Email invalide' });
        }

        if (tel && !/^[0-9+\-\s()]{10,}$/.test(tel)) {
            return res.status(400).json({ error: 'Numéro de téléphone invalide' });
        }

        // Gestion de la suppression de photo

        const eleve = await dbGet(db, 'SELECT photo FROM eleves WHERE id = ?', [eleveId]);
        if (!eleve) return res.status(404).json({ message: 'Élève non trouvé' });
        if (deletePhotoValue === 'true' && eleve.photo) {
            const photoPath = path.join(__dirname, '../../public', eleve.photo);
            fs.access(photoPath, fs.constants.F_OK, (err) => {
                if (!err) {
                    fs.unlink(photoPath, (err) => {
                        if (err) console.error('Erreur suppression photo:', err);
                    });
                }
            });
        }

        // Si une nouvelle photo est uploadée, supprimer l'ancienne
        if (photo && deletePhotoValue !== 'true' && eleve.photo) {
            const oldPhotoPath = path.join(__dirname, '../../public', eleve.photo);
            fs.access(oldPhotoPath, fs.constants.F_OK, (err) => {
                if (!err) {
                    fs.unlink(oldPhotoPath, (err) => {
                        if (err) console.error('Erreur suppression ancienne photo:', err);
                    });
                }
            });
        }

        // Construire la requête de mise à jour
        let updateFields = [];
        let updateValues = [];

        // L'élève peut toujours modifier son email
        if (email !== undefined && email !== '') {
            updateFields.push('email = ?');
            updateValues.push(email);
        }

        if (tel !== undefined && tel !== '') {
            updateFields.push('tel = ?');
            updateValues.push(tel);
        }

        if (photo) {
            updateFields.push('photo = ?');
            updateValues.push(photo);
        } else if (deletePhotoValue === 'true') {
            updateFields.push('photo = NULL');
        }

        console.log('PUT /profil - updateFields:', updateFields);
        console.log('PUT /profil - updateValues:', updateValues);

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
        }

        updateValues.push(eleveId);

        const query = `UPDATE eleves SET ${updateFields.join(', ')} WHERE id = ?`;

        await dbRun(db, query, updateValues);
        
        // Récupérer les données mises à jour
        const updatedEleve = await dbGet(db, 'SELECT id, nom, prenom, email, photo, tel FROM eleves WHERE id = ?', [eleveId]);
        
        // Récupérer les parents
        const parents = await dbAll(db, `
            SELECT p.id, p.nom, p.prenom, p.email, p.tel
            FROM parents p
            INNER JOIN eleve_parent ep ON p.id = ep.parentId
            WHERE ep.eleveId = ?
        `, [eleveId]);
        
        res.json({ 
            message: 'Profil mis à jour avec succès', 
            eleve: {
                ...updatedEleve,
                parents
            }
        });

    } catch (error) {
        console.error('Erreur dans PUT /profil:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

// Obtenir un élève par ID
router.get('/:id', async (req, res) => {
    // Éviter de matcher les routes spéciales
    if (req.params.id === 'check-token' || req.params.id === 'activate' || req.params.id === 'inscription' || req.params.id === 'famille-by-email') {
        return res.status(404).json({ message: 'Route non trouvée' });
    }
    
    try {
        const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE id = ?', [req.params.id]);
        if (!eleve) return res.status(404).json({ message: 'Élève non trouvé' });
        
        // Récupérer les parents de l'élève
        const parents = await dbAll(db, `
            SELECT p.id, p.nom, p.prenom, p.email, p.tel, p.adresse, p.profession, p.activated, ep.relation, ep.isPrimary
            FROM parents p
            INNER JOIN eleve_parent ep ON p.id = ep.parentId
            WHERE ep.eleveId = ?
            ORDER BY ep.isPrimary DESC
        `, [req.params.id]);
        
        // Vérifier si au moins un parent a activé son compte
        const parentsActivated = parents.length > 0 && parents.some(p => p.activated === 1);
        
        res.json({ ...eleve, parents, parentsActivated });
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir la famille d'un élève par son ID
router.get('/:id/famille', (req, res) => {
    db.get('SELECT familleLienId, enFamille, email FROM eleves WHERE id = ?', [req.params.id], (err, eleve) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (!eleve) return res.status(404).json({ message: 'Élève non trouvé' });
        
        if (!eleve.enFamille || !eleve.familleLienId) {
            db.get('SELECT * FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                return res.json([row]);
            });
        } else {
            db.all('SELECT * FROM eleves WHERE familleLienId = ?', [eleve.familleLienId], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
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
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            res.json(rows || []);
        }
    );
});

// ================== INSCRIPTION PUBLIQUE ==================

// Route d'inscription publique pour élèves sans parents
router.post('/inscription', async (req, res) => {
    const { nom, prenom, email, tel, dateNaissance, classe, fraisInscription, nbPaiements, anneeScolaire } = req.body;
    
    if (!email || !nom || !prenom) {
        return res.status(400).json({ error: 'Email, nom et prénom requis' });
    }
    
    try {
        // Vérifier que l'email n'est pas déjà utilisé
        const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [email]);
        if (existingEleve) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [email]);
        if (existingParent) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [email]);
        if (existingProf) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [email]);
        if (existingStaff) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        const id = generateId('eleve');
        const activationToken = generateToken();
        const frais = parseFloat(fraisInscription || 0) || 0;
        const nb = parseInt(nbPaiements || 1, 10) || 1;
        
        await dbRun(db, `
            INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, 
                               enFamille, nombreFamille, familleLienId, tel, fraisInscription, nbPaiements, fraisValide, paiementsEffectues, anneeScolaire)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, 0, 1, NULL, ?, ?, ?, 0, 0, ?)
        `, [id, nom, prenom, dateNaissance || null, classe || null, email, activationToken, tel || null, frais, nb, anneeScolaire || null]);
        
        res.status(201).json({ 
            success: true,
            message: 'Inscription réussie. En attente de validation.',
            eleve: { id, nom, prenom }
        });
        
    } catch (error) {
        console.error('Erreur inscription élève:', error);
        res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
});

// Créer un élève (admin/secretariat)
router.post('/', checkPermission('create'), async (req, res) => {
    const { nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo, fraisInscription, nbPaiements, tel, anneeScolaire } = req.body;
    
    try {
        // Vérifier que l'email n'est pas déjà utilisé si fourni
        if (email) {
            const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ?', [email]);
            if (existingEleve) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un élève' });
            }
            
            const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [email]);
            if (existingParent) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un parent' });
            }
            
            const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [email]);
            if (existingProf) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
            }
            
            const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [email]);
            if (existingStaff) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un membre du bureau' });
            }
        }
        
        const id = req.body.id || generateId('eleve');
        const activationToken = email ? generateToken() : null;
        const frais = parseFloat(fraisInscription || 0) || 0;
        const nb = parseInt(nbPaiements || 1, 10) || 1;
        
        await dbRun(db, `
            INSERT INTO eleves (id, nom, prenom, dateNaissance, classe, email, password, activationToken, activated, 
                               enFamille, nombreFamille, familleLienId, photo, fraisInscription, nbPaiements, 
                               fraisValide, paiementsEffectues, tel, anneeScolaire)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
        `, [id, nom, prenom, dateNaissance || null, classe || null, email || null, activationToken, 
            enFamille || 0, nombreFamille || 1, familleLienId || null, photo || null, frais, nb, tel || null, anneeScolaire || null]);
        
        const activationLink = email ? `http://${req.headers.host}/activation.html?token=${activationToken}` : null;
        
        res.status(201).json({ 
            id, nom, prenom, dateNaissance, classe, email, enFamille, nombreFamille, familleLienId, photo,
            activationLink,
            message: email ? 'Élève créé. Envoyez le lien d\'activation.' : 'Élève créé (sans compte propre).'
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Endpoint pour enregistrer un paiement partiel avec méthode de paiement
router.post('/:id/paiement', checkPermission('update'), async (req, res) => {
    const { montant, methodePaiement, date, note } = req.body;
    const eleveId = req.params.id;

    if (!montant || parseFloat(montant) <= 0) {
        return res.status(400).json({ error: 'Montant invalide (doit être > 0)' });
    }

    const methodes = ['carte', 'virement', 'espece'];
    if (!methodePaiement || !methodes.includes(methodePaiement)) {
        return res.status(400).json({ error: 'Méthode de paiement invalide. Choisir: carte, virement, espece' });
    }

    try {
        const eleve = await dbGet(db, 'SELECT id, fraisInscription, montantPaye, paiementsEffectues, fraisValide FROM eleves WHERE id = ?', [eleveId]);
        if (!eleve) return res.status(404).json({ error: 'Élève non trouvé' });

        const totalFrais = parseFloat(eleve.fraisInscription || 0);
        const dejaPaye = parseFloat(eleve.montantPaye || 0);
        const montantPaiement = parseFloat(montant);
        const resteAvant = totalFrais - dejaPaye;

        if (montantPaiement > resteAvant + 0.01) {
            return res.status(400).json({ error: `Le montant dépasse le reste à payer (${resteAvant.toFixed(2)} €)` });
        }

        const paiementId = generateId('paie');
        const datePaiement = date || new Date().toISOString();

        await dbRun(db, `
            INSERT INTO paiements (id, eleveId, montant, methodePaiement, date, note)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [paiementId, eleveId, montantPaiement, methodePaiement, datePaiement, note || null]);

        const nouveauMontantPaye = dejaPaye + montantPaiement;
        const nouveauNbPaiements = (parseInt(eleve.paiementsEffectues || 0, 10)) + 1;
        const fraisValide = nouveauMontantPaye >= totalFrais - 0.01 ? 1 : 0;

        await dbRun(db, 
            'UPDATE eleves SET montantPaye = ?, paiementsEffectues = ?, fraisValide = ? WHERE id = ?',
            [nouveauMontantPaye, nouveauNbPaiements, fraisValide, eleveId]
        );

        res.json({
            message: 'Paiement enregistré',
            paiement: { id: paiementId, montant: montantPaiement, methodePaiement, date: datePaiement },
            eleve: {
                montantPaye: nouveauMontantPaye,
                paiementsEffectues: nouveauNbPaiements,
                fraisValide,
                resteAPayer: Math.max(0, totalFrais - nouveauMontantPaye)
            }
        });
    } catch (err) {
        console.error('Erreur enregistrement paiement:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Endpoint pour enregistrer un paiement famille (tous les enfants d'une famille)
router.post('/paiement-famille', checkPermission('update'), async (req, res) => {
    const { parentId, eleveIds, montant, methodePaiement, date, note, targetEleveId } = req.body;

    if (!parentId) return res.status(400).json({ error: 'parentId requis' });
    if (!Array.isArray(eleveIds) || eleveIds.length === 0) {
        return res.status(400).json({ error: 'eleveIds requis' });
    }
    if (!montant || parseFloat(montant) <= 0) {
        return res.status(400).json({ error: 'Montant invalide' });
    }

    const methodes = ['carte', 'virement', 'espece'];
    if (!methodePaiement || !methodes.includes(methodePaiement)) {
        return res.status(400).json({ error: 'Méthode de paiement invalide' });
    }

    try {
        const montantTotal = parseFloat(montant);
        let montantRestant = montantTotal;
        const results = [];
        const datePaiement = date || new Date().toISOString();

        // Vérifier que les élèves appartiennent bien au parent via eleve_parent
        const eleves = [];
        const idsToProcess = targetEleveId ? [targetEleveId] : eleveIds;
        for (const id of idsToProcess) {
            // Vérifier la liaison parent-enfant
            const lien = await dbGet(db, 'SELECT id FROM eleve_parent WHERE parentId = ? AND eleveId = ?', [parentId, id]);
            if (!lien) continue;
            const row = await dbGet(db, 'SELECT id, fraisInscription, montantPaye, paiementsEffectues, familleLienId FROM eleves WHERE id = ?', [id]);
            if (!row) continue;
            const reste = Math.max(0, (row.fraisInscription || 0) - (row.montantPaye || 0));
            if (reste > 0) eleves.push({ ...row, reste });
        }

        const totalReste = eleves.reduce((s, e) => s + e.reste, 0);
        if (montantTotal > totalReste + 0.01) {
            return res.status(400).json({ error: `Le montant dépasse le reste total à payer (${totalReste.toFixed(2)} €)` });
        }

        for (const eleve of eleves) {
            if (montantRestant <= 0) break;
            const part = totalReste > 0 ? Math.min(eleve.reste, (eleve.reste / totalReste) * montantTotal) : 0;
            const montantEleve = Math.min(part, montantRestant);
            if (montantEleve <= 0) continue;

            const paiementId = generateId('paie');
            await dbRun(db, `INSERT INTO paiements (id, eleveId, montant, methodePaiement, date, note) VALUES (?, ?, ?, ?, ?, ?)`,
                [paiementId, eleve.id, montantEleve, methodePaiement, datePaiement, note || null]);

            const nouveauMontantPaye = (eleve.montantPaye || 0) + montantEleve;
            const nouveauNb = (eleve.paiementsEffectues || 0) + 1;
            const fraisValide = nouveauMontantPaye >= (eleve.fraisInscription || 0) - 0.01 ? 1 : 0;

            await dbRun(db, 'UPDATE eleves SET montantPaye = ?, paiementsEffectues = ?, fraisValide = ? WHERE id = ?',
                [nouveauMontantPaye, nouveauNb, fraisValide, eleve.id]);

            results.push({ id: eleve.id, montantPaye: nouveauMontantPaye, fraisValide });
            montantRestant -= montantEleve;
        }

        res.json({ message: 'Paiement famille enregistré', results });
    } catch (err) {
        console.error('Erreur paiement famille:', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Endpoint ancien pour compat - valider les frais d'un élève (incrémente de 1)
router.post('/:id/validate-frais', checkPermission('update'), (req, res) => {
    const count = parseInt(req.body.count || '1', 10) || 1;
    db.get('SELECT paiementsEffectues, nbPaiements FROM eleves WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (!row) return res.status(404).json({ message: 'Élève non trouvé' });

        const current = parseInt(row.paiementsEffectues || 0, 10);
        const max = parseInt(row.nbPaiements || 1, 10);
        const newCount = Math.min(current + count, max);
        const fraisValide = newCount >= max ? 1 : 0;

        db.run('UPDATE eleves SET paiementsEffectues = ?, fraisValide = ? WHERE id = ?', [newCount, fraisValide, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
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
    })().catch(err => res.status(500).json({ error: 'Erreur interne du serveur' }));
});

// Mettre à jour un élève
router.put('/:id', checkPermission('update'), async (req, res) => {
    const { nom, prenom, dateNaissance, classe, email, photo, tel } = req.body;

    try {
        // Vérifier que l'email n'est pas déjà utilisé par quelqu'un d'autre
        if (email) {
            const existingEleve = await dbGet(db, 'SELECT id FROM eleves WHERE email = ? AND id != ?', [email, req.params.id]);
            if (existingEleve) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre élève' });
            }
            
            const existingParent = await dbGet(db, 'SELECT id FROM parents WHERE email = ?', [email]);
            if (existingParent) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un parent' });
            }
            
            const existingProf = await dbGet(db, 'SELECT id FROM professeurs WHERE email = ?', [email]);
            if (existingProf) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un professeur' });
            }
            
            const existingStaff = await dbGet(db, 'SELECT id FROM staff WHERE email = ?', [email]);
            if (existingStaff) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé par un membre du bureau' });
            }
        }
        
        await dbRun(db, 
            'UPDATE eleves SET nom = ?, prenom = ?, dateNaissance = ?, classe = ?, email = ?, photo = ?, tel = ? WHERE id = ?',
            [nom, prenom, dateNaissance || null, classe || null, email || null, photo || null, tel || null, req.params.id]
        );
        
        res.json({ id: req.params.id, nom, prenom, dateNaissance, classe, email, photo, tel });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Fonction utilitaire : supprimer les parents orphelins (sans enfants)
async function cleanupOrphanParents(parentIds) {
    if (!parentIds || parentIds.length === 0) return [];
    const deletedParents = [];
    for (const parentId of parentIds) {
        const remaining = await dbGet(db, 'SELECT COUNT(*) as count FROM eleve_parent WHERE parentId = ?', [parentId]);
        if (remaining && remaining.count === 0) {
            // Supprimer les sessions du parent
            await dbRun(db, 'DELETE FROM sessions WHERE userId = ?', [parentId]).catch(() => {});
            // Supprimer le parent
            await dbRun(db, 'DELETE FROM parents WHERE id = ?', [parentId]);
            deletedParents.push(parentId);
            console.log(`Parent orphelin supprimé automatiquement: ${parentId}`);
        }
    }
    return deletedParents;
}

// Supprimer un élève
router.delete('/:id', checkPermission('delete'), async (req, res) => {
    try {
        // récupérer parents liés
        const parentLinks = await dbAll(db, 'SELECT parentId FROM eleve_parent WHERE eleveId = ?', [req.params.id]);
        const parentIds = parentLinks.map(l => l.parentId);

        // supprimer les liaisons élève‑parent
        await dbRun(db, 'DELETE FROM eleve_parent WHERE eleveId = ?', [req.params.id]);

        // **nettoyage des tables dépendantes**
        await dbRun(db, 'DELETE FROM absences WHERE eleveId = ?', [req.params.id]);
        await dbRun(db, 'DELETE FROM appreciations WHERE eleveId = ?', [req.params.id]);
        // supprimer les messages où l'élève apparait comme expéditeur ou destinataire
        await dbRun(db, 'DELETE FROM messages WHERE expediteurId = ? OR destinataireId = ?', [req.params.id, req.params.id]);
        // paiements a déjà ON DELETE CASCADE mais on s'assure quand même
        await dbRun(db, 'DELETE FROM paiements WHERE eleveId = ?', [req.params.id]);

        // supprimer l'élève
        const result = await dbRun(db, 'DELETE FROM eleves WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: 'Élève non trouvé' });
        }

        // supprimer parents orphelins
        const deletedParents = await cleanupOrphanParents(parentIds);

        res.json({
            message: 'Élève supprimé',
            deletedParents: deletedParents.length > 0 ? deletedParents : undefined
        });
    } catch (err) {
        console.error('Erreur suppression élève', err);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Activer un compte élève (avec hashage bcrypt et rate limiting)
router.post('/activate', activationLimiter, async (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token et mot de passe requis' });
    }
    
    // Validation du mot de passe avec règles de complexité
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.message });
    }
    
    try {
        const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE activationToken = ? AND activated = 0', [token]);
        
        if (!eleve) {
            return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        }
        
        // Hasher le mot de passe avec bcrypt
        const hashedPassword = await hashPassword(password);
        
        await dbRun(db, 
            'UPDATE eleves SET password = ?, activated = 1, activationToken = NULL WHERE id = ?',
            [hashedPassword, eleve.id]
        );
        
        res.json({ 
            message: 'Compte activé avec succès! Vous pouvez maintenant vous connecter.',
            email: eleve.email
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Vérifier un token d'activation
router.get('/check-token/:token', async (req, res) => {
    try {
        const eleve = await dbGet(db, 'SELECT nom, prenom, email FROM eleves WHERE activationToken = ? AND activated = 0', [req.params.token]);
        
        if (!eleve) {
            return res.status(404).json({ error: 'Token invalide ou compte déjà activé' });
        }
        
        res.json(eleve);
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ================== FRAIS D'INSCRIPTION ==================

// Obtenir les frais d'une famille (par parent connecté) — AVANT /frais/:id pour éviter conflit
router.get('/frais/famille/me', requireAuth, async (req, res) => {
    if (req.userRole !== 'parent') {
        return res.status(403).json({ message: 'Accès réservé aux parents' });
    }
    
    try {
        const enfants = await dbAll(db, `
            SELECT e.id, e.nom, e.prenom, e.fraisInscription, e.nbPaiements, e.fraisValide, e.paiementsEffectues, e.montantPaye 
            FROM eleves e
            INNER JOIN eleve_parent ep ON e.id = ep.eleveId
            WHERE ep.parentId = ?
        `, [req.userId]);

        // Récupérer les paiements pour chaque enfant
        for (const enfant of enfants) {
            enfant.paiements = await dbAll(db, 
                'SELECT id, montant, methodePaiement, date, note, createdAt FROM paiements WHERE eleveId = ? ORDER BY date DESC',
                [enfant.id]
            );
            enfant.montantPaye = parseFloat(enfant.montantPaye || 0);
        }
        
        const totalFrais = enfants.reduce((sum, e) => sum + (e.fraisInscription || 0), 0);
        const totalMontantPaye = enfants.reduce((sum, e) => sum + (e.montantPaye || 0), 0);
        const resteAPayer = Math.max(0, totalFrais - totalMontantPaye);
        
        res.json({
            enfants,
            totalFrais,
            totalMontantPaye,
            totalPaiementsEffectues: enfants.reduce((sum, e) => sum + (e.paiementsEffectues || 0), 0),
            totalNbPaiements: enfants.reduce((sum, e) => sum + (e.nbPaiements || 0), 0),
            resteAPayer
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir les frais d'une famille (admin)
router.get('/frais/famille/:parentId', requireAuth, async (req, res) => {
    const { parentId } = req.params;
    
    if (!['admin', 'secretaire', 'secretariat', 'directeur'].includes(req.userRole)) {
        return res.status(403).json({ message: 'Accès non autorisé' });
    }
    
    try {
        const enfants = await dbAll(db, `
            SELECT e.id, e.nom, e.prenom, e.fraisInscription, e.nbPaiements, e.fraisValide, e.paiementsEffectues, e.montantPaye 
            FROM eleves e
            INNER JOIN eleve_parent ep ON e.id = ep.eleveId
            WHERE ep.parentId = ?
        `, [parentId]);

        for (const enfant of enfants) {
            enfant.paiements = await dbAll(db, 
                'SELECT id, montant, methodePaiement, date, note, createdAt FROM paiements WHERE eleveId = ? ORDER BY date DESC',
                [enfant.id]
            );
            enfant.montantPaye = parseFloat(enfant.montantPaye || 0);
        }
        
        const totalFrais = enfants.reduce((sum, e) => sum + (e.fraisInscription || 0), 0);
        const totalMontantPaye = enfants.reduce((sum, e) => sum + (e.montantPaye || 0), 0);
        const resteAPayer = Math.max(0, totalFrais - totalMontantPaye);
        
        res.json({
            enfants,
            totalFrais,
            totalMontantPaye,
            resteAPayer
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Obtenir les frais d'un élève (avec historique des paiements)
router.get('/frais/:id', requireAuth, async (req, res) => {
    const eleveId = req.params.id;
    try {
        // Vérifier les permissions
        if (req.userRole === 'eleve' && req.userId !== eleveId) {
            return res.status(403).json({ message: 'Accès non autorisé' });
        }
        
        // Si c'est un parent, vérifier que l'enfant lui appartient
        if (req.userRole === 'parent') {
            const lien = await dbGet(db, 'SELECT id FROM eleve_parent WHERE parentId = ? AND eleveId = ?', [req.userId, eleveId]);
            if (!lien) {
                return res.status(403).json({ message: 'Cet enfant n\'est pas lié à votre compte' });
            }
        }
        
        const eleve = await dbGet(db, 
            'SELECT id, nom, prenom, fraisInscription, nbPaiements, fraisValide, paiementsEffectues, montantPaye FROM eleves WHERE id = ?', 
            [eleveId]
        );
        
        if (!eleve) {
            return res.status(404).json({ message: 'Élève non trouvé' });
        }

        // Récupérer l'historique des paiements
        const paiements = await dbAll(db, 
            'SELECT id, montant, methodePaiement, date, note, createdAt FROM paiements WHERE eleveId = ? ORDER BY date DESC', 
            [eleveId]
        );
        
        const montantPaye = parseFloat(eleve.montantPaye || 0);
        const fraisParPaiement = eleve.nbPaiements > 0 ? eleve.fraisInscription / eleve.nbPaiements : eleve.fraisInscription;
        const resteAPayer = Math.max(0, eleve.fraisInscription - montantPaye);
        
        res.json({
            eleve: { ...eleve, montantPaye },
            fraisParPaiement,
            resteAPayer,
            paiements
        });
        
    } catch (err) {
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ================== RÉINSCRIPTION ==================

// Réinscrire un élève pour une nouvelle année scolaire
router.post('/:id/reinscription', checkPermission('update'), async (req, res) => {
    const { anneeScolaire, classe, fraisInscription, nbPaiements } = req.body;
    const eleveId = req.params.id;

    if (!anneeScolaire) {
        return res.status(400).json({ error: 'L\'année scolaire est requise' });
    }

    try {
        const eleve = await dbGet(db, 'SELECT * FROM eleves WHERE id = ?', [eleveId]);
        if (!eleve) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }

        const frais = parseFloat(fraisInscription || 0) || 0;
        const nb = parseInt(nbPaiements || 1, 10) || 1;

        // Mettre à jour l'élève avec la nouvelle année scolaire, la classe, les frais réinitialisés
        await dbRun(db, `
            UPDATE eleves SET 
                anneeScolaire = ?,
                classe = ?,
                fraisInscription = ?,
                nbPaiements = ?,
                fraisValide = 0,
                paiementsEffectues = 0,
                montantPaye = 0
            WHERE id = ?
        `, [anneeScolaire, classe || eleve.classe, frais, nb, eleveId]);

        res.json({
            success: true,
            message: `Réinscription de ${eleve.prenom} ${eleve.nom} pour l'année ${anneeScolaire} effectuée.`,
            eleve: { id: eleveId, anneeScolaire, classe: classe || eleve.classe, fraisInscription: frais, nbPaiements: nb }
        });

    } catch (err) {
        console.error('Erreur réinscription:', err);
        res.status(500).json({ error: 'Erreur lors de la réinscription' });
    }
});

// Réinscription en lot (plusieurs élèves)
router.post('/reinscription/batch', checkPermission('update'), async (req, res) => {
    const { anneeScolaire, eleves } = req.body;
    // eleves: [{ id, classe, fraisInscription, nbPaiements }]

    if (!anneeScolaire) {
        return res.status(400).json({ error: 'L\'année scolaire est requise' });
    }
    if (!eleves || eleves.length === 0) {
        return res.status(400).json({ error: 'Au moins un élève requis' });
    }

    try {
        const results = [];
        const errors = [];

        for (const e of eleves) {
            const existing = await dbGet(db, 'SELECT * FROM eleves WHERE id = ?', [e.id]);
            if (!existing) {
                errors.push(`Élève ${e.id} non trouvé`);
                continue;
            }

            const frais = parseFloat(e.fraisInscription || 0) || 0;
            const nb = parseInt(e.nbPaiements || 1, 10) || 1;

            await dbRun(db, `
                UPDATE eleves SET 
                    anneeScolaire = ?,
                    classe = ?,
                    fraisInscription = ?,
                    nbPaiements = ?,
                    fraisValide = 0,
                    paiementsEffectues = 0,
                    montantPaye = 0
                WHERE id = ?
            `, [anneeScolaire, e.classe || existing.classe, frais, nb, e.id]);

            results.push({ id: e.id, nom: existing.nom, prenom: existing.prenom });
        }

        res.json({
            success: true,
            message: `${results.length} élève(s) réinscrit(s) pour l'année ${anneeScolaire}.`,
            results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error('Erreur réinscription batch:', err);
        res.status(500).json({ error: 'Erreur lors de la réinscription' });
    }
});

module.exports = router;
