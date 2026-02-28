const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');

// Configuration multer pour les pièces jointes des actualités
const uploadDir = path.join(__dirname, '../../public/uploads/actualites');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max par fichier
    fileFilter: (req, file, cb) => {
        const allowedExts = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|txt|zip|rar|csv)$/i;
        if (allowedExts.test(path.extname(file.originalname))) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'));
        }
    }
});

// Helper : supprimer les fichiers physiques d'une actualité
function deleteActualiteFiles(piecesJointesJson) {
    if (!piecesJointesJson) return;
    try {
        const files = JSON.parse(piecesJointesJson);
        files.forEach(f => {
            const filePath = path.join(__dirname, '../../public', f.url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    } catch {}
}

// Récupérer toutes les actualités (publiques, triées par date décroissante)
router.get('/', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userClasse = req.headers['x-user-classe'];
    const userId = req.headers['x-user-id'];
    
    // Filtrer les actualités non expirées (dateFin NULL ou > date actuelle)
    const currentDate = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    db.all('SELECT * FROM actualites WHERE (dateFin IS NULL OR dateFin > ?) ORDER BY date DESC, createdAt DESC', [currentDate], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        
        // Pour les parents, on doit d'abord récupérer les classes de leurs enfants
        if (userRole === 'parent') {
            db.all(`
                SELECT DISTINCT e.classe FROM eleves e
                INNER JOIN eleve_parent ep ON e.id = ep.eleveId
                WHERE ep.parentId = ? AND e.classe IS NOT NULL
            `, [userId], (err2, classesRows) => {
                if (err2) return res.status(500).json({ error: err2.message });
                
                const enfantClasses = classesRows.map(r => r.classe);
                
                const filtered = (rows || []).filter(actu => {
                    if (!actu.cible || actu.cible === 'tous') return true;
                    
                    try {
                        const cibles = JSON.parse(actu.cible);
                        // Parents voient les actus ciblant "eleves" ou les classes de leurs enfants
                        if (cibles.includes('eleves')) return true;
                        // Vérifier si une des classes des enfants est ciblée
                        if (enfantClasses.some(c => cibles.includes(c))) return true;
                        return false;
                    } catch {
                        return true;
                    }
                });
                
                res.json(filtered.map(a => ({ ...a, piecesJointes: a.piecesJointes ? JSON.parse(a.piecesJointes) : [] })));
            });
            return;
        }
        
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
        
        res.json(filtered.map(a => ({ ...a, piecesJointes: a.piecesJointes ? JSON.parse(a.piecesJointes) : [] })));
    });
});

// Récupérer une actualité par ID
router.get('/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM actualites WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (!row) return res.status(404).json({ error: 'Actualité non trouvée' });
        res.json({ ...row, piecesJointes: row.piecesJointes ? JSON.parse(row.piecesJointes) : [] });
    });
});

// Créer une actualité (réservé au bureau/admin)
router.post('/', (req, res) => {
    upload.array('piecesJointes', 5)(req, res, (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: 'Erreur lors de l\'upload des fichiers' });

        const { titre, description, date, auteurId, auteurNom, cible, dateFin } = req.body;
        const id = generateId();

        const cibleStr = Array.isArray(cible) ? JSON.stringify(cible) : (cible || 'tous');

        // Construire les métadonnées des fichiers uploadés
        const piecesJointesMeta = (req.files || []).map(f => ({
            nom: f.originalname,
            taille: f.size,
            type: f.mimetype,
            url: `/uploads/actualites/${f.filename}`
        }));
        const piecesJointesJson = piecesJointesMeta.length > 0 ? JSON.stringify(piecesJointesMeta) : null;

        db.run(
            'INSERT INTO actualites (id, titre, description, date, auteurId, auteurNom, cible, dateFin, piecesJointes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, titre, description, date, auteurId || null, auteurNom || 'Système', cibleStr, dateFin || null, piecesJointesJson],
            function(err) {
                if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
                res.status(201).json({ id, titre, description, date, auteurId, auteurNom, cible: cibleStr, dateFin, piecesJointes: piecesJointesMeta });
            }
        );
    });
});

// Modifier une actualité
router.put('/:id', (req, res) => {
    upload.array('piecesJointes', 5)(req, res, (uploadErr) => {
        if (uploadErr) return res.status(400).json({ error: 'Erreur lors de l\'upload des fichiers' });

        const { id } = req.params;
        const { titre, description, date, dateFin, piecesJointesExistantes } = req.body;

        // Récupérer l'actualité actuelle pour gérer les fichiers à supprimer
        db.get('SELECT piecesJointes FROM actualites WHERE id = ?', [id], (err, row) => {
            if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
            if (!row) return res.status(404).json({ error: 'Actualité non trouvée' });

            // Pièces jointes conservées (envoyées en JSON depuis le client)
            let conservees = [];
            try { conservees = piecesJointesExistantes ? JSON.parse(piecesJointesExistantes) : []; } catch {}

            // Supprimer les fichiers qui ne sont plus dans la liste conservée
            if (row.piecesJointes) {
                try {
                    const anciennes = JSON.parse(row.piecesJointes);
                    const conserveesUrls = conservees.map(f => f.url);
                    anciennes.forEach(f => {
                        if (!conserveesUrls.includes(f.url)) {
                            const fp = path.join(__dirname, '../../public', f.url);
                            if (fs.existsSync(fp)) fs.unlinkSync(fp);
                        }
                    });
                } catch {}
            }

            // Nouveaux fichiers uploadés
            const nouveaux = (req.files || []).map(f => ({
                nom: f.originalname,
                taille: f.size,
                type: f.mimetype,
                url: `/uploads/actualites/${f.filename}`
            }));

            const toutesJointes = [...conservees, ...nouveaux];
            const piecesJointesJson = toutesJointes.length > 0 ? JSON.stringify(toutesJointes) : null;

            db.run(
                'UPDATE actualites SET titre = ?, description = ?, date = ?, dateFin = ?, piecesJointes = ? WHERE id = ?',
                [titre, description, date, dateFin || null, piecesJointesJson, id],
                function(err2) {
                    if (err2) return res.status(500).json({ error: err2.message });
                    res.json({ message: 'Actualité mise à jour', piecesJointes: toutesJointes });
                }
            );
        });
    });
});

// Supprimer une actualité
router.delete('/:id', (req, res) => {
    const { id } = req.params;

    // Récupérer d'abord les fichiers associés pour les supprimer
    db.get('SELECT piecesJointes FROM actualites WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erreur interne du serveur' });
        if (!row) return res.status(404).json({ error: 'Actualité non trouvée' });

        db.run('DELETE FROM actualites WHERE id = ?', [id], function(err2) {
            if (err2) return res.status(500).json({ error: err2.message });
            // Supprimer les fichiers physiques
            deleteActualiteFiles(row.piecesJointes);
            res.json({ message: 'Actualité supprimée' });
        });
    });
});

module.exports = router;
