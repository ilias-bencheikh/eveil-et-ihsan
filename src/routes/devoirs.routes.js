const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../config/database');
const { generateId } = require('../utils/helpers');

// Configuration multer pour les devoirs
const uploadDir = path.join(__dirname, '../../public/uploads/devoirs');
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
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 Mo max
    fileFilter: (req, file, cb) => {
        const allowedExts = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|txt|zip|rar|csv|mp4|webm|mov|avi|mkv|m4v)$/i;
        if (allowedExts.test(path.extname(file.originalname))) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'));
        }
    }
});

// Helper : supprimer les fichiers d'un devoir
function deleteDevoirFiles(fichiersJson) {
    if (!fichiersJson) return;
    try {
        const files = JSON.parse(fichiersJson);
        files.forEach(f => {
            const filePath = path.join(__dirname, '../../public', f.url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    } catch (e) {
        console.error("Erreur suppression fichiers devoirs:", e);
    }
}

// Fonction pour nettoyer les devoirs expirés (datePour passée)
function clearExpiredDevoirs() {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    db.all(`SELECT * FROM devoirs WHERE datePour < ?`, [today], (err, devoirs) => {
        if (!err && devoirs && devoirs.length > 0) {
            devoirs.forEach(devoir => {
                deleteDevoirFiles(devoir.fichiers);
                db.run(`DELETE FROM devoirs WHERE id = ?`, [devoir.id]);
            });
        }
    });
}

// GET /api/devoirs/classe/:classeId
router.get('/classe/:classeId', (req, res) => {
    // Nettoyer d'abord
    clearExpiredDevoirs();
    
    const classeId = req.params.classeId;
    const today = new Date().toISOString().split('T')[0];
    
    db.all(`SELECT d.*, c.nom as classeNom 
            FROM devoirs d 
            LEFT JOIN classes c ON d.classeId = c.id 
            WHERE d.classeId = ? AND d.datePour >= ? 
            ORDER BY d.datePour ASC`, [classeId, today], (err, rows) => {
        if (err) {
            console.error("Erreur SQL devoirs:", err);
            return res.status(500).json({ error: "Erreur base de données" });
        }
        res.json(rows);
    });
});

// POST /api/devoirs (Créer un devoir)
router.post('/', upload.array('fichiers', 5), (req, res) => {
    const { titre, description, datePour, classeId } = req.body;
    const professeurId = req.headers['x-user-id']; // Supposant qu'il est défini par secureHeaders
    const userRole = req.headers['x-user-role'];
    
    if (userRole !== 'admin' && userRole !== 'professeur' && userRole !== 'secretariat' && userRole !== 'directeur') {
         // Cleanup fichiers si echec
         if (req.files) {
             req.files.forEach(f => fs.unlinkSync(f.path));
         }
         return res.status(403).json({ error: "Non autorisé" });
    }

    if (!titre || !datePour || !classeId) {
        if (req.files) req.files.forEach(f => fs.unlinkSync(f.path));
        return res.status(400).json({ error: "Champs requis manquants" });
    }

    const id = generateId();
    let fichiers = null;

    if (req.files && req.files.length > 0) {
        fichiers = JSON.stringify(req.files.map(f => ({
            name: f.originalname,
            url: `/uploads/devoirs/${f.filename}`,
            size: f.size,
            mimetype: f.mimetype
        })));
    }

    db.run(
        `INSERT INTO devoirs (id, titre, description, datePour, classeId, professeurId, fichiers) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, titre, description, datePour, classeId, professeurId, fichiers],
        function(err) {
            if (err) {
                console.error("Erreur création devoir:", err);
                return res.status(500).json({ error: "Erreur serveur" });
            }
            res.status(201).json({ success: true, id });
        }
    );
});

// DELETE /api/devoirs/:id
router.delete('/:id', (req, res) => {
    const userRole = req.headers['x-user-role'];
    if (userRole !== 'admin' && userRole !== 'professeur' && userRole !== 'secretariat' && userRole !== 'directeur') {
        return res.status(403).json({ error: "Non autorisé" });
    }
    
    db.get(`SELECT fichiers FROM devoirs WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: "Erreur DB" });
        if (!row) return res.status(404).json({ error: "Devoir non trouvé" });
        
        deleteDevoirFiles(row.fichiers);
        
        db.run(`DELETE FROM devoirs WHERE id = ?`, [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: "Erreur DB" });
            res.json({ success: true });
        });
    });
});

module.exports = router;
