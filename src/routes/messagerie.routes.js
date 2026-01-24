const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { generateId, formatDate } = require('../utils/helpers');

// Obtenir les destinataires possibles selon les droits de l'utilisateur
router.get('/destinataires', (req, res) => {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    if (userRole === 'eleve') {
        // Élèves peuvent envoyer à leurs professeurs et au secrétariat
        Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
                    if (err) reject(err);
                    else resolve(profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, email, role FROM staff WHERE role = ?', ['secretariat'], (err, staffs) => {
                    if (err) reject(err);
                    else resolve(staffs.map(s => ({ id: s.id, nom: s.nom, role: 'Secrétariat', type: 'user' })));
                });
            })
        ]).then(([profs, staffs]) => {
            res.json([...profs, ...staffs]);
        }).catch(err => res.status(500).json({ error: err.message }));
    } else if (userRole === 'professeur') {
        // Professeurs peuvent envoyer à tous les élèves de leurs classes, autres profs, et staff
        Promise.all([
            new Promise((resolve, reject) => {
                db.all(`
                    SELECT DISTINCT e.id, e.nom, e.prenom FROM eleves e
                    INNER JOIN classes c ON e.classe = c.nom
                    WHERE c.professeurId = ?
                `, [userId], (err, eleves) => {
                    if (err) reject(err);
                    else resolve(eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève', type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, prenom FROM professeurs WHERE id != ?', [userId], (err, profs) => {
                    if (err) reject(err);
                    else resolve(profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, role FROM staff', (err, staffs) => {
                    if (err) reject(err);
                    else resolve(staffs.map(s => ({ id: s.id, nom: s.nom, role: s.role, type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT nom FROM classes', (err, classes) => {
                    if (err) reject(err);
                    else resolve(classes.map(c => ({ id: `class_${c.nom}`, nom: `Classe ${c.nom}`, role: 'Classe', type: 'class' })));
                });
            })
        ]).then(([eleves, profs, staffs, classes]) => {
            res.json([...profs, ...staffs, ...eleves, ...classes]);
        }).catch(err => res.status(500).json({ error: err.message }));
    } else if (userRole && ['directeur', 'secretariat', 'admin'].includes(userRole.toLowerCase())) {
        // Staff peut envoyer à tous
        Promise.all([
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, prenom FROM eleves', (err, eleves) => {
                    if (err) reject(err);
                    else resolve(eleves.map(e => ({ id: e.id, nom: `${e.prenom} ${e.nom}`, role: 'Élève', type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, prenom FROM professeurs', (err, profs) => {
                    if (err) reject(err);
                    else resolve(profs.map(p => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, role: 'Professeur', type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT id, nom, role FROM staff WHERE id != ?', [userId], (err, staffs) => {
                    if (err) reject(err);
                    else resolve(staffs.map(s => ({ id: s.id, nom: s.nom, role: s.role, type: 'user' })));
                });
            }),
            new Promise((resolve, reject) => {
                db.all('SELECT nom FROM classes', (err, classes) => {
                    if (err) reject(err);
                    else resolve(classes.map(c => ({ id: `class_${c.nom}`, nom: `Classe ${c.nom}`, role: 'Classe', type: 'class' })));
                });
            })
        ]).then(([eleves, profs, staffs, classes]) => {
            res.json([...eleves, ...profs, ...staffs, ...classes]);
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        res.status(403).json({ error: 'Rôle non autorisé' });
    }
});

// Obtenir les messages de l'utilisateur
router.get('/', (req, res) => {
    const userId = req.headers['x-user-id'];

    // Récupérer tous les messages où l'utilisateur est expéditeur ou destinataire
    db.all(`
        SELECT m.*,
               e.prenom as expPrenom, e.nom as expNomEleve,
               p.prenom as expPrenomProf, p.nom as expNomProf,
               es.nom as expNomStaff,
               de.prenom as destPrenom, de.nom as destNomEleve,
               dp.prenom as destPrenomProf, dp.nom as destNomProf,
               ds.nom as destNomStaff
        FROM messages m
        LEFT JOIN eleves e ON m.expediteurId = e.id
        LEFT JOIN professeurs p ON m.expediteurId = p.id
        LEFT JOIN staff es ON m.expediteurId = es.id
        LEFT JOIN eleves de ON m.destinataireId = de.id
        LEFT JOIN professeurs dp ON m.destinataireId = dp.id
        LEFT JOIN staff ds ON m.destinataireId = ds.id
        WHERE m.destinataireId = ? OR m.expediteurId = ?
        ORDER BY m.date DESC
    `, [userId, userId], (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });

        const enrichedMessages = messages.map(m => {
            let expediteurNom = 'Système';
            if (m.expPrenom && m.expNomEleve) {
                expediteurNom = `${m.expPrenom} ${m.expNomEleve}`;
            } else if (m.expPrenomProf && m.expNomProf) {
                expediteurNom = `${m.expPrenomProf} ${m.expNomProf}`;
            } else if (m.expNomStaff) {
                expediteurNom = m.expNomStaff;
            }

            let destinataireNom = 'Utilisateur';
            if (m.destinataireId.startsWith('class_')) {
                destinataireNom = `Classe ${m.destinataireId.replace('class_', '')}`;
            } else if (m.destPrenom && m.destNomEleve) {
                destinataireNom = `${m.destPrenom} ${m.destNomEleve}`;
            } else if (m.destPrenomProf && m.destNomProf) {
                destinataireNom = `${m.destPrenomProf} ${m.destNomProf}`;
            } else if (m.destNomStaff) {
                destinataireNom = m.destNomStaff;
            }

            return {
                id: m.id,
                expediteurId: m.expediteurId,
                destinataireId: m.destinataireId,
                contenu: m.contenu,
                date: m.date,
                lu: m.lu === 1,
                expediteurNom: expediteurNom,
                destinataireNom: destinataireNom
            };
        });

        res.json(enrichedMessages);
    });
});

// Envoyer un message
router.post('/', (req, res) => {
    const { expediteurId, destinataires, contenu } = req.body;
    const userRole = req.headers['x-user-role'];

    if (!contenu || !contenu.trim()) {
        return res.status(400).json({ error: 'Le contenu du message est requis' });
    }

    if (!Array.isArray(destinataires) || destinataires.length === 0) {
        return res.status(400).json({ error: 'Au moins un destinataire est requis' });
    }

    // Vérifier les droits selon le rôle
    if (!canSendToDestinataires(userRole, destinataires)) {
        return res.status(403).json({ error: 'Vous n\'avez pas les droits pour envoyer à ces destinataires' });
    }

    const date = formatDate();
    const sentMessages = [];
    let completed = 0;
    const total = destinataires.length;

    destinataires.forEach(dest => {
        if (dest.type === 'class') {
            // Envoyer à tous les élèves de la classe
            const className = dest.id.replace('class_', '');
            db.all('SELECT id FROM eleves WHERE classe = ?', [className], (err, eleves) => {
                if (err) {
                    completed++;
                    if (completed === total) res.status(500).json({ error: err.message });
                    return;
                }

                let classCompleted = 0;
                const classTotal = eleves.length;
                if (classTotal === 0) {
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                    return;
                }

                eleves.forEach(eleve => {
                    const msgId = generateId();
                    db.run('INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0)',
                        [msgId, expediteurId, eleve.id, contenu, date],
                        function(err) {
                            if (err) {
                                console.error('Erreur insertion message:', err);
                                classCompleted++;
                                if (classCompleted === classTotal) {
                                    completed++;
                                    if (completed === total) res.status(201).json(sentMessages);
                                }
                                return;
                            }
                            sentMessages.push({
                                id: msgId,
                                expediteurId,
                                destinataireId: eleve.id,
                                contenu,
                                date,
                                lu: false
                            });
                            classCompleted++;
                            if (classCompleted === classTotal) {
                                completed++;
                                if (completed === total) res.status(201).json(sentMessages);
                            }
                        }
                    );
                });
            });
        } else {
            // Message individuel
            const msgId = generateId();
            db.run('INSERT INTO messages VALUES (?, ?, ?, ?, ?, 0)',
                [msgId, expediteurId, dest.id, contenu, date],
                function(err) {
                    if (err) {
                        console.error('Erreur insertion message:', err);
                        completed++;
                        if (completed === total) res.status(500).json({ error: err.message });
                        return;
                    }
                    sentMessages.push({
                        id: msgId,
                        expediteurId,
                        destinataireId: dest.id,
                        contenu,
                        date,
                        lu: false
                    });
                    completed++;
                    if (completed === total) res.status(201).json(sentMessages);
                }
            );
        }
    });
});

// Vérifier si l'utilisateur peut envoyer aux destinataires spécifiés
function canSendToDestinataires(userRole, destinataires) {
    if (userRole && ['directeur', 'secretariat', 'admin'].includes(userRole.toLowerCase())) {
        return true; // Staff peut envoyer à tous
    }

    if (userRole === 'professeur') {
        return destinataires.every(dest => {
            if (dest.type === 'class') return true;
            return dest.type === 'user';
        });
    }

    if (userRole === 'eleve') {
        return destinataires.every(dest => {
            return dest.type === 'user' && (dest.role === 'Professeur' || dest.role === 'Secrétariat');
        });
    }

    return false;
}

// Marquer un message comme lu
router.put('/:id/lu', (req, res) => {
    const userId = req.headers['x-user-id'];

    db.run('UPDATE messages SET lu = 1 WHERE id = ? AND destinataireId = ?', [req.params.id, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé ou non autorisé' });
        res.json({ message: 'Message marqué comme lu' });
    });
});

// Supprimer un message
router.delete('/:id', (req, res) => {
    const userId = req.headers['x-user-id'];

    db.run('DELETE FROM messages WHERE id = ? AND (expediteurId = ? OR destinataireId = ?)',
        [req.params.id, userId, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Message non trouvé ou non autorisé' });
        res.json({ message: 'Message supprimé' });
    });
});

module.exports = router;
