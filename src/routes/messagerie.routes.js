const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { DEMO_ACCOUNTS } = require('../config/constants');
const { generateId, formatDate } = require('../utils/helpers');

// Obtenir les destinataires possibles
router.get('/destinataires', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    let destinataires = [];

    if (userRole === 'eleve') {
        db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
            if (err) return res.status(500).json({ error: err.message });
            
            destinataires = [
                ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur' })),
                ...DEMO_ACCOUNTS.staff.filter(s => s.role === 'secretariat').map(s => ({ 
                    id: s.id, nom: s.email.split('@')[0], role: 'Secrétariat' 
                }))
            ];
            res.json(destinataires);
        });
    } else if (userRole === 'professeur') {
        db.all(`
            SELECT DISTINCT e.id, e.nom, e.prenom FROM eleves e
            INNER JOIN classes c ON e.classe = c.nom
            WHERE c.professeurId = ?
        `, [userId], (err, eleves) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.all('SELECT id, nom, prenom FROM professeurs WHERE id != ?', [userId], (err, profs) => {
                if (err) return res.status(500).json({ error: err.message });
                
                destinataires = [
                    ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur' })),
                    ...DEMO_ACCOUNTS.staff.map(s => ({ id: s.id, nom: s.email.split('@')[0], role: s.role })),
                    ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève' }))
                ];
                res.json(destinataires);
            });
        });
    } else {
        db.all('SELECT id, nom, prenom FROM eleves', (err, eleves) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
                if (err) return res.status(500).json({ error: err.message });
                
                destinataires = [
                    ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève' })),
                    ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur' })),
                    ...DEMO_ACCOUNTS.staff.filter(s => s.id !== userId).map(s => ({ 
                        id: s.id, nom: s.email.split('@')[0], role: s.role 
                    }))
                ];
                res.json(destinataires);
            });
        });
    }
});

// Obtenir les messages
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'];

    db.all('SELECT * FROM messages WHERE expediteurId = ? OR destinataireId = ?', [userId, userId], (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all('SELECT id, nom, prenom FROM eleves', (err, eleves) => {
            db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
                const allUsers = [
                    ...eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}` })),
                    ...profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}` })),
                    ...DEMO_ACCOUNTS.staff.map(s => ({ id: s.id, nom: s.email.split('@')[0] }))
                ];

                const enrichedMessages = messages.map(m => {
                    const expediteur = allUsers.find(u => u.id === m.expediteurId);
                    const destinataire = allUsers.find(u => u.id === m.destinataireId);
                    return {
                        ...m,
                        expediteurNom: expediteur ? expediteur.nom : 'Inconnu',
                        destinataireNom: destinataire ? destinataire.nom : 'Inconnu',
                        lu: m.lu === 1
                    };
                });

                res.json(enrichedMessages);
            });
        });
    });
});

// Envoyer un message
router.post('/', (req, res) => {
    const { expediteurId, destinataireId, contenu } = req.body;
    const id = generateId();
    const date = formatDate();

    db.run('INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0)',
        [id, expediteurId, destinataireId, contenu, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, expediteurId, destinataireId, contenu, date, lu: false });
        }
    );
});

// Marquer un message comme lu
router.put('/:id/lu', (req, res) => {
    db.run('UPDATE messages SET lu = 1 WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé' });
        res.json({ message: 'Message marqué comme lu' });
    });
});

module.exports = router;
